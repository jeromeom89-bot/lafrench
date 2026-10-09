const express = require('express');
const Engine = require('./public/solo');
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
function reset(r) { const base=Engine.create(r.game,{solo:false,doubleOut:r.doubleOut}); delete base.id; delete base.players; delete base.started; Object.assign(r,base); r.recorded=false; r.roundId=randomUUID(); }
function recordWin(r) { if(r.recorded)return; r.recorded=true; const name=r.winner>=0?users.get(r.players[r.winner])?.name:null; if(name) ranks.set(name,(ranks.get(name)||0)+1); lobby(); }
wss.on('connection', ws => {
 const u={id:randomUUID(),name:'',ws,room:null,lastChat:0,lastAction:0};
 send(ws,{type:'hello',id:u.id});
 ws.on('message', raw => { let m; try {m=JSON.parse(raw);} catch{return;} if(!m || typeof m!=='object')return;
 if(m.type==='join') { if(users.has(u.id))return; u.name=String(m.name||'Joueur').trim().slice(0,20)||'Joueur'; users.set(u.id,u); lobby(); return; }
 if(!users.has(u.id))return;
 if(m.type==='chat' && Date.now()-u.lastChat>600) {u.lastChat=Date.now(); const text=String(m.text||'').trim().slice(0,280); if(text)broadcast({type:'chat',name:u.name,text});}
 if(m.type==='create' && games.includes(m.game)) {leave(u); const r={id:randomUUID().slice(0,8),game:m.game,players:[u.id],started:false,doubleOut:m.doubleOut!==false}; reset(r); rooms.set(r.id,r); u.room=r.id; send(ws,{type:'entered',id:r.id}); state(r); lobby();}
 if(m.type==='enter') {const r=rooms.get(m.id); if(!r||r.players.length>=2||u.room===r.id)return; leave(u);r.players.push(u.id);u.room=r.id;reset(r);r.started=true;send(ws,{type:'entered',id:r.id});state(r);lobby();}
 if(m.type==='leave')leave(u);
 const r=rooms.get(u.room), p=r?.players.indexOf(u.id);
 if(m.type==='rematch'&&r&&r.finished&&r.players.length===2) {reset(r);r.started=true;state(r);}
 if(m.type==='move'&&r&&Number.isFinite(m.x)&&Number.isFinite(m.y)) Engine.move(r,m.x,m.y,p);
 if(m.type==='place'&&r&&Engine.placeCue(r,m.x,m.y,p))state(r);
 if(m.type==='spin'&&r&&r.turn===p)Engine.setSpin(r,m.x,m.y);
 if(m.type==='shot'&&r&&r.started&&!r.finished&&Number.isFinite(m.x)&&Number.isFinite(m.y)&&Date.now()-u.lastAction>250) {
   u.lastAction=Date.now(); Engine.shot(r,Math.max(0,Math.min(800,m.x)),Math.max(0,Math.min(460,m.y)),m.power,p);
   if(r.finished)recordWin(r); state(r);
 }

 });
 ws.on('close',()=>{leave(u);users.delete(u.id);lobby();});ws.on('error',()=>{});
});
let lastTick=performance.now(),lastBroadcast=lastTick;
setInterval(()=>{
 const now=performance.now(),dt=Math.min(100,now-lastTick);lastTick=now;const emit=now-lastBroadcast>=1000/30;
 rooms.forEach(r=>{if(!r.started||r.finished)return;const previous=r.eventId;Engine.tick(r,dt);if(r.finished)recordWin(r);if(emit||r.eventId!==previous||r.finished)state(r);});
 if(emit)lastBroadcast=now;
},1000/120);
