const express = require('express');
const { WebSocketServer, WebSocket } = require('ws');
const { randomUUID } = require('node:crypto');
const app = express();
app.use(express.static('public'));
app.get('/health', (_, res) => res.json({ ok: true }));
const server = app.listen(process.env.PORT || 3000, '0.0.0.0');
const wss = new WebSocketServer({ server, maxPayload: 4096 });
const users = new Map(), rooms = new Map(), ranks = new Map();
const games = ['darts', 'pool', 'hockey', 'pong'];
const send = (ws, data) => { if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(data)); };
const broadcast = data => users.forEach(u => send(u.ws, data));
const publicUser = u => ({ id: u.id, name: u.name, room: u.room });
function lobby() { broadcast({ type: 'lobby', users: [...users.values()].map(publicUser), rooms: [...rooms.values()].map(r => ({ id: r.id, game: r.game, players: r.players.length, host: users.get(r.players[0])?.name })), ranks: [...ranks.entries()].map(([name, wins]) => ({ name, wins })).sort((a,b)=>b.wins-a.wins).slice(0,20) }); }
function state(r) { r.players.forEach(id => { const u=users.get(id); if(u) send(u.ws,{ type:'state', room:r }); }); }
function leave(u) { if(!u.room) return; const r=rooms.get(u.room); u.room=null; if(r) { r.players=r.players.filter(id=>id!==u.id); if(!r.players.length) rooms.delete(r.id); else { r.started=false; r.finished=false; state(r); } } lobby(); }
function reset(r) { r.score=[0,0]; r.turn=0; r.shots=0; r.finished=false; r.ball={ x:400,y:230,vx:4,vy:2 }; r.paddles=[230,230]; r.balls=Array.from({length:6},(_,i)=>({x:500+(i%3)*28,y:195+Math.floor(i/3)*32,active:true})); r.cue={x:190,y:230}; }
function win(r, player) { r.finished=true; const name=users.get(r.players[player])?.name; if(name) ranks.set(name,(ranks.get(name)||0)+1); lobby(); }
wss.on('connection', ws => {
 const u={id:randomUUID(),name:'',ws,room:null,lastChat:0,lastAction:0};
 send(ws,{type:'hello',id:u.id});
 ws.on('message', raw => { let m; try {m=JSON.parse(raw);} catch{return;} if(!m || typeof m!=='object')return;
 if(m.type==='join') { if(users.has(u.id))return; u.name=String(m.name||'Joueur').trim().slice(0,20)||'Joueur'; users.set(u.id,u); lobby(); return; }
 if(!users.has(u.id))return;
 if(m.type==='chat' && Date.now()-u.lastChat>600) {u.lastChat=Date.now(); const text=String(m.text||'').trim().slice(0,280); if(text)broadcast({type:'chat',name:u.name,text});}
 if(m.type==='create' && games.includes(m.game)) {leave(u); const r={id:randomUUID().slice(0,8),game:m.game,players:[u.id],started:false}; reset(r); rooms.set(r.id,r); u.room=r.id; send(ws,{type:'entered',id:r.id}); state(r); lobby();}
 if(m.type==='enter') {const r=rooms.get(m.id); if(!r||r.players.length>=2||u.room===r.id)return; leave(u);r.players.push(u.id);u.room=r.id;reset(r);r.started=true;send(ws,{type:'entered',id:r.id});state(r);lobby();}
 if(m.type==='leave')leave(u);
 const r=rooms.get(u.room), p=r?.players.indexOf(u.id);
 if(m.type==='rematch'&&r&&r.players.length===2) {reset(r);r.started=true;state(r);}
 if(m.type==='move'&&r&&Number.isFinite(m.y))r.paddles[p]=Math.max(45,Math.min(415,m.y));
 if(m.type==='shot'&&r&&r.started&&!r.finished&&r.turn===p&&Number.isFinite(m.x)&&Number.isFinite(m.y)&&Date.now()-u.lastAction>500) {
 u.lastAction=Date.now();const x=Math.max(0,Math.min(800,m.x)), y=Math.max(0,Math.min(460,m.y));
 if(r.game==='darts') {const dx=x-400,dy=y-230,d=Math.hypot(dx,dy), sector=[20,1,18,4,13,6,10,15,2,17,3,19,7,16,8,11,14,9,12,5][Math.floor(((Math.atan2(dx,-dy)+Math.PI*2+Math.PI/20)%(Math.PI*2))/(Math.PI*2)*20)]; const points=d<10?50:d<23?25:d>180?0:sector*(d>165?2:d>100&&d<113?3:1);r.score[p]+=points;r.lastShot={x,y,points};r.shots++;r.turn=1-p;if(r.shots>=12)win(r,r.score[0]>=r.score[1]?0:1);}
 if(r.game==='pool') {const dx=x-r.cue.x,dy=y-r.cue.y,len=Math.hypot(dx,dy); if(len<5)return; const hit=r.balls.find(b=>b.active&&Math.abs((b.x-r.cue.x)*dy-(b.y-r.cue.y)*dx)/len<22&&((b.x-r.cue.x)*dx+(b.y-r.cue.y)*dy)>0);if(hit){hit.active=false;r.score[p]++;} r.cue={x:Math.max(50,Math.min(750,x)),y:Math.max(50,Math.min(410,y))};r.turn=1-p;r.lastShot={x,y,points:hit?1:0};if(r.balls.every(b=>!b.active))win(r,r.score[0]>=r.score[1]?0:1);}
 state(r);
 }
 });
 ws.on('close',()=>{leave(u);users.delete(u.id);lobby();});ws.on('error',()=>{});
});
setInterval(()=>{ rooms.forEach(r=>{if(!r.started||r.finished||!['pong','hockey'].includes(r.game))return;const b=r.ball;b.x+=b.vx;b.y+=b.vy;if(b.y<14||b.y>446)b.vy*=-1;[0,1].forEach(p=>{const x=p?750:50;if(Math.abs(b.x-x)<17&&Math.abs(b.y-r.paddles[p])<58&&((p===0&&b.vx<0)||(p===1&&b.vx>0))){b.vx=-b.vx*1.04;b.vy=(b.y-r.paddles[p])/13;}});if(b.x<0||b.x>800){const p=b.x<0?1:0;r.score[p]++;if(r.score[p]>=7)win(r,p);r.ball={x:400,y:230,vx:p?-4:4,vy:2};}state(r);}); },1000/30);
