/* Render buffered snapshots between packets; never award points client-side. */
(function(root){
  const clone=r=>JSON.parse(JSON.stringify(r));
  const lerp=(a,b,t)=>a+(b-a)*t;
  function compatible(a,b){return a.id===b.id&&a.roundId===b.roundId&&a.game===b.game&&a.started===b.started&&a.finished===b.finished&&(a.countdown>0)===(b.countdown>0)&&a.score.every((s,i)=>s===b.score[i]);}
  function position(a,b,t){if(!a||!b)return b;if(a.active!==b.active)return {...a};return {...b,x:lerp(a.x,b.x,t),y:lerp(a.y,b.y,t)};}
  class Snapshots{
    constructor(delay=65){this.delay=delay;this.frames=[];}
    clear(){this.frames=[];}
    push(room,now){const last=this.frames.at(-1);if(last&&!compatible(last.room,room))this.clear();this.frames.push({room:clone(room),at:now});while(this.frames.length>12)this.frames.shift();}
    sample(now){if(!this.frames.length)return null;const target=now-this.delay;let a=this.frames[0],b=a;for(let i=1;i<this.frames.length;i++){b=this.frames[i];if(b.at>=target)break;a=b;}
      if(a===b||!compatible(a.room,b.room))return clone(b.room);
      const t=Math.max(0,Math.min(1,(target-a.at)/(b.at-a.at||1))),r=clone(a.room);r.elapsed=lerp(a.room.elapsed,b.room.elapsed,t);
      if(r.ball)r.ball=position(a.room.ball,b.room.ball,t);
      if(r.cue)r.cue=position(a.room.cue,b.room.cue,t);
      if(r.balls)r.balls=r.balls.map((v,i)=>position(v,b.room.balls[i],t));
      if(r.mallets)r.mallets=r.mallets.map((v,i)=>position(v,b.room.mallets[i],t));
      if(r.paddles)r.paddles=r.paddles.map((v,i)=>lerp(v,b.room.paddles[i],t));return r;
    }
  }
  const api={Snapshots};if(typeof module!=='undefined')module.exports=api;else root.ArcadeNetwork=api;
})(globalThis);
