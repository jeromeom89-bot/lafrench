/* Shared rules and physics for local games and the authoritative multiplayer server. */
(function (root) {
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  const sectors = [20,1,18,4,13,6,10,15,2,17,3,19,7,16,8,11,14,9,12,5];
  const settings = { easy: { ai: 3, speed: 4, snake: 170 }, normal: { ai: 4.5, speed: 5, snake: 140 }, hard: { ai: 6, speed: 6, snake: 110 } };
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
    if (game === 'hockey') { r.mallets = [{ x: 140, y: 230 }, { x: 660, y: 230 }]; r.targets = r.mallets.map(p => ({ ...p })); r.ball = { x: 400, y: 230, vx: 0, vy: 0 }; }
    if (game === 'darts') { r.remaining = [301, 301]; r.volleyStart = 301; r.volley = 0; r.round = 1; r.throws = []; r.countdown = 0; }
    if (game === 'pool') {
      r.cue = { x: 220, y: 230, vx: 0, vy: 0, active: true, n: 0 };
      r.balls = []; let n = 1;
      for (let col = 0; col < 4; col++) for (let row = 0; row <= col; row++) if (n <= 9) r.balls.push({ x: 500 + col * 23, y: 230 + (row - col / 2) * 26, vx: 0, vy: 0, active: true, n: n++ });
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
    if (d > 180) return { points: 0, label: 'Raté' };
    if (d < 10) return { points: 50, label: 'Bullseye !' };
    if (d < 23) return { points: 25, label: 'Bull · 25' };
    const value = sectors[Math.floor(a / (Math.PI * 2) * 20)], mult = d > 165 ? 2 : d > 100 && d < 113 ? 3 : 1;
    return { points: value * mult, label: (mult === 3 ? 'Triple ' : mult === 2 ? 'Double ' : '') + value };
  }
  function nextVolley(r) {
    r.volley = 0;
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
      const hit = dartScore(x, y); r.shots++; r.volley++; r.throws.push({ x, y, ...hit }); r.throws = r.throws.slice(-3); r.lastShot = { x, y, ...hit };
      event(r, 'dart', x, y);
      if (r.remaining[player] - hit.points < 0) { r.remaining[player] = r.volleyStart; r.message = 'BUST · volée annulée'; nextVolley(r); }
      else { r.remaining[player] -= hit.points; r.score[player] = 301 - r.remaining[player]; r.message = hit.label; if (!r.remaining[player]) finish(r, '301 ! Défi remporté.', player); else if (r.volley === 3) nextVolley(r); }
      r.score[player] = 301 - r.remaining[player];
    }
    if (r.game === 'pool' && !r.moving) {
      const dx = x - r.cue.x, dy = y - r.cue.y, len = Math.hypot(dx, dy); if (len < 5) return;
      const speed = 3 + clamp(Number.isFinite(power) ? power : .6, 0, 1) * 13;
      r.cue.vx = dx / len * speed; r.cue.vy = dy / len * speed; r.moving = true; r.shots++; r.pocketed = 0; r.scratch = false; r.message = 'Billes en mouvement…'; event(r, 'cue', r.cue.x, r.cue.y);
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
    if (r.game === 'hockey') r.targets[player] = { x: clamp(x, player ? 440 : 45, player ? 755 : 360), y: clamp(y, 45, 415) };
    if (r.game === 'breakout') r.paddle = clamp(x, 70, 730);
  }
  function poolStep(r, step) {
    if (!r.moving) return;
    const balls = [r.cue, ...r.balls].filter(b => b.active);
    for (const b of balls) {
      b.x += b.vx * step; b.y += b.vy * step;
      const pocket = [[34,34],[400,24],[766,34],[34,426],[400,436],[766,426]].some(([x,y]) => Math.hypot(b.x-x,b.y-y) < 23);
      if (pocket) { b.active = false; b.vx = b.vy = 0; event(r, 'pocket', b.x, b.y); if (!b.n) r.scratch = true; else { r.pocketed++; r.score[r.turn]++; } continue; }
      if (b.x < 42 || b.x > 758) { b.x = clamp(b.x,42,758); b.vx *= -.88; }
      if (b.y < 42 || b.y > 418) { b.y = clamp(b.y,42,418); b.vy *= -.88; }
      b.vx *= Math.pow(.987, step); b.vy *= Math.pow(.987, step);
      if (Math.hypot(b.vx,b.vy) < .11) b.vx = b.vy = 0;
    }
    for (let i=0;i<balls.length;i++) for(let j=i+1;j<balls.length;j++) {
      const a=balls[i],b=balls[j]; if(!a.active||!b.active)continue;
      const dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy); if(d>=24||d<.001)continue;
      const nx=dx/d,ny=dy/d,overlap=(24-d)/2; a.x-=nx*overlap;a.y-=ny*overlap;b.x+=nx*overlap;b.y+=ny*overlap;
      const impulse=(a.vx-b.vx)*nx+(a.vy-b.vy)*ny;if(impulse>0){a.vx-=impulse*nx;a.vy-=impulse*ny;b.vx+=impulse*nx;b.vy+=impulse*ny;event(r,'ball',a.x,a.y);}
    }
    if (balls.every(b=>!b.active||Math.hypot(b.vx,b.vy)<.11)) {
      r.moving=false;
      if (r.scratch) { r.cue={x:220,y:230,vx:0,vy:0,active:true,n:0};for(let i=0;i<20&&r.balls.some(b=>b.active&&Math.hypot(b.x-r.cue.x,b.y-r.cue.y)<26);i++)r.cue.y=55+i*17;r.message='Faute : blanche empochée. Main à l’adversaire.'; }
      else r.message=r.pocketed?`${r.pocketed} bille(s) empochée(s) · rejoue !`:'Aucune bille empochée · changement de tour.';
      if(!r.solo&&(!r.pocketed||r.scratch))r.turn=1-r.turn;
      if(r.balls.every(b=>!b.active)){const winner=r.score[0]===r.score[1]?-1:r.score[0]>r.score[1]?0:1;finish(r,r.solo?`Table vidée en ${r.shots} coups !`:'Table vidée !',r.solo?0:winner);}
    }
  }
  function goal(r, p) {
    r.score[p]++; event(r,'goal',400,230);
    if(r.score[p]>=7){finish(r,p===0?'Victoire !':'Adversaire vainqueur.',p);return;}
    r.ball={x:400,y:230,vx:r.game==='hockey'?0:(p?-5:5),vy:r.game==='hockey'?0:1.5};r.countdown=1000;r.rally=0;
    if(r.game==='hockey'){r.mallets=[{x:p===1?300:140,y:230},{x:p===0?500:660,y:230}];r.targets=r.mallets.map(m=>({...m}));r.ball.x=p===1?280:520;}
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
      if(r.solo){r.targets[1]={x:b.x>390?clamp(b.x+35,445,740):650,y:clamp(b.y+Math.sin(r.elapsed/800)*15,45,415)};}
      r.mallets.forEach((m,p)=>{const old={...m},t=r.targets[p],dx=t.x-m.x,dy=t.y-m.y,len=Math.hypot(dx,dy),speed=(p===1&&r.solo?s.ai+2:12)*step;if(len>0){m.x+=dx/len*Math.min(len,speed);m.y+=dy/len*Math.min(len,speed);}const vx=(m.x-old.x)/step,vy=(m.y-old.y)/step,ax=b.x-m.x,ay=b.y-m.y,d=Math.hypot(ax,ay);if(d<43&&d>.01){const nx=ax/d,ny=ay/d;b.x=m.x+nx*43;b.y=m.y+ny*43;const rel=(b.vx-vx)*nx+(b.vy-vy)*ny;if(rel<0){b.vx-=1.8*rel*nx;b.vy-=1.8*rel*ny;const v=Math.hypot(b.vx,b.vy);if(v>15){b.vx*=15/v;b.vy*=15/v;}event(r,'paddle',b.x,b.y);}}});
      b.x+=b.vx*step;b.y+=b.vy*step;b.vx*=Math.pow(.997,step);b.vy*=Math.pow(.997,step);
      if(b.y<28||b.y>432){b.y=clamp(b.y,28,432);b.vy*=-1;event(r,'wall',b.x,b.y);}
      if(b.x<25||b.x>775){if(b.y>158&&b.y<302){goal(r,b.x<25?1:0);return;}b.x=clamp(b.x,25,775);b.vx*=-1;event(r,'wall',b.x,b.y);}
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
  function tick(r,ms) {
    if(r.finished||r.paused||!r.started)return;
    ms=clamp(ms,0,100);r.elapsed+=ms;
    if(r.countdown>0){r.countdown=Math.max(0,r.countdown-ms);return;}
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
  const api={create,shot,move,direction,tick,dartScore};if(typeof module!=='undefined')module.exports=api;else root.Solo=api;
})(globalThis);
