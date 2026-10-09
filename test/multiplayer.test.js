const {test}=require('node:test');
const assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const {WebSocket}=require('ws');
const delay=ms=>new Promise(r=>setTimeout(r,ms));
test('Two players: chat, animated 301 with double checkout, ranking and departure', {timeout:25000},async t=>{
 const server=spawn(process.execPath,['server.js'],{env:{...process.env,PORT:'3199'}});t.after(()=>server.kill());
 let ready=false;for(let i=0;i<50;i++){try{ready=(await fetch('http://127.0.0.1:3199/health')).ok;if(ready)break;}catch{}await delay(50);}assert.ok(ready);
 assert.match(await(await fetch('http://127.0.0.1:3199')).text(),/La French/);
 async function client(name){const ws=new WebSocket('ws://127.0.0.1:3199'),messages=[];ws.on('message',b=>messages.push(JSON.parse(b)));await new Promise(r=>ws.once('open',r));ws.send(JSON.stringify({type:'join',name}));t.after(()=>ws.close());return{ws,messages,send:m=>ws.send(JSON.stringify(m)),wait:async fn=>{for(let i=0;i<200;i++){const m=messages.find(fn);if(m)return m;await delay(20);}throw Error('Expected multiplayer message missing');}};}
 const a=await client('Alice'),b=await client('Bob');await a.wait(m=>m.type==='lobby'&&m.users.length===2);
 a.send({type:'chat',text:'Salut Bob'});assert.equal((await b.wait(m=>m.type==='chat')).text,'Salut Bob');
 a.send({type:'create',game:'darts'});const id=(await a.wait(m=>m.type==='entered')).id;b.send({type:'enter',id});await a.wait(m=>m.type==='state'&&m.room.started);
 let shots=0;
 async function throwDart(client,x,y){client.send({type:'shot',x,y});shots++;await a.wait(m=>m.type==='state'&&m.room.shots===shots);}
 async function nextTurn(p){await a.wait(m=>m.type==='state'&&m.room.shots===shots&&m.room.turn===p&&!m.room.pendingVolley);}
 for(let i=0;i<3;i++)await throwDart(a,400,120);await nextTurn(1);
 for(let i=0;i<3;i++)await throwDart(b,400,0);await nextTurn(0);
 await throwDart(a,400,120);await throwDart(a,400+150*Math.sin(Math.PI/10),230-150*Math.cos(Math.PI/10));await throwDart(a,400,55);await nextTurn(1);
 for(let i=0;i<3;i++)await throwDart(b,400,0);await nextTurn(0);
 await throwDart(a,400+175*Math.sin(6*Math.PI/10),230-175*Math.cos(6*Math.PI/10));
 const finished=await a.wait(m=>m.type==='state'&&m.room.finished);assert.equal(finished.room.winner,0);assert.deepEqual(finished.room.remaining,[0,301]);
 const ranked=await a.wait(m=>m.type==='lobby'&&m.ranks.length);assert.equal(ranked.ranks[0].name,'Alice');
 b.send({type:'leave'});await a.wait(m=>m.type==='state'&&!m.room.started&&m.room.players.length===1);
});
test('Pool protocol: server applies spin, foul changes turn and placement is validated', {timeout:10000},async t=>{
 const server=spawn(process.execPath,['server.js'],{env:{...process.env,PORT:'3198'}});t.after(()=>server.kill());
 for(let i=0;i<50;i++){try{if((await fetch('http://127.0.0.1:3198/health')).ok)break;}catch{}await delay(50);}
 async function connect(name){const ws=new WebSocket('ws://127.0.0.1:3198'),messages=[];ws.on('message',b=>messages.push(JSON.parse(b)));await new Promise(r=>ws.once('open',r));ws.send(JSON.stringify({type:'join',name}));t.after(()=>ws.close());return{send:m=>ws.send(JSON.stringify(m)),wait:async fn=>{for(let i=0;i<200;i++){const m=messages.find(fn);if(m)return m;await delay(20);}throw Error('Pool message missing');}};}
 const a=await connect('Cue A'),b=await connect('Cue B');a.send({type:'create',game:'pool'});const id=(await a.wait(m=>m.type==='entered')).id;b.send({type:'enter',id});await a.wait(m=>m.type==='state'&&m.room.started);
 a.send({type:'spin',x:.35,y:-.4});a.send({type:'shot',x:220,y:300,power:.1});const moving=await a.wait(m=>m.type==='state'&&m.room.moving);assert.deepEqual(moving.room.spin,{x:.35,y:-.4});
 await b.wait(m=>m.type==='state'&&m.room.turn===1&&m.room.ballInHand);
 b.send({type:'place',x:220,y:230});const placed=await b.wait(m=>m.type==='state'&&m.room.turn===1&&!m.room.ballInHand&&m.room.cue.x===220&&m.room.cue.y===230);assert.equal(placed.room.shots,1);
 b.send({type:'shot',x:500,y:230,power:.8});await a.wait(m=>m.type==='state'&&m.room.shots===2&&m.room.moving);
});
