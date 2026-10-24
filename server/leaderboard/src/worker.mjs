// GOPs Rally: isolated staging leaderboard backend. No dependency on the game renderer.
// The anonymous player credential protects a pseudonymous installation, not a real-world identity.

const BOARD = Object.freeze({
  track_id: 'rally-dev', direction: 'forward', car_class: 'prototype', physics_version: 'dev-1',
  checkpoints: 3, min_lap_ms: 45000, max_lap_ms: 900000,
});
const BOARD_KEY = `${BOARD.track_id}:${BOARD.direction}:${BOARD.car_class}:${BOARD.physics_version}`;
const JSON_HEADERS = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' };
const MAX_BODY = 2048;
const SECTOR_MIN_MS = 3500;
const DRIFT_LIMIT_MS = 8000;

const uuid = () => crypto.randomUUID();
function token() { const bytes = crypto.getRandomValues(new Uint8Array(32)); return Array.from(bytes, x => x.toString(16).padStart(2, '0')).join(''); }
async function sha256(value) { const data = new TextEncoder().encode(value); const hash = await crypto.subtle.digest('SHA-256', data); return Array.from(new Uint8Array(hash), v => v.toString(16).padStart(2, '0')).join(''); }
function validNickname(name) {
  if (typeof name !== 'string') return null;
  const clean = name.normalize('NFC').trim().replace(/ {2,}/g, ' ');
  if (!clean || new TextEncoder().encode(clean).length > 64 || !/^[\p{L}\p{N} ._-]+$/u.test(clean)) return null;
  if ([...new Intl.Segmenter('fi', {granularity:'grapheme'}).segment(clean)].length > 10) return null;
  return clean;
}
function exactBoard(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  return ['track_id','direction','car_class','physics_version'].every(key => value[key] === BOARD[key]);
}
function cors(origin, env) {
  const allowed = env.ALLOWED_ORIGIN || 'https://naatti21.github.io';
  return origin === allowed ? { 'Access-Control-Allow-Origin': allowed, 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Access-Control-Max-Age': '600', 'Vary': 'Origin' } : {'Vary':'Origin'};
}
function response(data, status, origin, env) { return new Response(JSON.stringify(data),{ status, headers:{...JSON_HEADERS,...cors(origin,env)} }); }
function fail(message, status, origin, env) { return response({error:message},status,origin,env); }
async function bodyJson(request) {
  const declared = Number(request.headers.get('content-length') || 0);
  if (declared > MAX_BODY) throw new Error('payload_too_large');
  const reader = request.body?.getReader();
  if (!reader) throw new Error('invalid_json');
  const chunks=[]; let total=0;
  try {
    while (true) {
      const {value,done}=await reader.read();
      if (done) break;
      total+=value.byteLength;
      if (total>MAX_BODY) {await reader.cancel();throw new Error('payload_too_large');}
      chunks.push(value);
    }
  } finally {reader.releaseLock();}
  const bytes=new Uint8Array(total);let offset=0;
  for (const chunk of chunks) {bytes.set(chunk,offset);offset+=chunk.byteLength;}
  let value;try {value=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}catch{throw new Error('invalid_json');}
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('invalid_json');
  return value;
}
async function playerAuth(request, env) {
  const auth = request.headers.get('Authorization') || '';
  if (!/^Bearer [0-9a-f]{64}$/.test(auth)) return null;
  const secretHash = await sha256(auth.slice(7));
  return await env.DB.prepare('SELECT player_id FROM players WHERE secret_hash = ?').bind(secretHash).first();
}
async function startRateLimit(db, playerId, now) {
  const windowBucket = Math.floor(now / 3600000);
  const stmt = db.prepare(`INSERT INTO rate_limits (player_id, bucket, hits) VALUES (?, ?, 1)
    ON CONFLICT(player_id, bucket) DO UPDATE SET hits = hits + 1 WHERE hits < 25 RETURNING hits`);
  return !!(await stmt.bind(playerId, windowBucket).first());
}
function publicRecord(row,rank) {return {rank, entry_id:row.entry_id, nickname:row.nickname, lap_ms:row.lap_ms, achieved_at:row.achieved_at};}
export function createHandler({clock = ()=>Date.now()} = {}) {
  return async function handle(request, env) {
    const origin = request.headers.get('Origin');
    const isCrossOrigin = origin && origin !== (env.ALLOWED_ORIGIN || 'https://naatti21.github.io');
    if (isCrossOrigin) return fail('origin_not_allowed',403,origin,env);
    if (request.method === 'OPTIONS') return new Response(null,{status:204,headers:cors(origin,env)});
    const url = new URL(request.url), pathname = url.pathname;
    if (request.method === 'GET' && pathname === '/api/v1/health') return response({ok:true,stage:env.STAGE || 'local'},200,origin,env);
    if (!env.DB) return fail('database_unavailable',503,origin,env);
    try {
      if (request.method === 'GET' && pathname === '/api/v1/leaderboard') {
        const params=Object.fromEntries(['track_id','direction','car_class','physics_version'].map(k=>[k,url.searchParams.get(k)]));
        if (!exactBoard(params)) return fail('board_not_found',404,origin,env);
        const rows=await env.DB.prepare(`SELECT entry_id, nickname, lap_ms, achieved_at FROM records
          WHERE board_key = ? ORDER BY lap_ms ASC, achieved_at ASC, entry_id ASC LIMIT 20`).bind(BOARD_KEY).all();
        return response({board:BOARD, entries: rows.results.map((row,i)=>publicRecord(row,i+1))},200,origin,env);
      }
      if (request.method !== 'POST' || !['/api/v1/players','/api/v1/runs/start','/api/v1/runs/checkpoint','/api/v1/runs/finish'].includes(pathname)) return fail('not_found',404,origin,env);
      if (env.STAGE !== 'staging' || env.ENABLE_TEST_WRITES !== 'true') return fail('writes_disabled',403,origin,env);
      if (!/^application\/json(?:;|$)/i.test(request.headers.get('content-type') || '')) return fail('content_type_required',415,origin,env);
      const payload=await bodyJson(request),now=clock();
      if (pathname === '/api/v1/players') {
        if (Object.keys(payload).length) return fail('invalid_registration',400,origin,env);
        const playerId=uuid(),secret=token();
        await env.DB.prepare('INSERT INTO players (player_id, secret_hash, created_at) VALUES (?,?,?)').bind(playerId,await sha256(secret),now).run();
        return response({player_id:playerId,credential:secret},201,origin,env);
      }
      const player=await playerAuth(request,env);
      if (!player) return fail('unauthorized',401,origin,env);
      if (pathname === '/api/v1/runs/start') {
        if (!exactBoard(payload.board)) return fail('board_not_found',404,origin,env);
        if (!await startRateLimit(env.DB,player.player_id,now)) return fail('too_many_attempts',429,origin,env);
        const runId=uuid(),runSecret=token();
        await env.DB.prepare(`INSERT INTO runs (run_id, player_id, secret_hash, board_key, started_at, last_checkpoint_at, checkpoint_count)
           VALUES (?,?,?,?,?,?,0)`).bind(runId,player.player_id,await sha256(runSecret),BOARD_KEY,now,now).run();
        return response({run_id:runId,run_secret:runSecret,checkpoints:BOARD.checkpoints,minimum_lap_ms:BOARD.min_lap_ms},201,origin,env);
      }
      if (typeof payload.run_id !== 'string' || !/^[\da-f-]{36}$/.test(payload.run_id) || !/^[0-9a-f]{64}$/.test(payload.run_secret || '')) return fail('invalid_run',400,origin,env);
      const stored=await env.DB.prepare(`SELECT run_id,board_key,started_at,last_checkpoint_at,checkpoint_count,finished_at FROM runs
          WHERE run_id = ? AND player_id = ? AND secret_hash = ?`)
          .bind(payload.run_id,player.player_id,await sha256(payload.run_secret)).first();
      if (!stored || stored.board_key !== BOARD_KEY) return fail('invalid_run',404,origin,env);
      if (stored.finished_at !== null || now-stored.started_at > BOARD.max_lap_ms + 30000) return fail('run_closed',409,origin,env);
      if (pathname === '/api/v1/runs/checkpoint') {
        if (!Number.isInteger(payload.index) || payload.index !== stored.checkpoint_count+1 || payload.index > BOARD.checkpoints) return fail('checkpoint_out_of_order',409,origin,env);
        if (now-stored.last_checkpoint_at < SECTOR_MIN_MS) return fail('checkpoint_too_fast',422,origin,env);
        const r=await env.DB.prepare(`UPDATE runs SET checkpoint_count = checkpoint_count + 1, last_checkpoint_at = ?
          WHERE run_id = ? AND player_id = ? AND finished_at IS NULL AND checkpoint_count = ?
          RETURNING checkpoint_count`).bind(now,stored.run_id,player.player_id,stored.checkpoint_count).first();
        if (!r) return fail('checkpoint_conflict',409,origin,env);
        return response({accepted:true,checkpoint_count:r.checkpoint_count},200,origin,env);
      }
      if (stored.checkpoint_count !== BOARD.checkpoints) return fail('checkpoints_missing',422,origin,env);
      const nick=validNickname(payload.nickname);
      if (!nick) return fail('invalid_nickname',422,origin,env);
      if (!Number.isInteger(payload.lap_ms) || payload.lap_ms < BOARD.min_lap_ms || payload.lap_ms > BOARD.max_lap_ms) return fail('invalid_lap_time',422,origin,env);
      const elapsed=now-stored.started_at;
      if (Math.abs(elapsed-payload.lap_ms)>DRIFT_LIMIT_MS) return fail('timing_mismatch',422,origin,env);
      // D1 batch is atomic. The second statement can INSERT only if this request closed the run.
      // A faster subsequent finish replaces the player's best while preserving the public entry_id.
      const entryId=uuid();
      const statements=[
        env.DB.prepare(`UPDATE runs SET finished_at = ?, finished_lap_ms = ? WHERE run_id = ? AND player_id = ? AND finished_at IS NULL AND checkpoint_count = ?`).bind(now,payload.lap_ms,stored.run_id,player.player_id,BOARD.checkpoints),
        env.DB.prepare(`INSERT INTO records (board_key,player_id,entry_id,nickname,lap_ms,achieved_at)
          SELECT board_key, player_id, ?, ?, finished_lap_ms, finished_at FROM runs
          WHERE run_id = ? AND player_id = ? AND finished_at = ? AND finished_lap_ms = ?
          ON CONFLICT(board_key,player_id) DO UPDATE SET nickname=excluded.nickname, lap_ms=excluded.lap_ms, achieved_at=excluded.achieved_at
          WHERE excluded.lap_ms < records.lap_ms`).bind(entryId,nick,stored.run_id,player.player_id,now,payload.lap_ms)
      ];
      await env.DB.batch(statements);
      const best=await env.DB.prepare('SELECT entry_id,nickname,lap_ms FROM records WHERE board_key=? AND player_id=?').bind(BOARD_KEY,player.player_id).first();
      return response({accepted:true,best:{entry_id:best.entry_id,nickname:best.nickname,lap_ms:best.lap_ms},improved:best.lap_ms===payload.lap_ms},200,origin,env);
    } catch (error) {
      if (['invalid_json','payload_too_large'].includes(error.message)) return fail(error.message,error.message==='payload_too_large'?413:400,origin,env);
      console.error('Leaderboard API failure',error);
      return fail('internal_error',500,origin,env);
    }
  };
}
const handle=createHandler();
export default {fetch(request,env){return handle(request,env);}};