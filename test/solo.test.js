const {test}=require('node:test');const assert=require('node:assert/strict');const E=require('../public/solo');
function advance(r,ms){for(let t=0;t<ms;t+=10)E.tick(r,Math.min(10,ms-t));}
function dart(r,x,y,p=0){E.shot(r,x,y,.5,p);advance(r,430);}
function volley(r){advance(r,1150);}
test('Darts : measured rings, flight lock, three darts and double checkout',()=>{
 assert.equal(E.dartScore(400,120).points,60);assert.equal(E.dartScore(400,230).points,50);assert.equal(E.dartScore(400,0).points,0);assert.equal(E.dartScore(400,55).points,40);
 const r=E.create('darts');E.shot(r,400,120);E.shot(r,400,230);assert.equal(r.shots,0);assert.equal(r.dartFlight.points,60);advance(r,430);assert.equal(r.shots,1);
 dart(r,400,120);dart(r,400,120);assert.ok(r.pendingVolley);volley(r);dart(r,400,120);assert.equal(r.remaining[0],61);
 // Single 1, double 20 leaves 20. Next volley, double 10 closes the match.
 const pt=(sector,radius)=>{const a=sector*Math.PI/10;return[400+radius*Math.sin(a),230-radius*Math.cos(a)];};
 dart(r,...pt(1,150));dart(r,400,55);assert.equal(r.remaining[0],20);volley(r);dart(r,...pt(6,175));assert.equal(r.remaining[0],0);assert.equal(r.winner,0);assert.ok(r.finished);
});
test('Darts : bust restores whole volley, 1 and non-double zero are invalid',()=>{
 const r=E.create('darts');r.remaining[0]=70;r.volleyStart=70;dart(r,400,120);assert.equal(r.remaining[0],10);dart(r,400,230);assert.equal(r.remaining[0],70);assert.ok(r.pendingVolley);volley(r);assert.equal(r.round,2);
 const s=E.create('darts');s.remaining[0]=20;s.volleyStart=20;dart(s,400,80);assert.equal(s.remaining[0],20);assert.ok(s.busted);
 const free=E.create('darts',{doubleOut:false});free.remaining[0]=20;free.volleyStart=20;dart(free,400,80);assert.ok(free.finished);
});
test('Pool : diamond rack, energy transfer, friction and no teleport on launch',()=>{
 const rack=E.create('pool');assert.equal(rack.balls.length,9);assert.equal(rack.balls.find(b=>b.n===9).y,230);for(let i=0;i<9;i++)for(let j=i+1;j<9;j++)assert.ok(Math.hypot(rack.balls[i].x-rack.balls[j].x,rack.balls[i].y-rack.balls[j].y)>=24);
 const r=E.create('pool');r.balls=[{x:300,y:230,vx:0,vy:0,active:true,n:1}];E.shot(r,600,230,.55);assert.equal(r.cue.x,220);advance(r,550);assert.ok(r.balls[0].x>300);assert.equal(r.firstHit,1);assert.ok(r.cue.x<310);advance(r,18000);assert.ok(!r.moving);
});
test('Pool : legal pot keeps turn, scratch gives placement without overlaps',()=>{
 const r=E.create('pool',{solo:false});r.balls=[{n:1,x:400,y:50,vx:0,vy:-5,active:true},{n:2,x:550,y:200,vx:0,vy:0,active:true}];r.moving=true;r.firstHit=1;advance(r,700);assert.equal(r.score[0],1);assert.equal(r.turn,0);
 r.cue={x:400,y:50,vx:0,vy:-5,n:0,active:true};r.moving=true;r.pocketed=0;r.required=2;r.firstHit=2;advance(r,700);assert.equal(r.turn,1);assert.ok(r.ballInHand);assert.equal(E.placeCue(r,550,200,1),false);assert.equal(E.placeCue(r,200,230,0),false);assert.ok(E.placeCue(r,200,230,1));assert.equal(r.ballInHand,false);assert.equal(r.cue.x,200);
});
test('Pool : wrong first contact is foul, illegal nine respotted, legal nine wins',()=>{
 const r=E.create('pool',{solo:false});r.moving=true;r.firstHit=2;r.required=1;r.railAfterHit=true;advance(r,20);assert.ok(r.ballInHand);assert.equal(r.turn,1);
 const nine=E.create('pool',{solo:false});nine.moving=true;nine.firstHit=2;nine.required=1;nine.railAfterHit=true;nine.balls.find(b=>b.n===9).active=false;nine.pocketed=1;nine.score[0]=1;advance(nine,20);assert.ok(nine.balls.find(b=>b.n===9).active);assert.ok(!nine.finished);
 const legal=E.create('pool');legal.moving=true;legal.firstHit=1;legal.required=1;legal.balls.find(b=>b.n===9).active=false;legal.pocketed=1;advance(legal,20);assert.ok(legal.finished);assert.equal(legal.winner,0);
});
test('Physics : identical outcomes at 30, 60 and 144 rendering FPS',()=>{
 function run(game,fps){const r=E.create(game);r.countdown=0;if(game==='pool')E.shot(r,620,230,.9);else E.move(r,366,230);for(let t=0;t<1800-1e-6;){const dt=Math.min(1000/fps,1800-t);E.tick(r,dt);t+=dt;}return game==='pool'?[r.cue,...r.balls].map(b=>[b.x,b.y,b.vx,b.vy]):[r.ball.x,r.ball.y,r.ball.vx,r.ball.vy];}
 for(const game of ['pool','hockey']){const a=run(game,30);for(const fps of [60,144]){const b=run(game,fps);const flat=x=>x.flat(Infinity);flat(a).forEach((v,i)=>assert.ok(Math.abs(v-flat(b)[i])<1e-5,game+' depends on FPS'));}}
});
test('Hockey : half limits, physical strike, post reflection, one goal and stationary contact',()=>{
 const r=E.create('hockey',{solo:false});r.countdown=0;E.move(r,800,230);assert.equal(r.targets[0].x,366);advance(r,900);assert.ok(Math.hypot(r.ball.vx,r.ball.vy)>0);
 r.ball={x:38,y:80,vx:-10,vy:0};advance(r,30);assert.equal(r.score[1],0);assert.ok(r.ball.vx>0);
 r.ball={x:40,y:161,vx:-8,vy:0};advance(r,60);assert.equal(r.score[1],0);
 r.ball={x:12,y:230,vx:-5,vy:0};advance(r,20);assert.equal(r.score[1],1);advance(r,300);assert.equal(r.score[1],1);
 const stuck=E.create('hockey',{solo:false});stuck.countdown=0;stuck.mallets[0]={x:200,y:230,vx:0,vy:0};stuck.targets[0]={x:200,y:230};stuck.ball={x:200,y:230,vx:0,vy:0};advance(stuck,100);assert.ok(Number.isFinite(stuck.ball.x));assert.equal(stuck.ball.vx,0);assert.ok(Math.hypot(stuck.ball.x-200,stuck.ball.y-230)>=42);
});
test('Hockey : high-speed shots cannot tunnel through a stationary mallet',()=>{
 const r=E.create('hockey',{solo:false});r.countdown=0;r.mallets[0]={x:200,y:230,vx:0,vy:0};r.targets[0]={x:200,y:230};r.ball={x:270,y:230,vx:-20,vy:0};advance(r,100);assert.ok(r.ball.vx>0);assert.ok(r.ball.x>200);
});
test('Pong, Snake, Breakout and Memory retain their game rules',()=>{
 const pong=E.create('pong');pong.countdown=0;E.move(pong,50,150);pong.ball={x:67,y:185,vx:-6,vy:0};advance(pong,20);assert.ok(pong.ball.vx>0);assert.ok(pong.ball.vy>0);
 const snake=E.create('snake');snake.countdown=0;snake.food={x:9,y:9};E.direction(snake,-1,0);advance(snake,150);assert.equal(snake.score[0],1);E.direction(snake,0,-1);E.direction(snake,1,0);advance(snake,140);assert.equal(snake.dir.y,-1);advance(snake,140);assert.equal(snake.dir.x,1);advance(snake,6000);assert.ok(snake.finished);
 const bricks=E.create('breakout');bricks.countdown=0;E.shot(bricks,400,230);bricks.ball={x:60,y:43,vx:0,vy:2};advance(bricks,20);assert.ok(bricks.score[0]>0);for(let i=0;i<3;i++){bricks.serving=false;bricks.ball={x:100,y:480,vx:0,vy:4};advance(bricks,20);}assert.ok(bricks.finished);
 const m=E.create('memory');m.cards=Array.from({length:16},(_,i)=>({value:Math.floor(i/2),matched:false}));const click=i=>E.shot(m,152+i%4*124+20,22+Math.floor(i/4)*105+20);click(0);assert.equal(m.flipped.length,0);advance(m,2230);click(0);click(2);assert.equal(m.flipped.length,2);advance(m,930);assert.equal(m.flipped.length,0);for(let i=0;i<16;i++)click(i);assert.equal(m.score[0],8);assert.ok(m.finished);
});
test('Pause does not advance rules or motion',()=>{for(const game of ['pool','pong','hockey','darts','snake','breakout','memory']){const r=E.create(game);r.paused=true;const before=JSON.stringify(r);E.tick(r,50);E.shot(r,400,230);assert.equal(JSON.stringify(r),before);}});

