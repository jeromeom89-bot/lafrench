const {test}=require('node:test');const assert=require('node:assert/strict');const E=require('../public/solo');
function advance(r,ms){for(let t=0;t<ms;t+=1000/120)E.tick(r,Math.min(1000/120,ms-t));}
test('Hockey robot intercepts bank shots and attacks an exposed goal without teleporting',()=>{
 for(const difficulty of ['normal','hard']){
  for(const vy of [-6,6]){const r=E.create('hockey',{difficulty});r.countdown=0;r.ball={x:420,y:vy>0?360:100,vx:10,vy};let returned=false;
   for(let i=0;i<300;i++){const old={...r.mallets[1]};E.tick(r,1000/120);assert.ok(Math.hypot(r.mallets[1].x-old.x,r.mallets[1].y-old.y)<4);assert.equal(r.score[0],0);if(r.ball.vx<0&&r.ball.x<600){returned=true;break;}}assert.ok(returned,'robot must return the shot');
  }
  const attack=E.create('hockey',{difficulty});E.move(attack,140,100);advance(attack,12000);assert.ok(attack.score[1]>0,'robot must attack the open goal');
 }
});
test('Pong expert anticipates a cushion bounce and returns the ball away from the human',()=>{
 const r=E.create('pong',{difficulty:'hard'});r.countdown=0;r.paddles[0]=100;r.ball={x:400,y:360,vx:8,vy:5};
 advance(r,1600);assert.equal(r.score[0],0);assert.ok(r.ball.vx<0);assert.ok(r.ball.vy>0,'return aims at the free lower half');
});
test('Solo dart deadline ends a missed challenge; multiplayer retains its ten volleys',()=>{
 const r=E.create('darts',{difficulty:'hard'});for(let i=0;i<12;i++){E.shot(r,0,0);advance(r,430);if(r.pendingVolley)advance(r,1150);}assert.ok(r.finished);assert.equal(r.winner,1);assert.equal(r.remaining[0],301);
 const multi=E.create('darts',{difficulty:'hard',solo:false});assert.equal(multi.maxRounds,10);
});
test('Pool shot budget is checked only after balls settle and allows victory on the final shot',()=>{
 const r=E.create('pool',{difficulty:'hard'});r.shots=24;E.shot(r,700,230,.1);assert.ok(!r.finished);advance(r,5000);assert.ok(r.finished);assert.equal(r.winner,1);
 const last=E.create('pool',{difficulty:'hard'});last.shots=25;last.moving=true;last.firstHit=1;last.required=1;last.pocketed=1;last.balls.find(b=>b.n===9).active=false;advance(last,20);assert.ok(last.finished);assert.equal(last.winner,0);
 const multi=E.create('pool',{difficulty:'hard',solo:false});assert.equal(multi.shotLimit,0);
});
test('Memory deadline stops at zero, pauses with the game and leaves easy mode untimed',()=>{
 const r=E.create('memory',{difficulty:'hard'});advance(r,r.previewUntil+74000);assert.ok(!r.finished);r.paused=true;advance(r,5000);assert.ok(!r.finished);r.paused=false;advance(r,1100);assert.ok(r.finished);assert.equal(r.winner,1);
 const easy=E.create('memory',{difficulty:'easy'});advance(easy,150000);assert.ok(!easy.finished);
});
test('Breakout expert smaller paddle genuinely misses shots caught in easy mode',()=>{
 for(const difficulty of ['easy','hard']){const r=E.create('breakout',{difficulty});r.countdown=0;r.serving=false;r.ball={x:r.paddle+60,y:390,vx:0,vy:8};advance(r,500);assert.equal(r.lives,difficulty==='easy'?3:2);}
});
