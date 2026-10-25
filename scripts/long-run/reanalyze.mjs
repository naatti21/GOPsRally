// Recompute metrics from immutable raw traces; preserves evidence hashes.
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {join} from 'node:path';
import {summarize} from './metrics.mjs';
import {hash,saveJSON} from './versions.mjs';
const root=process.argv[2]||'lab-results/full',data=JSON.parse(readFileSync(join(root,'summary.json')));
for(const v of data.results)for(const run of v.scenarios){
 const bytes=readFileSync(join(root,run.trace));
 if(hash(bytes)!==run.summary.traceSha256)throw Error('Evidence hash mismatch');
 const raw=gunzipSync(bytes);if(hash(raw)!==run.summary.rawTraceSha256)throw Error('Raw evidence hash mismatch');
 const [metadata,...rows]=raw.toString().trim().split('\n').map(JSON.parse);
 if(rows.length!==Math.round(run.scenario.duration*60))throw Error('Incomplete trace');
 run.summary={...run.summary,...summarize(rows)};
}
data.metricDefinition='yaw alternations with |beta|6..60deg, speed>5m/s, |yaw|>10deg/s and 7-step dwell; no wrap-induced cycles';
saveJSON(join(root,'summary.json'),data);
