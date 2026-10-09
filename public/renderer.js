(function(root){
const backgrounds=new Map();
const W=800,H=460,colors=['#f8c44b','#559aff','#f37474','#be8cff','#f29c50','#62ca9c','#ce788e','#151c25','#f8c44b'];
function draw(ctx,r,view={}) {
 const time=r.elapsed||0,me=view.player||0,aim=view.aim;ctx.clearRect(0,0,W,H);ctx.save();
 function round(x,y,w,h,rad,fill,stroke){ctx.beginPath();ctx.roundRect(x,y,w,h,rad);if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=1;ctx.stroke();}}
 function circle(x,y,rad,fill,stroke){ctx.beginPath();ctx.arc(x,y,rad,0,Math.PI*2);if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=2;ctx.stroke();}}
 function label(t,x,y,size=18,color='#edf3e7',font='sans-serif'){ctx.fillStyle=color;ctx.font=`600 ${size}px ${font}`;ctx.textAlign='center';ctx.fillText(t,x,y);}
 function line(x,y,x2,y2,color,width=1){ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x2,y2);ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke();}
 function ball(x,y,rad,color){ctx.save();ctx.shadowColor='#0008';ctx.shadowBlur=10;ctx.shadowOffsetY=4;const g=ctx.createRadialGradient(x-rad*.35,y-rad*.4,1,x,y,rad);g.addColorStop(0,'#ffffff');g.addColorStop(.22,color);g.addColorStop(1,'#111c25');circle(x,y,rad,g);ctx.restore();}
 function staticLayer(key,paint){let cached=backgrounds.get(key);if(!cached){cached=document.createElement('canvas');cached.width=W;cached.height=H;const main=ctx;ctx=cached.getContext('2d');paint();ctx=main;backgrounds.set(key,cached);}ctx.drawImage(cached,0,0);}
 function trails(color){(r.trail||[]).forEach((p,i)=>{ctx.globalAlpha=i/20;circle(p.x,p.y,3+i*.6,color);});ctx.globalAlpha=1;}
 const bg=ctx.createLinearGradient(0,0,800,460);bg.addColorStop(0,'#14212c');bg.addColorStop(1,'#090f17');ctx.fillStyle=bg;ctx.fillRect(0,0,W,H);
 if(r.game==='pong'){
  round(20,18,760,424,18,'#182f40','#4c90a1');round(32,30,736,400,9,null,'#649bad55');
  ctx.setLineDash([8,12]);line(400,30,400,430,'#b7e9e655',2);ctx.setLineDash([]);circle(400,230,64,null,'#6596a555');
  label(r.score[0],320,104,64,'#d7fc7230');label(r.score[1],480,104,64,'#ea987e30');
  [0,1].forEach(p=>{const x=p?744:44;ctx.save();ctx.shadowBlur=18;ctx.shadowColor=p?'#ff967b':'#d7fc72';round(x,r.paddles[p]-52,12,104,6,p?'#ff967b':'#d7fc72');ctx.restore();});trails('#edfaff');ball(r.ball.x,r.ball.y,10,'#ffffff');
  label('TOI',me?740:60,455,11,'#d7fc72');label(`ÉCHANGE ${r.rally||0} · RECORD ${r.bestRally||0}`,400,455,11,'#8eabbc');
 }
 if(r.game==='hockey'){
  staticLayer('hockey',()=>{round(18,18,764,424,30,'#d8e4ea','#8ca6bf');round(29,29,742,402,23,'#ddebf0');
  for(let x=60;x<760;x+=18)for(let y=54;y<415;y+=18)circle(x,y,.7,'#668da433');
  line(400,30,400,430,'#c86679',3);circle(400,230,70,null,'#c86679');circle(400,230,7,'#c86679');
  ctx.strokeStyle='#718fb6';ctx.lineWidth=3;ctx.beginPath();ctx.arc(25,230,102,-Math.PI/2,Math.PI/2);ctx.stroke();ctx.beginPath();ctx.arc(775,230,102,Math.PI/2,Math.PI*1.5);ctx.stroke();
  round(8,158,22,144,6,'#0d1625');round(770,158,22,144,6,'#0d1625');});
  r.mallets.forEach((m,p)=>{if(p===me){circle(m.x,m.y,35,null,view.grabbed?'#d7fc72':'#3778bb88');}const c=p?'#ed7b69':'#578ed8';circle(m.x,m.y+4,30,'#19334966');circle(m.x,m.y,28,c,'#ffffff88');circle(m.x,m.y-1,19,null,'#ffffff55');circle(m.x,m.y-4,12,c,'#ffffff99');});
  trails('#52616e');ball(r.ball.x,r.ball.y,14,'#303b50');label('BUT',14,149,9,'#9daebe');label('BUT',786,149,9,'#9daebe');if(!view.grabbed&&!r.finished)label('SAISIS TON MAILLET ET GLISSE',400,455,11,'#9fbacf');
 }
 if(r.game==='pool'){
  staticLayer('pool',()=>{const wood=ctx.createLinearGradient(0,0,0,460);wood.addColorStop(0,'#7d5236');wood.addColorStop(.5,'#3f281d');wood.addColorStop(1,'#895b3d');round(12,12,776,436,28,wood,'#b68656');round(26,26,748,408,16,'#10372e');
  const felt=ctx.createRadialGradient(400,200,30,400,230,440);felt.addColorStop(0,'#277765');felt.addColorStop(1,'#17473c');round(38,38,724,384,8,felt);
  [130,265,535,670].forEach(x=>{circle(x,20,2,'#e6d0ac');circle(x,440,2,'#e6d0ac');});[120,230,340].forEach(y=>{circle(20,y,2,'#e6d0ac');circle(780,y,2,'#e6d0ac');});
  [[34,34],[400,24],[766,34],[34,426],[400,436],[766,426]].forEach(([x,y])=>{circle(x,y,23,'#17150f','#b9935e');circle(x,y,17,'#040906');});});
  if(aim&&!r.moving&&!r.ballInHand&&(r.solo||r.turn===me)){
   const dx=aim.x-r.cue.x,dy=aim.y-r.cue.y,d=Math.hypot(dx,dy);if(d>5){const nx=dx/d,ny=dy/d;let reach=230,hit=null;
    r.balls.filter(b=>b.active).forEach(b=>{const bx=b.x-r.cue.x,by=b.y-r.cue.y,along=bx*nx+by*ny,cross=bx*ny-by*nx;if(along>0&&Math.abs(cross)<24){const travel=along-Math.sqrt(576-cross*cross);if(travel<reach){reach=Math.max(0,travel);hit=b;}}});
    const ex=r.cue.x+nx*reach,ey=r.cue.y+ny*reach;ctx.setLineDash([5,7]);line(r.cue.x,r.cue.y,ex,ey,'#edf5d699',1);ctx.setLineDash([]);circle(ex,ey,12,null,'#edf5d655');
    if(hit){const hx=(hit.x-ex)/24,hy=(hit.y-ey)/24;line(hit.x,hit.y,hit.x+hx*60,hit.y+hy*60,hit.n===r.required?'#d7fc72':'#ed8c80',2);}
    const pull=12+(view.power||0)*45;line(r.cue.x-nx*(35+pull),r.cue.y-ny*(35+pull),r.cue.x-nx*(180+pull),r.cue.y-ny*(180+pull),'#b08557',6);line(r.cue.x-nx*(30+pull),r.cue.y-ny*(30+pull),r.cue.x-nx*(45+pull),r.cue.y-ny*(45+pull),'#e6e6d5',4);}
  }
  r.balls.forEach(b=>{if(!b.active)return;ball(b.x,b.y,12,colors[b.n-1]);if(b.n===9){ctx.save();ctx.beginPath();ctx.arc(b.x,b.y,12,0,Math.PI*2);ctx.clip();round(b.x-12,b.y-6,24,12,0,'#fff8e0');ctx.restore();}if(b.n===r.required&&!r.moving)circle(b.x,b.y,16,null,'#d7fc7299');circle(b.x,b.y,5,'#f4eee4');label(b.n,b.x,b.y+3,8,'#112019');});if(r.cue.active&&!r.ballInHand)ball(r.cue.x,r.cue.y,12,'#fff8dc');
  if(r.ballInHand&&aim){const valid=aim.x>=55&&aim.x<=745&&aim.y>=55&&aim.y<=405&&!r.balls.some(b=>b.active&&Math.hypot(b.x-aim.x,b.y-aim.y)<25);ctx.globalAlpha=.65;ball(aim.x,aim.y,12,valid?'#fff8dc':'#f58181');ctx.globalAlpha=1;label('CLIQUE POUR PLACER LA BLANCHE',400,230,16,'#d7fc72');}
  (r.sinking||[]).forEach(b=>{const t=Math.min(1,(time-b.at)/360);if(t<1){ctx.globalAlpha=1-t;ball(b.x+(b.px-b.x)*t,b.y+(b.py-b.y)*t,12*(1-t),b.n?colors[b.n-1]:'#fff8dc');ctx.globalAlpha=1;}});
  label('9-BALL · PREMIER CONTACT SUR LA PLUS PETITE BILLE',400,456,10,'#d3ba8c');
 }
 if(r.game==='darts'){
  staticLayer('darts',()=>{const wall=ctx.createLinearGradient(0,0,0,460);wall.addColorStop(0,'#34282b');wall.addColorStop(1,'#1b1920');ctx.fillStyle=wall;ctx.fillRect(0,0,800,460);for(let y=0;y<460;y+=42)line(0,y,800,y,'#ffffff05');
  circle(400,230,216,'#151820','#68666a');circle(400,230,185,'#55565b');const sectors=[20,1,18,4,13,6,10,15,2,17,3,19,7,16,8,11,14,9,12,5];
  for(let i=0;i<20;i++){const a=-Math.PI/2-Math.PI/20+i*Math.PI/10;for(const [radius,color]of [[180,i%2?'#46856a':'#b94f51'],[180*162/170,i%2?'#e2d3b8':'#232329'],[180*107/170,i%2?'#46856a':'#b94f51'],[180*99/170,i%2?'#e2d3b8':'#232329']]){ctx.beginPath();ctx.moveTo(400,230);ctx.arc(400,230,radius,a,a+Math.PI/10);ctx.fillStyle=color;ctx.fill();}line(400,230,400+180*Math.cos(a),230+180*Math.sin(a),'#b3b6b577');label(sectors[i],400+199*Math.cos(a+Math.PI/20),236+199*Math.sin(a+Math.PI/20),17,'#e0d5cc');}
  [180,180*162/170,180*107/170,180*99/170,180*15.9/170,180*6.35/170].forEach(rad=>circle(400,230,rad,null,'#c7c7c455'));circle(400,230,180*15.9/170,'#46856a');circle(400,230,180*6.35/170,'#b94f51');});
  function dart(x,y,scale=1){ctx.save();ctx.translate(x,y);ctx.rotate(.32);line(0,0,0,-28*scale,'#dbe1e5',2*scale);line(0,-8*scale,0,-19*scale,'#7a858b',4*scale);round(-6*scale,-42*scale,12*scale,18*scale,3*scale,'#d7fc72');line(0,-42*scale,0,-24*scale,'#3e4e33',1);ctx.restore();}
  (r.throws||[]).forEach(t=>{dart(t.x,t.y);circle(t.x,t.y,2,'#14191b');});
  if(r.dartFlight){const f=r.dartFlight,t=Math.max(0,Math.min(1,(time-f.started)/(f.lands-f.started))),ease=1-Math.pow(1-t,2),x=640+(f.x-640)*ease,y=520+(f.y-520)*ease-Math.sin(t*Math.PI)*50;dart(x,y,2.5-t*1.5);}
  if(r.pendingVolley)label(r.busted?'VOLÉE ANNULÉE':'VOLÉE TERMINÉE',400,454,12,'#d7fc72');
  if(aim&&!r.dartFlight&&!r.pendingVolley&&(r.solo||r.turn===me)){circle(aim.x,aim.y,12,null,'#d7fc72');line(aim.x-20,aim.y,aim.x+20,aim.y,'#d7fc72');line(aim.x,aim.y-20,aim.x,aim.y+20,'#d7fc72');}
  label(r.doubleOut?'301 · DOUBLE FINAL':'301 · SORTIE LIBRE',95,130,11,'#bd9e9e');label(r.remaining[r.turn],95,185,44,'#d7fc72');label(`VOLÉE ${r.round}/10`,95,240,12,'#afacaf');[0,1,2].forEach(i=>circle(68+i*28,275,7,i<r.volley?'#d7fc72':'#555259'));label(r.lastShot?.label||'VISE LE TRIPLE 20',680,220,16,'#e7ccb9');label(r.lastShot?`+${r.lastShot.points}`:'',680,260,30,'#d7fc72');
 }
 if(r.game==='snake'){
  round(0,0,800,460,12,'#101e20');for(let x=0;x<800;x+=25)line(x,5,x,455,'#b5df9d08');for(let y=5;y<460;y+=25)line(0,y,800,y,'#b5df9d08');
  r.snake.forEach((p,i)=>{round(p.x*25+2,p.y*25+7,21,21,6,i?'#82b861':'#d7fc72');if(!i){const dx=r.dir.x,dy=r.dir.y;circle(p.x*25+12+dx*5+dy*4,p.y*25+17+dy*5+dx*4,2,'#1a2b16');circle(p.x*25+12+dx*5-dy*4,p.y*25+17+dy*5-dx*4,2,'#1a2b16');}});
  const pulse=1+Math.sin(time/180)*.1;circle(r.food.x*25+12,r.food.y*25+17,9*pulse,'#f18b70');line(r.food.x*25+12,r.food.y*25+8,r.food.x*25+15,r.food.y*25+3,'#b0d56c',2);
  label(`NIVEAU ${r.level} · ${Math.max(65,({easy:170,normal:140,hard:110}[r.difficulty])-r.score[0]*3)} ms / case`,400,455,10,'#7f9c83');
 }
 if(r.game==='breakout'){
  for(let i=0;i<40;i++)circle((i*137)%800,(i*71)%460,1,'#d8d9ff44');
  r.bricks.forEach((b,i)=>{if(b.active){const c=['#f6a393','#f9ca79','#d7fc72','#80d6cf','#a49df0'][Math.floor(i/10)];ctx.save();ctx.shadowBlur=10;ctx.shadowColor=c+'66';round(b.x,b.y,62,21,5,c);ctx.restore();line(b.x+5,b.y+4,b.x+56,b.y+4,'#ffffff77',2);if(b.hp>1)label('• •',b.x+31,b.y+14,12,'#513e54');}});
  const width=time<r.wideUntil?90:60;round(r.paddle-width,410,width*2,13,7,'#d7fc72');round(r.paddle-width+10,412,width*2-20,3,2,'#ffffffaa');trails('#d7fc72');ball(r.ball.x,r.ball.y,9,'#ffffff');
  r.drops.forEach(d=>{round(d.x-13,d.y-12,26,24,6,d.type==='wide'?'#80d6cf':'#bca9ff');label(d.type==='wide'?'↔':'◷',d.x,d.y+5,17,'#172326');});
  label(`NIVEAU ${r.level}/3`,78,28,12,'#a99ec7');label('♥ '.repeat(r.lives),710,28,16,'#f6a393');if(r.serving){label('CLIQUE OU ESPACE POUR SERVIR',400,270,22,'#d7fc72');label('Attrape les bonus : raquette large et balle lente',400,305,13,'#b6b6ce');}
 }
 if(r.game==='memory'){
  const symbols=['✦','♣','♥','★','☀','◆','●','☂'],palette=['#d7fc72','#80cbae','#ffacac','#f9cd80','#e7aeef','#b0aaff','#8ccef5','#ffb580'];
  r.cards.forEach((c,i)=>{const x=152+i%4*124,y=22+Math.floor(i/4)*105,revealed=c.matched||r.flipped.includes(i)||time<r.previewUntil;round(x+2,y+4,110,92,12,'#0004');round(x,y,110,92,12,revealed?'#e6eee1':'#283347',c.matched?'#a1cf70':'#596481');if(revealed){label(symbols[c.value],x+55,y+61,39,c.matched?'#577344':palette[c.value]==='#d7fc72'?'#678631':palette[c.value]);if(c.matched)label('✓',x+91,y+19,13,'#678631');}else{round(x+8,y+8,94,76,8,null,'#7883a544');label('lf ✦',x+55,y+55,24,'#9faace');}});
  if(time<r.previewUntil)label('MÉMORISE LES CARTES…',400,455,12,'#d7fc72');
 }
 if(r.eventPoint&&view.eventAge<400&&!r.paused){const a=view.eventAge/400,p=r.eventPoint;ctx.globalAlpha=1-a;circle(p.x,p.y,8+a*35,null,r.event==='miss'?'#ed8176':'#d7fc72');for(let i=0;i<6;i++){const angle=i*Math.PI/3;circle(p.x+Math.cos(angle)*a*45,p.y+Math.sin(angle)*a*45,3*(1-a),'#d7fc72');}ctx.globalAlpha=1;}
 if(!r.started||r.countdown>0||r.paused||r.finished){ctx.fillStyle='#07101ac9';ctx.fillRect(0,0,800,460);let title=!r.started?'Une table, deux joueurs.':r.paused?'Pause':r.finished?(view.result||r.result||'Partie terminée'):String(Math.ceil(r.countdown/1000));label(title,400,220,r.finished?26:38,'#d7fc72');label(!r.started?'Invite un ami à rejoindre cette table.':r.paused?'Reprends quand tu es prêt.':r.finished?'Une revanche ?':'Prépare-toi !',400,264,16,'#acbbc9');}
 ctx.restore();
}
root.ArcadeRenderer={draw};
})(globalThis);
