"""Package exact local evidence; no simulation or hidden filtering."""
import csv,gzip,hashlib,json,pathlib,subprocess
root=pathlib.Path('docs/metrics/digital-c1');root.mkdir(parents=True,exist_ok=True)
b=json.load(open('lab-results/integrated-baselines/summary.json'))
c=json.load(open('lab-results/integrated-final/summary.json'))
assert len(b['results'])==5 and len(c['results'])==1
results=b['results']+c['results']
assert all(len(v['scenarios'])==243 for v in results)
for f,h in c['results'][0]['version']['sources'].items():
 assert hashlib.sha256(pathlib.Path('v04/src/physics',f).read_bytes()).hexdigest()==h,f
# Full second candidate run must reproduce EVERY physical summary field.
old=json.load(open('lab-results/integrated/summary.json'))['results'][0]
for a,d in zip(old['scenarios'],c['results'][0]['scenarios']):
 assert a['scenario']==d['scenario']
 assert {k:v for k,v in a['summary'].items() if 'Sha256' not in k}=={k:v for k,v in d['summary'].items() if 'Sha256' not in k}
for v in results:
 v['version'].pop('root',None)
candidate_sha='e4978c53338b58ef7a9eaefeb295b97c296db24c' # GitHub source commit; identical tree to locally tested 3087a64a5d37e535d6ecb93b7a8b6747c1d420b4
c['results'][0]['version']['sha']=candidate_sha
report={'schema':1,'candidateSourceCommit':candidate_sha,'node':c['node'],'dt':c['dt'],
 'runCount':sum(len(v['scenarios']) for v in results),
 'physicsSteps':sum(round(x['scenario']['duration']*60) for v in results for x in v['scenarios']),
 'candidateRepeat':'243/243 summaries exactly equal; excluded trace hash because added observational fields changed bytes',
 'results':results}
raw=json.dumps(report,ensure_ascii=False,separators=(',',':')).encode()
(root/'summary.json.gz').write_bytes(gzip.compress(raw,mtime=0))
fields=['version','case','duration','speed','surfaceType','delay','hold','period','lineOffset','peakSlip','peakYaw','moderateSeconds','finalAbsSlip','finalAbsYaw','openRecoverySeconds','spinouts','oscillationCycles','overcorrections','releaseAlternations','offRoadSeconds','recoveries','meanKmh','exitKmh','finalX','finalZ','laps','outsideMeshSeconds']
with (root/'results.csv').open('w') as f:
 w=csv.DictWriter(f,fieldnames=fields);w.writeheader()
 for v in results:
  for s in v['scenarios']:
   d={'version':v['version']['name'],'case':s['scenario']['id'],**s['scenario'],**s['summary']};d['laps']=len(d['laps'])
   w.writerow({k:(round(d[k],6) if isinstance(d.get(k),float) else d.get(k,'')) for k in fields})
extra=json.load(open('lab-results/integrated-extra.json'))
(root/'corners-and-acceleration.json').write_text(json.dumps(extra,indent=2)+'\n')
matched=pathlib.Path('lab-results/matched-entry.json').read_bytes()
(root/'matched-entry.json.gz').write_bytes(gzip.compress(matched,mtime=0))
manifest={k:v for k,v in report.items() if k!='results'}
manifest['files']={f.name:hashlib.sha256(f.read_bytes()).hexdigest() for f in root.iterdir() if f.is_file() and f.name!='manifest.json'}
(root/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
print(json.dumps({k:v for k,v in manifest.items() if k!='files'},indent=2))
print('TABLES')
for v in results:
 name=v['version']['name'];ss={x['scenario']['id']:x['summary'] for x in v['scenarios']}
 print(name,'compactCatchMax',max(s['summary']['peakSlip'] for s in v['scenarios'] if s['scenario']['id'].startswith('catch-')))
 for speed in [70,100,126]:
  s=ss[f'real-full-{speed}'];print(speed,round(s['peakSlip'],2),s['spinouts'],round(s['offRoadSeconds'],2),len(s['laps']),round(s['meanKmh'],2))
 print('longLines',[(i,ss[f'line-{i}']['spinouts'],ss[f'line-{i}']['offRoadSeconds'],len(ss[f'line-{i}']['laps'])) for i in [-3,0,3]])
for v in extra['results']:
 print(v['name'],'straight',v['straight'],'corner',v['corner']['normal']['validRanking'])
