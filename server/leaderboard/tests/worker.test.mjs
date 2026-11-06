import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {createHandler} from '../src/worker.mjs';

class SQLiteD1 {
  constructor() {this.db=new DatabaseSync(':memory:');this.db.exec(readFileSync(new URL('../migrations/0001_init.sql',import.meta.url),'utf8'));}
  prepare(sql) {
    const db=this.db;
    const bind=(...params)=>({
      first:async()=>db.prepare(sql).get(...params)||null,
      all:async()=>({results:db.prepare(sql).all(...params)}),
      run:async()=>({meta:db.prepare(sql).run(...params)})
    });
    return {bind};
  }
  async batch(stmts){
    this.db.exec('BEGIN');try{const out=[];for(const s of stmts)out.push(await s.run());this.db.exec('COMMIT');return out;}
    catch(error){this.db.exec('ROLLBACK');throw error;}
  }
  close(){this.db.close();}
}
function setup(overrides={}){
  const DB=new SQLiteD1();let current=10000000;
  const handle=createHandler({clock:()=>current});
  const env={DB,STAGE:'staging',ENABLE_TEST_WRITES:'true',ALLOWED_ORIGIN:'https://naatti21.github.io',...overrides};
  const call=async(path,{method='GET',body,credential,origin='https://naatti21.github.io'}={})=>{
    const headers={'Origin':origin};if(body!==undefined)headers['content-type']='application/json';
    if(credential)headers.Authorization=`Bearer ${credential}`;
    const response=await handle(new Request('https://staging.example'+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body)}),env);
    return {status:response.status,body:response.status===204?null:await response.json(),headers:response.headers};
  };
  const post=(path,body,credential)=>call(path,{method:'POST',body,credential});
  const register=async()=>{const res=await post('/api/v1/players',{});assert.equal(res.status,201);return res.body;};
  const BOARD={track_id:'rally-dev',direction:'forward',car_class:'prototype',physics_version:'dev-1'};
  const query='/api/v1/leaderboard?'+new URLSearchParams(BOARD);
  const race=async(p,{name='ÄÄKKÖNEN',millis=90000,checkpoints=true}={})=>{
    const started=await post('/api/v1/runs/start',{board:BOARD},p.credential);assert.equal(started.status,201,JSON.stringify(started.body));
    const {run_id,run_secret}=started.body;
    if(checkpoints) for(let i=1;i<=3;i++){current+=Math.round(millis/4);const c=await post('/api/v1/runs/checkpoint',{run_id,run_secret,index:i},p.credential);assert.equal(c.status,200,JSON.stringify(c.body));}
    current+=Math.round(millis/4);
    const finished=await post('/api/v1/runs/finish',{run_id,run_secret,lap_ms:millis,nickname:name},p.credential);
    return {finished,run_id,run_secret};
  };
  return {DB,env,call,post,register,query,BOARD,race,advance(ms){current+=ms},time(){return current}};
}

test('cross-device arcade board, one better personal best, same visible nickname allowed',async()=>{
  const s=setup();try{
    const a=await s.register(),b=await s.register();
    const one=await s.race(a,{name:'ÄÄKKÖNEN',millis:90000});assert.equal(one.finished.status,200);
    const two=await s.race(b,{name:'ÄÄKKÖNEN',millis:80000});assert.equal(two.finished.status,200);
    let list=(await s.call(s.query)).body.entries;
    assert.equal(list.length,2);assert.deepEqual(list.map(p=>p.lap_ms),[80000,90000]);
    assert.equal(list[0].nickname,'ÄÄKKÖNEN');assert.notEqual(list[0].entry_id,list[1].entry_id);
    const slower=await s.race(a,{name:'SLOWER',millis:100000});assert.equal(slower.finished.status,200);
    assert.equal(slower.finished.body.improved,false);
    list=(await s.call(s.query)).body.entries;assert.equal(list.length,2);assert.equal(list[1].nickname,'ÄÄKKÖNEN');
    const faster=await s.race(a,{name:'FAST',millis:70000});assert.equal(faster.finished.body.improved,true);
    list=(await s.call(s.query)).body.entries;assert.equal(list.length,2);assert.equal(list[0].lap_ms,70000);assert.equal(list[0].nickname,'FAST');
  } finally {s.DB.close()}
});

test('exactly top twenty, ascending rank and only allowed board',async()=>{
  const s=setup();try{
    for(let i=0;i<24;i++){const p=await s.register();await s.race(p,{name:'R'+i,millis:70000+i*1000});}
    const list=(await s.call(s.query)).body.entries;
    assert.equal(list.length,20);assert.deepEqual(list.map(p=>p.rank),Array.from({length:20},(_,i)=>i+1));
    assert.equal(list[0].lap_ms,70000);assert.equal(list.at(-1).lap_ms,89000);
    assert.equal((await s.call('/api/v1/leaderboard?track_id=wrong&direction=forward&car_class=prototype&physics_version=dev-1')).status,404);
  }finally{s.DB.close()}
});

