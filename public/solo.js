/* Shared rules and physics for local games and the authoritative multiplayer server. */
(function (root) {
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  const sectors = [20,1,18,4,13,6,10,15,2,17,3,19,7,16,8,11,14,9,12,5];
  const settings = { easy: { ai: 3, speed: 4, snake: 170 }, normal: { ai: 4.5, speed: 5, snake: 140 }, hard: { ai: 6, speed: 6, snake: 110 } };
  const FIXED_MS = 1000 / 120;
  function finish(r, message, winner = 0) { r.finished = true; r.result = message; r.winner = winner; r.event = 'finish'; }
  function event(r, type, x, y) { r.event = type; r.eventId++; r.eventPoint = { x, y }; }
  function level(r) {
    r.bricks = Array.from({ length: 50 }, (_, i) => ({ x: 45 + i % 10 * 72, y: 48 + Math.floor(i / 10) * 29, hp: r.level > 1 && i < 20 ? 2 : 1, active: true }));
    r.ball = { x: r.paddle, y: 392, vx: 3, vy: -5 }; r.serving = true; r.combo = 0;
  }
  function create(game, options = {}) {
    const r = { game, id: 'SOLO', solo: options.solo !== false, difficulty: options.difficulty || 'normal', players: ['you', 'bot'], started: true, finished: false, paused: false, score: [0, 0], turn: 0, shots: 0, elapsed: 0, eventId: 0, event: '', message: '', countdown: 1200, paddles: [230, 230], ball: { x: 400, y: 230, vx: 5, vy: 1.5 }, trail: [] };
    if (!settings[r.difficulty]) r.difficulty = 'normal';
    if (game === 'pong') { r.rally = 0; r.bestRally = 0; }
    if (game === 'hockey') { r.mallets = [{ x: 140, y: 230 }, { x: 660, y: 230 }]; r.targets = r.mallets.map(p => ({ ...p })); r.mallets.forEach(m=>{m.vx=0;m.vy=0;}); r.ball = { x: 400, y: 230, vx: 0, vy: 0 }; }
    if (game === 'darts') { r.remaining = [301, 301]; r.volleyStart = 301; r.volley = 0; r.round = 1; r.throws = []; r.countdown = 0; r.doubleOut=options.doubleOut!==false; r.dartFlight=null; r.pendingVolley=false; r.turnHistory=[]; }
    if (game === 'pool') {
      r.cue = { x: 220, y: 230, vx: 0, vy: 0, active: true, n: 0 };
      r.balls = []; const numbers=[1,2,3,4,9,5,6,7,8]; let index=0;
      [1,2,3,2,1].forEach((count,col)=>{for(let row=0;row<count;row++)r.balls.push({x:500+col*21.1,y:230+(row-(count-1)/2)*24.4,vx:0,vy:0,active:true,n:numbers[index++],roll:0});});
      r.required=1; r.firstHit=null; r.railAfterHit=false; r.ballInHand=false; r.spin={x:0,y:0}; r.cueSpin=0; r.potted=[]; r.sinking=[];
      r.moving = false; r.pocketed = 0; r.scratch = false; r.countdown = 0;
    }
    if (game === 'snake') { r.snake = [{ x: 8, y: 9 }, { x: 7, y: 9 }, { x: 6, y: 9 }]; r.dir = { x: 1, y: 0 }; r.queue = []; r.food = { x: 16, y: 9 }; r.acc = 0; r.level = 1; }
    if (game === 'breakout') { r.paddle = 400; r.lives = 3; r.level = 1; r.drops = []; r.wideUntil = 0; r.slowUntil = 0; level(r); }
    if (game === 'memory') {
      r.cards = Array.from({ length: 16 }, (_, i) => ({ value: i % 8, matched: false }));
      for (let i = 15; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [r.cards[i], r.cards[j]] = [r.cards[j], r.cards[i]]; }
      r.flipped = []; r.moves = 0; r.hideAt = 0; r.previewUntil = 2200; r.countdown = 0; r.streak = 0;
    }
    return r;
  }
  function dartScore(x, y) {
    const d = Math.hypot(x - 400, y - 230), a = (Math.atan2(x - 400, 230 - y) + Math.PI * 2 + Math.PI / 20) % (Math.PI * 2);
    if (d > 180) return { points: 0, label: 'Raté', multiplier:0 };
    if (d <= 180*6.35/170) return { points: 50, label: 'Bullseye !', multiplier:2 };
    if (d <= 180*15.9/170) return { points: 25, label: 'Bull · 25', multiplier:1 };
    const value = sectors[Math.floor(a / (Math.PI * 2) * 20)], mult = d >= 180*162/170 ? 2 : d >= 180*99/170 && d <= 180*107/170 ? 3 : 1;
    return { points: value * mult, multiplier:mult, label: (mult === 3 ? 'Triple ' : mult === 2 ? 'Double ' : '') + value };
  }
  function nextVolley(r) {
    r.turnHistory.push({player:r.turn,remaining:r.remaining[r.turn],bust:r.busted||false}); r.turnHistory=r.turnHistory.slice(-8); r.busted=false; r.volley = 0; r.throws=[];
    if (!r.solo) r.turn = 1 - r.turn;
    if (r.solo || r.turn === 0) r.round++;
    r.volleyStart = r.remaining[r.turn];
    if (r.round > 10) {
      const winner = r.remaining[0] === r.remaining[1] ? -1 : r.remaining[0] < r.remaining[1] ? 0 : 1;
      finish(r, r.solo ? `Défi terminé · ${r.remaining[0]} points restants` : winner < 0 ? 'Égalité !' : 'Le meilleur score remporte le défi.', r.solo ? 0 : winner);
    }
  }
  function shot(r, x, y, power = 0.6, player = 0) {
    if (r.finished || r.paused || !r.started || r.countdown > 0 || (!r.solo && r.turn !== player && ['pool', 'darts'].includes(r.game))) return;
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    if (r.game === 'darts') {
      if(r.dartFlight||r.pendingVolley)return;
      const hit = dartScore(x, y); r.dartFlight={x,y,...hit,player,started:r.elapsed,lands:r.elapsed+420}; return;
    }
    if (r.game === 'pool' && !r.moving && !r.ballInHand) {
      const dx = x - r.cue.x, dy = y - r.cue.y, len = Math.hypot(dx, dy); if (len < 5) return;
      const speed = .6 + Math.pow(clamp(Number.isFinite(power) ? power : .6, 0, 1),1.25) * 19;
      r.cue.vx = dx / len * speed; r.cue.vy = dy / len * speed; r.moving = true; r.shots++; r.pocketed = 0; r.scratch = false; r.firstHit=null; r.railAfterHit=false; r.potted=[]; r.required=Math.min(...r.balls.filter(b=>b.active).map(b=>b.n)); r.cueSpin=r.spin.y*speed*.6; r.message = 'Billes en mouvement…'; event(r, 'cue', r.cue.x, r.cue.y);
    }
    if (r.game === 'breakout' && r.serving) { r.serving = false; event(r, 'launch', x, y); }
    if (r.game === 'memory') {
      if (r.elapsed < r.previewUntil || r.hideAt || r.flipped.length === 2) return;
      const col = Math.floor((x - 152) / 124), row = Math.floor((y - 22) / 105);
      if (col < 0 || col > 3 || row < 0 || row > 3 || (x - 152) % 124 > 110 || (y - 22) % 105 > 92) return;
      const i = row * 4 + col; if (r.cards[i].matched || r.flipped.includes(i)) return;
      r.flipped.push(i); event(r, 'flip', x, y);
      if (r.flipped.length === 2) {
        r.moves++; const [a, b] = r.flipped;
        if (r.cards[a].value === r.cards[b].value) {
          r.cards[a].matched = r.cards[b].matched = true; r.score[0]++; r.streak++; r.flipped = []; r.message = r.streak > 1 ? `Série de ${r.streak} paires !` : 'Paire trouvée !'; event(r, 'pair', x, y);
          if (r.score[0] === 8) finish(r, `8 paires · ${r.moves} essais · ${Math.floor(r.elapsed / 1000)} s`);
        } else { r.hideAt = r.elapsed + 900; r.streak = 0; r.message = 'Mémorise ces deux cartes…'; }
      }
    }
  }
  function direction(r, x, y) {
    if (r.game !== 'snake' || r.finished || r.queue.length >= 2) return;
    const d = r.queue.length ? r.queue[r.queue.length - 1] : r.dir;
    if (x === -d.x && y === -d.y || x === d.x && y === d.y) return;
    r.queue.push({ x, y });
  }
  function move(r, x, y, player = 0) {
    if (!Number.isFinite(x) || !Number.isFinite(y) || player < 0 || player > 1) return;
    r.paddles[player] = clamp(y, 62, 398);
    if (r.game === 'hockey') r.targets[player] = { x: clamp(x, player ? 434 : 52, player ? 748 : 366), y: clamp(y, 52, 408) };
    if (r.game === 'breakout') r.paddle = clamp(x, 70, 730);
  }
  function resolveDart(r) {
    const hit=r.dartFlight,player=hit.player;r.dartFlight=null;r.shots++;r.volley++;r.throws.push({...hit});r.lastShot={...hit};event(r,'dart',hit.x,hit.y);
    const left=r.remaining[player]-hit.points;
    if(left<0||(r.doubleOut&&(left===1||(left===0&&hit.multiplier!==2)))){
      r.remaining[player]=r.volleyStart;r.busted=true;r.message='BUST · volée annulée';r.pendingVolley=true;r.volleyAt=r.elapsed+1100;
    }else{r.remaining[player]=left;r.message=hit.label;if(left===0)finish(r,'301 ! Sortie réussie.',player);else if(r.volley===3){r.pendingVolley=true;r.volleyAt=r.elapsed+1100;}}
    r.score[player]=301-r.remaining[player];
  }
  function placeCue(r,x,y,player=0){
    if(r.game!=='pool'||!r.ballInHand||r.moving||r.finished||!r.started||(!r.solo&&r.turn!==player))return false;
    if(!Number.isFinite(x)||!Number.isFinite(y)||x<55||x>745||y<55||y>405)return false;
    if(r.balls.some(b=>b.active&&Math.hypot(b.x-x,b.y-y)<25))return false;
    r.cue={x,y,vx:0,vy:0,n:0,active:true,roll:0};r.ballInHand=false;r.message='Blanche placée · vise la bille '+r.required;return true;
  }
  function setSpin(r,x,y){if(r.game==='pool'&&!r.moving){r.spin={x:clamp(Number(x)||0,-1,1),y:clamp(Number(y)||0,-1,1)};}}
  function respot(r,b){
    for(let x=500;x>=70;x-=26)for(const y of [230,204,256,178,282,152,308]){
      if(![r.cue,...r.balls].some(o=>o!==b&&o.active&&Math.hypot(o.x-x,o.y-y)<25)){Object.assign(b,{x,y,vx:0,vy:0,active:true});return;}
    }
  }
  function settlePool(r){
    r.moving=false;
    let foul=r.scratch?'Blanche empochée':r.firstHit===null?'Aucune bille touchée':r.firstHit!==r.required?'Mauvaise première bille':!r.pocketed&&!r.railAfterHit?'Aucune bande après contact':null;
    const nine=r.balls.find(b=>b.n===9);
    if(nine&&!nine.active&&foul){respot(r,nine);r.score[r.turn]=Math.max(0,r.score[r.turn]-1);}
    if(nine&&!nine.active&&!foul){finish(r,r.solo?`9 empochée · ${r.shots} coups`:'La 9 est empochée légalement !',r.turn);return;}
    if(foul){
      if(!r.solo)r.turn=1-r.turn;
      r.cue.vx=r.cue.vy=0;r.ballInHand=true;r.message='Faute : '+foul+' · place la blanche sur la table.';
    }else{if(!r.solo&&!r.pocketed)r.turn=1-r.turn;r.message=r.pocketed?'Bille empochée · continue !':'À l’adversaire de jouer.';}
    const active=r.balls.filter(b=>b.active);r.required=active.length?Math.min(...active.map(b=>b.n)):0;r.cueSpin=0;
    if(!active.length&&!foul)finish(r,r.solo?`Table vidée en ${r.shots} coups !`:'Table vidée !',r.turn);
  }
  function poolStep(r, step) {
    r.sinking=r.sinking.filter(b=>r.elapsed-b.at<360);
    if(!r.moving)return;
    const balls=[r.cue,...r.balls].filter(b=>b.active);
    for(const b of balls){
      const speed=Math.hypot(b.vx,b.vy);b.x+=b.vx*step;b.y+=b.vy*step;b.roll=(b.roll||0)+speed*step/12;
      const pocket=[[34,34],[400,24],[766,34],[34,426],[400,436],[766,426]].find(([x,y])=>Math.hypot(b.x-x,b.y-y)<20);
      if(pocket){b.active=false;b.vx=b.vy=0;r.sinking.push({n:b.n,x:b.x,y:b.y,px:pocket[0],py:pocket[1],at:r.elapsed});event(r,'pocket',b.x,b.y);if(!b.n)r.scratch=true;else{r.pocketed++;r.potted.push(b.n);r.score[r.turn]++;}continue;}
      // Rounded pocket jaws prevent balls clipping through a pocket lip.
      for(const [x,y] of [[374,38],[426,38],[374,422],[426,422],[60,36],[36,60],[740,36],[764,60],[60,424],[36,400],[740,424],[764,400]]){
        const dx=b.x-x,dy=b.y-y,d=Math.hypot(dx,dy);if(d>0&&d<16){const nx=dx/d,ny=dy/d;b.x=x+nx*16;b.y=y+ny*16;const v=b.vx*nx+b.vy*ny;if(v<0){b.vx-=1.82*v*nx;b.vy-=1.82*v*ny;if(r.firstHit!==null)r.railAfterHit=true;}}
      }
      // Cushion openings are actual gaps; pocket jaws reflect grazing shots.
      const sideOpening=Math.abs(b.x-400)<20;
      const cornerOpening=(b.x<52||b.x>748)&&(b.y<52||b.y>408);
      let rail=false;
      if((b.x<50||b.x>750)&&!cornerOpening){b.x=clamp(b.x,50,750);b.vx*=-.82;rail=true;}
      if((b.y<50||b.y>410)&&!sideOpening&&!cornerOpening){b.y=clamp(b.y,50,410);b.vy*=-.82;rail=true;}
      if(b.x<22||b.x>778||b.y<12||b.y>448){b.x=clamp(b.x,22,778);b.y=clamp(b.y,12,448);b.vx*=-.75;b.vy*=-.75;rail=true;}
      if(rail){if(r.firstHit!==null)r.railAfterHit=true;if(b.n===0){const angle=r.spin.x*.12,vx=b.vx,vy=b.vy;b.vx=vx*Math.cos(angle)-vy*Math.sin(angle);b.vy=vx*Math.sin(angle)+vy*Math.cos(angle);}event(r,'cushion',b.x,b.y);}
      const drag=.065*step,v=Math.hypot(b.vx,b.vy);if(v<=drag){b.vx=b.vy=0;}else{b.vx*=1-drag/v;b.vy*=1-drag/v;}
    }
    // Iterative overlap correction resolves packed racks without creating energy.
    for(let iteration=0;iteration<3;iteration++)for(let i=0;i<balls.length;i++)for(let j=i+1;j<balls.length;j++){
      const a=balls[i],b=balls[j];if(!a.active||!b.active)continue;
      let dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy);if(d>=24)continue;if(d<.0001){dx=1;dy=0;d=.0001;}
      const nx=dx/(d<.001?1:d),ny=dy/(d<.001?1:d),overlap=(24-d+.001)/2;
      a.x-=nx*overlap;a.y-=ny*overlap;b.x+=nx*overlap;b.y+=ny*overlap;
      const rel=(a.vx-b.vx)*nx+(a.vy-b.vy)*ny;
      if(rel>0){const impulse=rel*.98;a.vx-=impulse*nx;a.vy-=impulse*ny;b.vx+=impulse*nx;b.vy+=impulse*ny;
        if(a.n===0||b.n===0){const object=a.n===0?b:a;if(r.firstHit===null){r.firstHit=object.n;const cue=r.cue,axis=a.n===0?1:-1;cue.vx+=nx*axis*r.cueSpin*.45;cue.vy+=ny*axis*r.cueSpin*.45;r.cueSpin=0;}}
        if(rel>.3)event(r,'ball',a.x,a.y);
      }
    }
    r.cueSpin*=Math.pow(.99,step);
    if(balls.every(b=>!b.active||Math.hypot(b.vx,b.vy)<.04)){balls.forEach(b=>{b.vx=b.vy=0;});settlePool(r);}
  }
  function goal(r, p) {
    r.score[p]++; event(r,'goal',400,230);
    if(r.score[p]>=7){finish(r,p===0?'Victoire !':'Adversaire vainqueur.',p);return;}
    r.ball={x:400,y:230,vx:r.game==='hockey'?0:(p?-5:5),vy:r.game==='hockey'?0:1.5};r.countdown=1000;r.rally=0;
    if(r.game==='hockey'){r.mallets=[{x:140,y:230,vx:0,vy:0},{x:660,y:230,vx:0,vy:0}];r.targets=r.mallets.map(m=>({...m}));r.ball.x=p===1?220:580; r.goalPause=true;}
  }
  function arenaStep(r, step) {
    const b=r.ball,s=settings[r.difficulty];
    if(r.game==='pong') {
      if(r.solo){const target=b.vx>0?b.y+Math.sin(r.elapsed/600)*18:230;r.paddles[1]+=clamp(target-r.paddles[1],-s.ai*step,s.ai*step);}
      b.x+=b.vx*step;b.y+=b.vy*step;
      if(b.y<18||b.y>442){b.y=clamp(b.y,18,442);b.vy*=-1;event(r,'wall',b.x,b.y);}
      [0,1].forEach(p=>{if(Math.abs(b.x-(p?750:50))<20&&Math.abs(b.y-r.paddles[p])<61&&((p===0&&b.vx<0)||(p===1&&b.vx>0))){const speed=Math.min(12,Math.hypot(b.vx,b.vy)+.4),angle=(b.y-r.paddles[p])/61*1.05;b.vx=(p?-1:1)*speed*Math.cos(angle);b.vy=speed*Math.sin(angle);b.x=p?729:71;r.rally++;r.bestRally=Math.max(r.bestRally,r.rally);event(r,'paddle',b.x,b.y);}});
      if(b.x<0||b.x>800)goal(r,b.x<0?1:0);
    } else {
      if(r.solo){
        const m=r.mallets[1],attack=b.x>420&&Math.hypot(b.vx,b.vy)<7;
        r.targets[1]=attack?{x:clamp(b.x+28,434,710),y:clamp(b.y,52,408)}:{x:b.x>400?650:680,y:clamp(230+(b.y-230)*.65,74,386)};
      }
      r.mallets.forEach((m,p)=>{
        const t=r.targets[p],dx=t.x-m.x,dy=t.y-m.y,d=Math.hypot(dx,dy),max=p===1&&r.solo?s.ai+3:16;
        // Responsive movement with an acceleration limit; no abrupt velocity spikes.
        const wanted=d>0?Math.min(max,d*.65):0,wx=d?dx/d*wanted:0,wy=d?dy/d*wanted:0;
        m.vx=(m.vx||0)+clamp(wx-(m.vx||0),-3*step,3*step);m.vy=(m.vy||0)+clamp(wy-(m.vy||0),-3*step,3*step);
        const oldX=m.x,oldY=m.y;m.x=clamp(m.x+m.vx*step,p?434:52,p?748:366);m.y=clamp(m.y+m.vy*step,52,408);
        m.vx=(m.x-oldX)/step;m.vy=(m.y-oldY)/step;
      });
      b.x+=b.vx*step;b.y+=b.vy*step;
      r.mallets.forEach(m=>{
        let dx=b.x-m.x,dy=b.y-m.y,d=Math.hypot(dx,dy);if(d>=42)return;
        if(d<.0001){dx=m.x<400?1:-1;dy=0;d=1;}
        const nx=dx/d,ny=dy/d,px=m.x+nx*42.01,py=m.y+ny*42.01;
        const mouth=py>177&&py<283;
        const blocked=py<43||py>417||(!mouth&&(px<43||px>757))||r.mallets.some(other=>other!==m&&Math.hypot(px-other.x,py-other.y)<42);
        // A squeezed puck must stop the mallet, not be pushed through a wall or another mallet.
        if(blocked){m.x=b.x-nx*42.01;m.y=b.y-ny*42.01;m.vx=m.vy=0;return;}
        b.x=px;b.y=py;
        const approach=(b.vx-m.vx)*nx+(b.vy-m.vy)*ny;
        if(approach<0){b.vx-=1.88*approach*nx;b.vy-=1.88*approach*ny;const speed=Math.hypot(b.vx,b.vy);if(speed>20){b.vx*=20/speed;b.vy*=20/speed;}if(approach<-.5)event(r,'paddle',b.x,b.y);}
      });
      b.vx*=Math.pow(.9993,step);b.vy*=Math.pow(.9993,step);
      // Goal posts are circles, so the puck cannot score through their edges.
      for(const x of [30,770])for(const y of [158,302]){
        const dx=b.x-x,dy=b.y-y,d=Math.hypot(dx,dy);if(d>0&&d<19){const nx=dx/d,ny=dy/d;b.x=x+nx*19;b.y=y+ny*19;const v=b.vx*nx+b.vy*ny;if(v<0){b.vx-=1.9*v*nx;b.vy-=1.9*v*ny;event(r,'wall',b.x,b.y);}}
      }
      if(b.y<43||b.y>417){b.y=clamp(b.y,43,417);b.vy=-b.vy*.96;event(r,'wall',b.x,b.y);}
      const inGoal=b.y>177&&b.y<283;
      if(!inGoal&&(b.x<43||b.x>757)){b.x=clamp(b.x,43,757);b.vx=-b.vx*.96;event(r,'wall',b.x,b.y);}
      if(inGoal&&(b.x<15||b.x>785)){goal(r,b.x<15?1:0);return;}
      if(Math.hypot(b.vx,b.vy)<.03)b.vx=b.vy=0;
    }
  }
  function breakoutStep(r,step) {
    const b=r.ball;if(r.serving){b.x=r.paddle;b.y=392;return;}
    const old={x:b.x,y:b.y};const slow=r.elapsed<r.slowUntil ? .65 : 1;b.x+=b.vx*step*slow;b.y+=b.vy*step*slow;
    if(b.x<12||b.x>788){b.x=clamp(b.x,12,788);b.vx*=-1;event(r,'wall',b.x,b.y);}if(b.y<14){b.y=14;b.vy=Math.abs(b.vy);}
    const width=r.elapsed<r.wideUntil?90:60;
    if(b.vy>0&&old.y<=402&&b.y>=402&&Math.abs(b.x-r.paddle)<width+9){const a=clamp((b.x-r.paddle)/width,-1,1)*1.05,speed=Math.min(10,Math.hypot(b.vx,b.vy)+.1);b.vy=-Math.cos(a)*speed;b.vx=Math.sin(a)*speed;b.y=401;r.combo=0;event(r,'paddle',b.x,b.y);}
    const brick=r.bricks.find(t=>t.active&&b.x>=t.x-9&&b.x<=t.x+71&&b.y>=t.y-9&&b.y<=t.y+30);
    if(brick){brick.hp--;if(!brick.hp){brick.active=false;r.combo++;r.score[0]+=10+Math.min(50,r.combo*2);if((r.bricks.filter(b=>!b.active).length)%7===0)r.drops.push({x:brick.x+31,y:brick.y,type:r.drops.length%2?'slow':'wide'});}if(old.x<brick.x-9||old.x>brick.x+71)b.vx*=-1;else b.vy*=-1;event(r,'brick',b.x,b.y);if(r.bricks.every(b=>!b.active)){if(r.level===3){finish(r,`3 niveaux terminés · ${r.score[0]} points !`);return;}r.level++;level(r);r.message=`Niveau ${r.level} · clique pour servir`;}}
    r.drops=r.drops.filter(d=>{d.y+=2*step;if(d.y>400&&Math.abs(d.x-r.paddle)<width){if(d.type==='wide')r.wideUntil=r.elapsed+12000;else r.slowUntil=r.elapsed+10000;r.message=d.type==='wide'?'Raquette élargie !':'Balle ralentie !';event(r,'bonus',d.x,d.y);return false;}return d.y<460;});
    if(b.y>475){r.lives--;event(r,'miss',b.x,450);if(!r.lives)finish(r,`Fin de partie · ${r.score[0]} points`);else{r.serving=true;r.ball={x:r.paddle,y:392,vx:3,vy:-5};r.message='Une vie perdue · clique pour servir';}}
  }
  function stepTick(r,ms) {
    if(r.finished||r.paused||!r.started)return;
    r.elapsed+=ms;
    if(r.countdown>0){r.countdown=Math.max(0,r.countdown-ms);return;}
    if(r.game==='darts'){if(r.dartFlight&&r.elapsed>=r.dartFlight.lands)resolveDart(r);if(r.pendingVolley&&r.elapsed>=r.volleyAt){r.pendingVolley=false;nextVolley(r);}}
    if(r.game==='memory'&&r.hideAt&&r.elapsed>=r.hideAt){r.flipped=[];r.hideAt=0;}
    if(r.game==='snake'){
      r.acc+=ms;const interval=Math.max(65,settings[r.difficulty].snake-r.score[0]*3);
      if(r.acc>=interval){r.acc-=interval;if(r.queue.length)r.dir=r.queue.shift();const h={x:r.snake[0].x+r.dir.x,y:r.snake[0].y+r.dir.y},eat=h.x===r.food.x&&h.y===r.food.y;
        if(h.x<0||h.x>=32||h.y<0||h.y>=18||(eat?r.snake:r.snake.slice(0,-1)).some(p=>p.x===h.x&&p.y===h.y)){finish(r,`Fin de partie · ${r.score[0]} fruits`);return;}
        r.snake.unshift(h);if(eat){r.score[0]++;r.level=1+Math.floor(r.score[0]/5);event(r,'fruit',h.x*25+12,h.y*25+17);if(r.snake.length===576){finish(r,'Grille remplie !');return;}do{r.food={x:Math.floor(Math.random()*32),y:Math.floor(Math.random()*18)};}while(r.snake.some(p=>p.x===r.food.x&&p.y===r.food.y));}else r.snake.pop();
      }
    }
    // Substeps prevent fast balls passing through cushions, paddles and bricks.
    for(let remaining=ms;remaining>0;){const dt=Math.min(remaining,1000/120),step=dt/(1000/30);remaining-=dt;if(r.game==='pool')poolStep(r,step);if(['pong','hockey'].includes(r.game))arenaStep(r,step);if(r.game==='breakout')breakoutStep(r,step);if(r.finished||r.countdown>0)break;}
    if(r.ball){r.trail.push({x:r.ball.x,y:r.ball.y});r.trail=r.trail.slice(-10);}
  }
  function tick(r,ms){
    if(r.finished||r.paused||!r.started||!Number.isFinite(ms))return;
    r.accumulator=(r.accumulator||0)+clamp(ms,0,250);
    while(r.accumulator+1e-8>=FIXED_MS){r.accumulator-=FIXED_MS;stepTick(r,FIXED_MS);if(r.finished)break;}
  }
  const api={create,shot,move,direction,tick,dartScore,placeCue,setSpin};if(typeof module!=='undefined')module.exports=api;else root.Solo=api;
})(globalThis);
