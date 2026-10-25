"""Standalone research figures. Reads recorded 60 Hz evidence, never synthesizes telemetry."""
import os, json, gzip, math, sys
os.environ.setdefault('MPLCONFIGDIR','/tmp/gops-mpl')
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from pathlib import Path
root=Path(sys.argv[1] if len(sys.argv)>1 else 'lab-results/full')
out=Path(sys.argv[2] if len(sys.argv)>2 else 'docs/metrics/long-run')
out.mkdir(parents=True,exist_ok=True)
data=json.loads((root/'summary.json').read_text())
versions=[v['version']['name'] for v in data['results']]
colors=dict(zip(versions,['#2369a0','#d64432','#32934b','#9854b4']))
def trace(v,s):
 with gzip.open(root/f'{v}-{s}.jsonl.gz','rt') as f:
  meta=json.loads(next(f)); rows=[json.loads(l) for l in f]
 return rows
fig,axes=plt.subplots(4,2,figsize=(14,11),sharex=True)
for col,scenario in enumerate(['oval-flat-100','real-full-100']):
 for v in versions:
  rows=trace(v,scenario); t=[r['t'] for r in rows]
  for ax,key in zip(axes[:,col],['beta','yaw','margin','speed']):
   ax.plot(t,[r[key]*(3.6 if key=='speed' else 1) for r in rows],label=v,color=colors[v],lw=.65,alpha=.85)
 axes[0,col].set_title(scenario+' · same 200 ms driver / 150 s continuous physics')
 for ax,label in zip(axes[:,col],['True sideslip (deg)','Yaw rate (deg/s)','Minimum wheel-center margin (m)','Speed (km/h)']):
  ax.set_ylabel(label);ax.grid(alpha=.2)
 axes[2,col].axhline(0,color='k',lw=.7);axes[3,col].set_xlabel('Simulated seconds')
axes[0,0].legend(ncol=4);fig.tight_layout();fig.savefig(out/'long-run-comparison.png',dpi=150);plt.close(fig)
fig,axes=plt.subplots(4,1,figsize=(12,10),sharex=True)
for v in versions:
 rows=trace(v,'catch-100-0.65-0.3-0.3')
 for ax,key in zip(axes,['rack','beta','yaw','x']):ax.plot([r['t'] for r in rows],[r[key]*(180/math.pi if key=='rack' else 1) for r in rows],label=v,color=colors[v])
for ax,label in zip(axes,['Rack (deg)','Sideslip (deg)','Yaw (deg/s)','Lateral position (m)']):
 ax.set_ylabel(label);ax.axvspan(.65,.95,color='grey',alpha=.12);ax.axvspan(.95,1.25,color='orange',alpha=.12);ax.grid(alpha=.2)
axes[0].legend();axes[0].set_title('100 km/h: 650 ms right, 300 ms release, 300 ms left; automatic throttle')
axes[-1].set_xlabel('Simulated seconds');fig.tight_layout();fig.savefig(out/'delayed-countersteer.png',dpi=150);plt.close(fig)
fig,axes=plt.subplots(3,1,figsize=(12,9),sharex=True)
rows=trace('v046','real-full-100')
for j in range(4):
 for ax,key in zip(axes[:2],['load','length']):ax.plot([r['t'] for r in rows],[r['wheels'][j][key] for r in rows],lw=.6,label=['FL','FR','RL','RR'][j])
axes[2].plot([r['t'] for r in rows],[r['pitch'] for r in rows],label='pitch',lw=.6)
axes[2].plot([r['t'] for r in rows],[r['roll'] for r in rows],label='roll',lw=.6)
for ax,label in zip(axes,['Capped normal load (N)','Suspension length (m)','Body angle (deg)']):ax.set_ylabel(label);ax.legend(ncol=4);ax.grid(alpha=.2)
axes[0].set_title('v0.4.6: real collision mesh, bank, bumps and surface classifications')
axes[-1].set_xlabel('Simulated seconds');fig.tight_layout();fig.savefig(out/'loads-and-body.png',dpi=150);plt.close(fig)
if (root/'camera-summary.json').exists():
 fig,axes=plt.subplots(2,1,figsize=(12,7),sharex=True)
 for mode in ['fixed','chase']:
  records=json.loads((root/f'camera-v046-{mode}.json').read_text())
  def unwrap(values):
   acc=[values[0]]
   for prev,cur in zip(values,values[1:]):acc.append(acc[-1]+math.degrees(math.atan2(math.sin(math.radians(cur-prev)),math.cos(math.radians(cur-prev)))))
   return acc
  t=[r['t'] for r in records]
  axes[0].plot(t,unwrap([r['cameraHeading'] for r in records]),label=mode,lw=.8)
  axes[1].plot(t,[r['ndc']['y'] for r in records],label=mode,lw=.8)
 axes[0].plot(t,unwrap([r['bodyHeading'] for r in records]),label='identical physical chassis',lw=.8,alpha=.7)
 axes[0].set_ylabel('Unwrapped heading (deg)');axes[1].set_ylabel('Car vertical NDC');axes[1].set_xlabel('Simulated seconds')
 axes[0].set_title('Actual archived scene cameras replaying exactly the same recorded physics')
 for ax in axes:ax.legend();ax.grid(alpha=.2)
 fig.tight_layout();fig.savefig(out/'camera-replay.png',dpi=150);plt.close(fig)
# Keep compact numerical evidence, not 60Hz recordings, in Git.
for v in data['results']:v['version'].pop('root',None)
manifest={k:v for k,v in data.items() if k!='results'}
manifest['versions']=[v['version'] for v in data['results']]
runs=[dict(version=v['version']['name'],scenario=r['scenario'],summary=r['summary'],meshHash=r['metadata']['meshHash'],trace=r['trace']) for v in data['results'] for r in v['scenarios']]
(out/'summary.json').write_text('{\n"schema":2,\n"manifest":'+json.dumps(manifest,indent=2)+',\n"runs":[\n'+',\n'.join(json.dumps(r,separators=(',',':')) for r in runs)+'\n]}\n')
if (root/'camera-summary.json').exists():(out/'camera-summary.json').write_text((root/'camera-summary.json').read_text())