test('untrusted requests, invalid CORS, nickname length, missing checkpoints and replay are rejected',async()=>{
  const s=setup();try{
    assert.equal((await s.call(s.query,{origin:'https://evil.example'})).status,403);
    const a=await s.register();
    assert.equal((await s.post('/api/v1/runs/start',{board:s.BOARD},'f'.repeat(64))).status,401);
    const started=(await s.post('/api/v1/runs/start',{board:s.BOARD},a.credential)).body;
    s.advance(90000);
    const missing=await s.post('/api/v1/runs/finish',{...started,lap_ms:90000,nickname:'TEST'},a.credential);
    assert.equal(missing.status,422);assert.equal(missing.body.error,'checkpoints_missing');
    const wrongOrder=await s.post('/api/v1/runs/checkpoint',{...started,index:3},a.credential);assert.equal(wrongOrder.status,409);
    assert.equal((await s.post('/api/v1/runs/checkpoint',{...started,index:1},a.credential)).status,200);
    assert.equal((await s.post('/api/v1/runs/checkpoint',{...started,index:1},a.credential)).status,409);
    s.advance(12000);assert.equal((await s.post('/api/v1/runs/checkpoint',{...started,index:2},a.credential)).status,200);
    s.advance(12000);assert.equal((await s.post('/api/v1/runs/checkpoint',{...started,index:3},a.credential)).status,200);
    s.advance(10000);
    assert.equal((await s.post('/api/v1/runs/finish',{...started,lap_ms:124000,nickname:'TOOLONGNAME'},a.credential)).status,422);
    assert.equal((await s.post('/api/v1/runs/finish',{...started,lap_ms:124000,nickname:'<script>'},a.credential)).status,422);
    assert.equal((await s.post('/api/v1/runs/finish',{...started,lap_ms:124000,nickname:'ÅÄÖ'},a.credential)).status,200);
    assert.equal((await s.post('/api/v1/runs/finish',{...started,lap_ms:124000,nickname:'AGAIN'},a.credential)).status,409);
    assert.equal((await s.call(s.query)).body.entries.length,1);
  }finally{s.DB.close()}
});

test('server-measured elapsed time must align with claimed lap time',async()=>{
  const s=setup();try{
    const a=await s.register();
    const started=(await s.post('/api/v1/runs/start',{board:s.BOARD},a.credential)).body;
    for(let i=1;i<=3;i++){s.advance(10000);assert.equal((await s.post('/api/v1/runs/checkpoint',{...started,index:i},a.credential)).status,200);}
    s.advance(10000);
    const early=await s.post('/api/v1/runs/finish',{...started,lap_ms:45000,nickname:'RALLY'},a.credential);
    assert.equal(early.status,200); // +/-8 seconds is explicitly a tolerance for network latency.
    assert.equal((await s.call(s.query)).body.entries[0].lap_ms,45000);
  }finally{s.DB.close()}
});

test('staging write switch and request method controls',async()=>{
  const s=setup({ENABLE_TEST_WRITES:'false'});try{
    assert.equal((await s.post('/api/v1/players',{})).status,403);
    assert.equal((await s.call('/api/v1/health')).status,200);
    assert.equal((await s.call('/other')).status,404);
    const o=await s.call(s.query,{method:'OPTIONS'});assert.equal(o.status,204);assert.equal(o.headers.get('Access-Control-Allow-Origin'),'https://naatti21.github.io');
  }finally{s.DB.close()}
});

test('start rate limit blocks 26th attempt for the same player in an hour',async()=>{
  const s=setup();try{
    const p=await s.register();for(let i=0;i<25;i++)assert.equal((await s.post('/api/v1/runs/start',{board:s.BOARD},p.credential)).status,201);
    assert.equal((await s.post('/api/v1/runs/start',{board:s.BOARD},p.credential)).status,429);
  }finally{s.DB.close()}
});

test('a physically impossible finish time cannot be published',async()=>{
  const s=setup();try{
    const p=await s.register(),started=(await s.post('/api/v1/runs/start',{board:s.BOARD},p.credential)).body;
    for(let i=1;i<=3;i++){s.advance(4000);assert.equal((await s.post('/api/v1/runs/checkpoint',{...started,index:i},p.credential)).status,200);}
    s.advance(4000);
    const result=await s.post('/api/v1/runs/finish',{...started,lap_ms:65000,nickname:'RALLY'},p.credential);
    assert.equal(result.status,422);assert.equal(result.body.error,'timing_mismatch');
    assert.equal((await s.call(s.query)).body.entries.length,0);
  }finally{s.DB.close()}
});

test('cross-origin writes cannot register a player',async()=>{
  const s=setup();try{
    const res=await s.call('/api/v1/players',{method:'POST',body:{},origin:'https://unrelated.example'});
    assert.equal(res.status,403);assert.equal(res.headers.get('Access-Control-Allow-Origin'),null);
  }finally{s.DB.close()}
});