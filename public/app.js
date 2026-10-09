const $=s=>document.querySelector(s), labels={pool:'Billard',darts:'Fléchettes',hockey:'Air hockey',pong:'Ping-pong',snake:'Snake',breakout:'Casse-briques',memory:'Memory'};
const snapshots=new ArcadeNetwork.Snapshots();
let localTarget=null, hockeyDrag=null, autoPausedGame=null;
let mode="multi", soloTimer, aim={x:500,y:230}, charging=false, chargeStart=0, audio, soundOn=localStorage.getItem("lf-sound")==="yes", previousEvent=-1, effectStart=0, recorded=false;
let socket, myId, users=[], rooms=[], current, name=localStorage.getItem('lf-name'), friends=JSON.parse(localStorage.getItem('lf-friends')||'[]');
const toast=t=>{ $('#toast').textContent=t;$('#toast').style.display='block';clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('#toast').style.display='none',3500); };
function send(m){if(socket?.readyState===1)socket.send(JSON.stringify(m));else toast('Connexion au club indisponible.');}
function el(tag,text,cls){const e=document.createElement(tag);e.textContent=text;if(cls)e.className=cls;return e;}
let savedPageScroll=null;
function openGameDialog(){
 const dialog=$('#game-dialog');if(dialog.open)return;
 if(!savedPageScroll)savedPageScroll={x:window.scrollX,y:window.scrollY};
 document.documentElement.style.setProperty('--game-scroll-x',`${-savedPageScroll.x}px`);
 document.documentElement.style.setProperty('--game-scroll-y',`${-savedPageScroll.y}px`);
 document.documentElement.classList.add('game-open');dialog.showModal();requestAnimationFrame(fitArena);
}
function syncGameViewport(){const v=window.visualViewport;document.documentElement.style.setProperty('--game-height',`${v?v.height:window.innerHeight}px`);}
function fitArena(){
 const board=$('#board'),stage=$('#arena-stage');if(!$('#game-dialog').open)return;
 const bounds=stage.getBoundingClientRect();if(bounds.width<1||bounds.height<1)return;
 const rotate=current?.game==='hockey'&&bounds.height>bounds.width;
 board.dataset.rotation=rotate?(player()===1?'right':'left'):'none';
 const width=Math.max(1,rotate?Math.min(bounds.height,bounds.width*800/460):Math.min(bounds.width,bounds.height*800/460));
 board.style.width=width+'px';board.style.height=(width*460/800)+'px';
}
$('#game-dialog').addEventListener('close',()=>{
 if($('#game-dialog').open)return;
 document.documentElement.classList.remove('game-open');
 document.documentElement.style.removeProperty('--game-scroll-x');document.documentElement.style.removeProperty('--game-scroll-y');
 if(savedPageScroll){const s=savedPageScroll;savedPageScroll=null;window.scrollTo(s.x,s.y);}
});
new ResizeObserver(()=>fitArena()).observe($('#arena-stage'));
window.addEventListener('resize',()=>{syncGameViewport();fitArena();});
window.visualViewport?.addEventListener('resize',()=>{syncGameViewport();fitArena();});syncGameViewport();
// Prevent scroll chaining, including on mobile Safari. Help text and native controls keep their own gestures.
$('#game-dialog').addEventListener('touchmove',e=>{if(!e.target.closest('input,select,button,.game-help')&&e.cancelable)e.preventDefault();},{passive:false});
$('#game-dialog').addEventListener('wheel',e=>{if(!e.target.closest('.game-help')&&e.cancelable)e.preventDefault();},{passive:false});
function connect(){socket=new WebSocket(`${location.protocol==='https:'?'wss':'ws'}://${location.host}`);socket.onopen=()=>{ $('#connection').textContent='● En ligne';if(name)send({type:'join',name});else $('#identity').showModal();};socket.onclose=()=>{$('#connection').textContent='Reconnexion…';if(!current?.solo){current=null;if($('#game-dialog').open)$('#game-dialog').close();}setTimeout(connect,2000);};socket.onmessage=e=>{const m=JSON.parse(e.data);if(m.type==='hello')myId=m.id;if(m.type==='lobby'){users=m.users;rooms=m.rooms;renderLobby(m.ranks);}if(m.type==='chat'){const row=el('div','','message');row.append(el('b',m.name),el('p',m.text));$('#messages').append(row);while($('#messages').children.length>100)$('#messages').firstChild.remove();$('#messages').scrollTop=$('#messages').scrollHeight;}if(m.type==='entered'){snapshots.clear();localTarget=null;hockeyDrag=null;autoPausedGame=null;if(!$('#game-dialog').open)openGameDialog();}if(m.type==='state'&&!current?.solo){current=m.room;snapshots.push(current,performance.now());renderGame();}};}
$('#identity-form').onsubmit=e=>{e.preventDefault();name=$('#name-input').value.trim();if(!name)return;localStorage.setItem('lf-name',name);send({type:'join',name});$('#name-input').blur();$('#identity').close();$('#profile').textContent=name[0].toUpperCase();};$('#identity').addEventListener('cancel',e=>e.preventDefault());$('#profile').onclick=()=>toast(`Profil invité : ${name||'Joueur'}`);if(name)$('#profile').textContent=name[0].toUpperCase();
$('#chat-form').onsubmit=e=>{e.preventDefault();const text=$('#chat-input').value.trim();if(text){send({type:'chat',text});$('#chat-input').value='';}};
function setMode(value){mode=value;$('#quick-play').firstChild.textContent=value==='solo'?'Jouer contre le robot ':'Trouver une partie ';['solo','multi'].forEach(v=>{const b=$('#mode-'+v);b.classList.toggle('active',v===value);b.setAttribute('aria-pressed',v===value);});$('#mode-description').textContent=value==='solo'?'Entraîne-toi ou affronte le robot. Records sur cet appareil.':'Ouvre une table pour jouer à deux.';document.querySelectorAll('.game-card:not([data-solo-only]) .game-meta').forEach(m=>m.firstChild.textContent=value==='solo'?'✦ Solo ':'◉ 2 joueurs ');}
$('#mode-solo').onclick=()=>setMode('solo');$('#mode-multi').onclick=()=>setMode('multi');
function startSolo(game){if(socket?.readyState===1)send({type:'leave'});current=Solo.create(game,{difficulty:$('#difficulty').value,doubleOut:$('#dart-rule').value==='double'});charging=false;localTarget=null;hockeyDrag=null;autoPausedGame=null;canvas.classList.remove('dragging');snapshots.clear();previousEvent=-1;recorded=false;aim={x:500,y:230};$('#pool-side').value='0';$('#pool-follow').value='0';openGameDialog();renderGame();}
function saveRecord(){const r=current;if(!r?.solo||!r.finished||recorded)return;recorded=true;const key='lf-v3-record-'+r.game+'-'+r.difficulty,old=Number(localStorage.getItem(key)||0),value=r.game==='memory'?r.moves:r.game==='pool'?r.shots:r.score[0];if(!old||(['memory','pool'].includes(r.game)?value<old:value>old))localStorage.setItem(key,String(value));}
document.querySelectorAll('[data-game]').forEach(b=>b.onclick=()=>mode==='solo'||b.dataset.soloOnly?startSolo(b.dataset.game):send({type:'create',game:b.dataset.game,doubleOut:$('#dart-rule').value==='double'}));
$('#quick-play').onclick=()=>{if(mode==='solo'){startSolo('pong');return;}const r=rooms.find(r=>r.players===1);send(r?{type:'enter',id:r.id}:{type:'create',game:'pong'});};
document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{document.querySelectorAll('[data-tab]').forEach(x=>x.classList.toggle('active',x===b));['arcade','ranking','friends'].forEach(t=>$(`#${t}-view`).hidden=t!==b.dataset.tab);$('#page-label').textContent={arcade:'ARCADE',ranking:'CLASSEMENT',friends:'MES AMIS'}[b.dataset.tab];});
function playerRow(u,withButton=true){const row=el('div','','player-row');row.append(el('span',u.name[0].toUpperCase(),'avatar'));const info=el('div',u.name+(u.id===myId?' (toi)':''));info.append(el('small',u.room?'En partie':'Dans le salon'));row.append(info);if(withButton&&u.id!==myId){const b=el('button',friends.includes(u.name)?'✓ Ami':'+ Ami','secondary');b.onclick=()=>{friends=friends.includes(u.name)?friends.filter(n=>n!==u.name):[...friends,u.name];localStorage.setItem('lf-friends',JSON.stringify(friends));renderPlayers();};row.append(b);}return row;}
function renderPlayers(){$('#players').replaceChildren(...users.map(u=>playerRow(u)));$('#friends-list').replaceChildren();friends.forEach(n=>{const u=users.find(u=>u.name===n);const row=playerRow(u||{name:n,id:'offline'},false);if(!u)row.querySelector('small').textContent='Hors ligne';const b=el('button','Retirer','secondary');b.onclick=()=>{friends=friends.filter(f=>f!==n);localStorage.setItem('lf-friends',JSON.stringify(friends));renderPlayers();};row.append(b);$('#friends-list').append(row);});if(!friends.length)$('#friends-list').append(el('div','Ton équipe attend ses premiers joueurs. Ajoute un ami dans le salon.','empty'));}
function renderLobby(ranks){$('#online-count').textContent=users.length;$('#players-count').textContent=users.length;$('#room-count').textContent=rooms.filter(r=>r.players===1).length;renderPlayers();$('#rooms').replaceChildren();rooms.forEach(r=>{const row=el('div','','room-row');row.append(el('span','◈','avatar'),el('div',`${labels[r.game]} · ${r.host} · ${r.players}/2`));const b=el('button',r.players===1?'Rejoindre ↗':'Complète','secondary');b.disabled=r.players===2;b.onclick=()=>send({type:'enter',id:r.id});row.append(b);$('#rooms').append(row);});if(!rooms.length)$('#rooms').append(el('div','Le club est à toi. Choisis un jeu pour ouvrir la première table et invite un ami.','empty'));$('#ranking').replaceChildren();ranks.forEach((r,i)=>{const row=el('div','','rank-row');row.append(el('span',String(i+1).padStart(2,'0'),'avatar'),el('span',r.name),el('b',`${r.wins} victoire${r.wins>1?'s':''}`));$('#ranking').append(row);});if(!ranks.length)$('#ranking').append(el('div','Le podium attend ses champions. Termine une partie pour apparaître ici.','empty'));}
function leave(){charging=false;localTarget=null;hockeyDrag=null;autoPausedGame=null;canvas.classList.remove('dragging');snapshots.clear();held.clear();if(document.fullscreenElement)document.exitFullscreen().catch(()=>{});if(!current?.solo)send({type:'leave'});current=null;$('#game-dialog').close();}$('#leave-game').onclick=leave;$('#game-dialog').addEventListener('cancel',e=>{e.preventDefault();leave();});$('#rematch').onclick=()=>{if(current?.solo){const game=current.game;$('#game-dialog').close();startSolo(game);}else send({type:'rematch'});};
const canvas=$('#board'),ctx=canvas.getContext('2d');
const instructions={
 pool:'9-ball : touche d’abord la plus petite bille. Empoche la 9 légalement pour gagner. Après une faute, clique pour placer la blanche. Maintiens pour doser ; règle l’effet avant le tir.',
 darts:'301 : trois fléchettes par volée. Maintiens pour stabiliser, relâche pour lancer. En double final, termine sur un double (ou bull 50). Dépasser zéro ou laisser 1 annule la volée.',
 pong:'Souris, doigt ou ↑ ↓ : contrôle ta raquette. Les frappes sur les bords changent l’angle. Premier à 7 points.',
 hockey:'Maintiens ton maillet bleu ou rouge et glisse pour le déplacer. Il reste sous ton doigt ou ta souris. Relâche pour le poser. Flèches disponibles sur PC. Premier à 7.',
 snake:'Flèches, ZQSD/WASD, balayage ou boutons : mange les fruits. La vitesse augmente. Évite les murs et ton corps.',
 breakout:'Souris, doigt ou ← → pour bouger. Clique ou Espace pour servir. 3 niveaux, 3 vies, bonus de raquette et ralentissement.',
 memory:'Mémorise l’aperçu, puis retourne deux cartes. Retrouve les 8 paires avec le moins d’essais. Les séries de paires sont affichées.'
};
function player(){return current?.solo?0:current?.players.indexOf(myId)||0;}
function aimPoint(){if(current?.game!=='darts')return aim;const t=performance.now()/1000,held=charging?(performance.now()-chargeStart):0,stable=held>420&&held<820,amp=stable?.8:current?.difficulty==='easy'?2:current?.difficulty==='hard'?6:4;return{x:aim.x+Math.sin(t*4.1)*amp,y:aim.y+Math.cos(t*3.3)*amp};}
function power(){return charging?Math.min(1,(performance.now()-chargeStart)/1100):.45;}
function renderGame(){
 const r=current;if(!r)return;const p=player(),names=r.solo?[name||'Toi','Robot']:r.players.map(id=>users.find(u=>u.id===id)?.name||'Joueur');
 const layoutKey=r.game+':'+p;if($('#game-dialog').dataset.layout!==layoutKey){$('#game-dialog').dataset.layout=layoutKey;requestAnimationFrame(fitArena);}
 $('#game-title').textContent=labels[r.game];$('#table-id').textContent=r.solo?'SOLO · '+{easy:'DÉTENTE',normal:'NORMAL',hard:'EXPERT'}[r.difficulty]:r.id;
 let status=!r.started?'En attente du deuxième joueur…':r.finished?(r.solo?r.result:r.winner<0?'Égalité !':`${names[r.winner]} gagne !`):`${names[0]} ${r.score[0]} — ${r.score[1]} ${names[1]}`;
 if(r.started&&!r.finished){
  if(r.game==='darts')status=`${r.solo?'Toi':names[r.turn]} · ${r.remaining[r.turn]} restants · volée ${r.round}/10 · tir ${Math.min(3,r.volley+1)}/3${r.dartFlight?' · en vol':r.pendingVolley?' · fin de volée':''}`;
  else if(r.game==='pool')status=`${r.solo?'9-ball solo':names[r.turn]+' joue'} · cible : ${r.required} · ${r.shots} coups${r.ballInHand?' · place la blanche':r.moving?' · billes en mouvement':''}`;
  else if(r.game==='snake')status=`${r.score[0]} fruits · niveau ${r.level} · ${Math.floor(r.elapsed/1000)} s`;
  else if(r.game==='breakout')status=`${r.score[0]} points · ${r.lives} vies · niveau ${r.level}/3 · combo ×${r.combo}`;
  else if(r.game==='memory')status=`${r.score[0]}/8 paires · ${r.moves} essais · ${Math.floor(r.elapsed/1000)} s`;
 }
 if($('#match-info').textContent!==status)$('#match-info').textContent=status;
 $('#game-feedback').textContent=r.message||'';$('#pause-game').hidden=!r.solo||r.finished;$('#pause-game').textContent=r.paused?'Reprendre':'Pause';
 $('#solo-record').hidden=!r.solo;$('#solo-record').textContent='Record personnel ('+{easy:'détente',normal:'normal',hard:'expert'}[r.difficulty]+') : '+(localStorage.getItem('lf-v3-record-'+r.game+'-'+r.difficulty)||'—');
 $('#snake-controls').hidden=r.game!=='snake';$('#rematch').hidden=!r.finished;$('#instructions').textContent=instructions[r.game]+(r.game==='darts'?' · Règle : '+(r.doubleOut?'double final':'sortie libre'):'');
 $('#pool-controls').hidden=r.game!=='pool'||r.finished;$('#pool-target').textContent=r.game==='pool'?'Première bille : '+r.required+(r.ballInHand?' · blanche en main':''):'';
 const aiming=['pool','darts'].includes(r.game)&&r.started&&!r.finished;
 $('#shot-controls').hidden=!aiming;$('#shoot-game').disabled=r.paused||r.moving||r.ballInHand||r.dartFlight||r.pendingVolley||(!r.solo&&r.turn!==p);
 $('#power-fill').style.width=(power()*100)+'%';$('#power-fill').classList.toggle('sweet',r.game==='darts'&&charging&&performance.now()-chargeStart>420&&performance.now()-chargeStart<820);
 $('#power-label').textContent=r.game==='darts'?'Stabilité : relâche quand la barre devient verte.':'Puissance : maintiens puis relâche pour tirer.';
 if(r.eventId!==previousEvent){previousEvent=r.eventId;effectStart=performance.now();if(r.event)beep(r.event);}
 const visual=r.solo?r:(snapshots.sample(performance.now())||r);
 ArcadeRenderer.draw(ctx,visual,{player:p,aim:aimPoint(),power:charging?power():0,eventAge:performance.now()-effectStart,grabbed:Boolean(hockeyDrag),result:r.solo?r.result:r.winner<0?'Égalité !':names[r.winner]+' gagne !'});
 if(r.finished)saveRecord();
}
function beep(type){if(!soundOn)return;try{audio ||= new (window.AudioContext||window.webkitAudioContext)();if(audio.state==='suspended')audio.resume();const o=audio.createOscillator(),g=audio.createGain();o.type='sine';o.frequency.setValueAtTime(({pocket:620,goal:440,fruit:660,pair:780,dart:280,brick:520,wall:180,miss:110}[type])||320,audio.currentTime);o.frequency.exponentialRampToValueAtTime(type==='miss'?60:160,audio.currentTime+.09);g.gain.setValueAtTime(.055,audio.currentTime);g.gain.exponentialRampToValueAtTime(.001,audio.currentTime+.13);o.connect(g);g.connect(audio.destination);o.start();o.stop(audio.currentTime+.14);}catch{}}
function soundLabel(){$('#sound-game').textContent='Son : '+(soundOn?'on':'off');$('#sound-game').setAttribute('aria-pressed',String(soundOn));}soundLabel();
$('#sound-game').onclick=()=>{soundOn=!soundOn;localStorage.setItem('lf-sound',soundOn?'yes':'no');soundLabel();if(soundOn)beep('pair');};
$('#pause-game').onclick=()=>{if(current?.solo){current.paused=!current.paused;autoPausedGame=null;endHockeyDrag(null,false);charging=false;renderGame();}};
$('#fullscreen-game').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();requestAnimationFrame(()=>{syncGameViewport();fitArena();});}catch{toast('Le plein écran est indisponible dans ce navigateur.');}};
function fire(){if(!current||current.finished||current.paused||current.ballInHand||current.moving||current.dartFlight||current.pendingVolley||(!current.solo&&current.turn!==player()&&['pool','darts'].includes(current.game))){charging=false;return;}const target=aimPoint(),force=power();charging=false;if(current.game==='pool')updateSpin();if(current.solo){Solo.shot(current,target.x,target.y,force);}else send({type:'shot',...target,power:force});renderGame();}
function updateSpin(){if(!current||current.game!=='pool')return;const x=Number($('#pool-side').value)/100,y=Number($('#pool-follow').value)/100;if(current.solo)Solo.setSpin(current,x,y);else send({type:'spin',x,y});}
$('#pool-side').oninput=updateSpin;$('#pool-follow').oninput=updateSpin;$('#reset-spin').onclick=()=>{$('#pool-side').value='0';$('#pool-follow').value='0';updateSpin();};
$('#shoot-game').onpointerdown=e=>{e.currentTarget.setPointerCapture(e.pointerId);charging=true;chargeStart=performance.now();};$('#shoot-game').onpointerup=fire;$('#shoot-game').onpointercancel=()=>charging=false;$('#shoot-game').onclick=e=>{if(e.detail===0)fire();};
function point(e){const b=canvas.getBoundingClientRect();let x,y;
 if(canvas.dataset.rotation==='left'){x=(b.bottom-e.clientY)*800/b.height;y=(e.clientX-b.left)*460/b.width;}
 else if(canvas.dataset.rotation==='right'){x=(e.clientY-b.top)*800/b.height;y=(b.right-e.clientX)*460/b.width;}
 else{x=(e.clientX-b.left)*800/b.width;y=(e.clientY-b.top)*460/b.height;}
 return{x:Math.max(0,Math.min(800,x)),y:Math.max(0,Math.min(460,y))};}