test('Hockey : trapped puck cannot clip through a wall or gain phantom energy',()=>{
 const r=E.create('hockey',{solo:false});r.countdown=0;r.mallets[0]={x:85,y:100,vx:0,vy:0};r.targets[0]={x:52,y:100};r.ball={x:43,y:100,vx:0,vy:0};advance(r,1000);assert.ok(r.ball.x>=43);assert.equal(r.ball.vx,0);assert.ok(Math.hypot(r.ball.x-r.mallets[0].x,r.ball.y-r.mallets[0].y)>=42);
 const center=E.create('hockey',{solo:false});center.countdown=0;center.mallets=[{x:358,y:230,vx:0,vy:0},{x:442,y:230,vx:0,vy:0}];center.targets=[{x:366,y:230},{x:434,y:230}];advance(center,1000);assert.equal(center.ball.vx,0);center.mallets.forEach(m=>assert.ok(Math.hypot(center.ball.x-m.x,center.ball.y-m.y)>=42));
});
test('Hockey pointer: immediate straight tracking, sharp reversal and no coasting',()=>{
 const r=E.create('hockey',{solo:false});r.countdown=0;
 E.move(r,270,100);E.tick(r,1000/120);assert.ok(Math.abs(r.mallets[0].x-270)<1e-6);assert.ok(Math.abs(r.mallets[0].y-100)<1e-6);
 E.move(r,100,320);E.tick(r,1000/120);assert.ok(Math.abs(r.mallets[0].x-100)<1e-6);assert.ok(Math.abs(r.mallets[0].y-320)<1e-6);
 advance(r,150);assert.equal(r.mallets[0].x,100);assert.equal(r.mallets[0].y,320);assert.equal(r.mallets[0].vx,0);assert.equal(r.mallets[0].vy,0);
});
test('Hockey pointer: fast sweep hits a puck instead of teleporting over it',()=>{
 const r=E.create('hockey',{solo:false});r.countdown=0;r.ball={x:250,y:230,vx:0,vy:0};E.move(r,350,230);E.tick(r,1000/120);
 assert.ok(r.ball.vx>0);assert.ok(r.ball.x>=r.mallets[0].x+41.9);assert.ok(Math.hypot(r.ball.vx,r.ball.vy)<=20);
});