let lastMove=0,swipe=null;
function inputMove(p,force=false){if(!current)return;const me=player();if(current.game==='hockey')p={x:Math.max(me?434:52,Math.min(me?748:366,p.x)),y:Math.max(52,Math.min(408,p.y))};if(current.game==='pong')p={...p,y:Math.max(62,Math.min(398,p.y))};localTarget={...p};if(current.solo)Solo.move(current,p.x,p.y);else if(force||Date.now()-lastMove>16){lastMove=Date.now();send({type:'move',...p});}}
function endHockeyDrag(e,commit=true){
 if(!hockeyDrag||e&&hockeyDrag.id!==e.pointerId)return;
 if(commit&&current){const p=e?point(e):hockeyDrag.last;inputMove({x:p.x+hockeyDrag.offsetX,y:p.y+hockeyDrag.offsetY},true);}
 hockeyDrag=null;canvas.classList.remove('dragging');
}
canvas.onpointermove=e=>{
 if(!current)return;aim=point(e);
 if(current.game==='hockey'){
  if(!hockeyDrag||hockeyDrag.id!==e.pointerId)return;
  if(e.cancelable)e.preventDefault();hockeyDrag.last=aim;inputMove({x:aim.x+hockeyDrag.offsetX,y:aim.y+hockeyDrag.offsetY});return;
 }
 inputMove(aim);
};
canvas.onpointerdown=e=>{
 if(!current||current.finished||current.paused||!e.isPrimary)return;aim=point(e);
 if(current.game==='hockey'){
  if(!current.started)return;const me=player(),m=current.mallets[me];if(!m)return;
  const b=canvas.getBoundingClientRect(),scale=canvas.dataset.rotation==='none'||!canvas.dataset.rotation?b.width/800:b.height/800;
  const radius=Math.max(42,(e.pointerType==='touch'?24:18)/scale);
  if(Math.hypot(aim.x-m.x,aim.y-m.y)>radius){toast('Saisis ton maillet pour le déplacer.');return;}
  if(e.cancelable)e.preventDefault();canvas.setPointerCapture(e.pointerId);
  hockeyDrag={id:e.pointerId,offsetX:m.x-aim.x,offsetY:m.y-aim.y,last:aim};canvas.classList.add('dragging');inputMove({x:m.x,y:m.y},true);return;
 }
 canvas.setPointerCapture(e.pointerId);inputMove(aim);
 if(current.game==='pool'&&current.ballInHand){if(current.solo)Solo.placeCue(current,aim.x,aim.y);else send({type:'place',...aim});renderGame();return;}
 if(current.game==='snake'){swipe={...aim};return;}
 if(['pool','darts'].includes(current.game)){charging=true;chargeStart=performance.now();}else if(current.solo)Solo.shot(current,aim.x,aim.y);
};
canvas.onpointerup=e=>{
 if(!current)return;
 if(current.game==='hockey'){if(e.cancelable)e.preventDefault();endHockeyDrag(e);return;}
 if(current.game==='snake'&&swipe){const p=point(e),dx=p.x-swipe.x,dy=p.y-swipe.y;if(Math.hypot(dx,dy)>20)Solo.direction(current,Math.abs(dx)>Math.abs(dy)?Math.sign(dx):0,Math.abs(dy)>Math.abs(dx)?Math.sign(dy):0);swipe=null;}else if(charging)fire();
};
canvas.onpointercancel=e=>{endHockeyDrag(e,false);charging=false;swipe=null;};
canvas.onlostpointercapture=e=>endHockeyDrag(e,false);
const directions={up:[0,-1],down:[0,1],left:[-1,0],right:[1,0]};document.querySelectorAll('[data-direction]').forEach(b=>b.onclick=()=>{if(current?.solo)Solo.direction(current,...directions[b.dataset.direction]);});
const held=new Set();
document.addEventListener('keydown',e=>{if(!current||!$('#game-dialog').open||e.target.matches('input,select'))return;
 const d={ArrowUp:'up',ArrowDown:'down',ArrowLeft:'left',ArrowRight:'right',z:'up',w:'up',s:'down',q:'left',a:'left',d:'right'}[e.key];
 if(e.code==='Space'){e.preventDefault();if(!e.repeat){if(['pool','darts'].includes(current.game)){charging=true;chargeStart=performance.now();}else if(current.solo)Solo.shot(current,aim.x,aim.y);}return;}
 if(e.key.toLowerCase()==='p'&&current.solo){e.preventDefault();$('#pause-game').click();return;}
 if(!d)return;e.preventDefault();held.add(d);if(current.game==='snake'&&current.solo)Solo.direction(current,...directions[d]);
});
document.addEventListener('keyup',e=>{const d={ArrowUp:'up',ArrowDown:'down',ArrowLeft:'left',ArrowRight:'right',z:'up',w:'up',s:'down',q:'left',a:'left',d:'right'}[e.key];if(d)held.delete(d);if(e.code==='Space'&&charging)fire();});
// Mobile browsers can blur when keyboard, focus or browser chrome changes. That is not leaving the game.
window.addEventListener('blur',()=>{held.clear();charging=false;});
function handleVisibility(){
 if(document.hidden){held.clear();charging=false;endHockeyDrag(null,false);if(current?.solo&&!current.finished&&!current.paused){current.paused=true;autoPausedGame=current;}}
 else if(autoPausedGame){if(current===autoPausedGame&&!current.finished){current.paused=false;lastFrame=performance.now();}autoPausedGame=null;}
}
document.addEventListener('visibilitychange',handleVisibility);
let lastFrame=performance.now();function frame(now){const dt=Math.min(50,now-lastFrame);lastFrame=now;if(current&&$('#game-dialog').open){
 const r=current,p=player(),dx=(held.has('right')?1:0)-(held.has('left')?1:0),dy=(held.has('down')?1:0)-(held.has('up')?1:0);
 if(!r.paused&&(dx||dy)){
  if(r.game==='breakout')inputMove({x:r.paddle+dx*dt*.55,y:230});
  else if(r.game==='hockey'){const rotation=canvas.dataset.rotation,hx=rotation==='left'?-dy:rotation==='right'?dy:dx,hy=rotation==='left'?dx:rotation==='right'?-dx:dy;inputMove({x:(localTarget||r.targets[p]).x+hx*dt*.55,y:(localTarget||r.targets[p]).y+hy*dt*.55});}
  else if(r.game==='pong')inputMove({x:p?750:50,y:(localTarget?.y??r.paddles[p])+dy*dt*.55});
  else if(['darts','pool'].includes(r.game))aim={x:Math.max(0,Math.min(800,aim.x+dx*dt*.3)),y:Math.max(0,Math.min(460,aim.y+dy*dt*.3))};
 }
 if(r.solo)Solo.tick(r,dt);
 renderGame();
 }requestAnimationFrame(frame);}requestAnimationFrame(frame);connect();
