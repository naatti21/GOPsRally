// Build a standalone, single-file mobile test: no Pages deployment, npm or CDN.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.join(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
let html=read('index.html'),css=read('style.css'),renderer=read('renderer3d.js'),game=read('game.js');
for(const source of [renderer,game])assert(!/<\\/script/i.test(source),'Inline script would close prematurely');
const style='<link rel="stylesheet" href="style.css">';
const r='<script src="renderer3d.js" defer></script>',g='<script src="game.js" defer></script>';
assert(html.includes(style)&&html.includes(r)&&html.includes(g),'Required source references missing');
html=html.replace(style,'<style>\\n'+css+'\\n</style>')
 .replace(r,'').replace(g,'')
 .replace(/  <link rel="manifest"[^>]+>\\n/,'')
 .replace(/  <link rel="icon"[^>]+>\\n/,'');
const injection='<script>\\n'+renderer+'\\n</script>\\n<script>\\n'+game+'\\n</script>';
assert(html.includes('</body>'));
html=html.replace('</body>',injection+'\\n</body>');
assert(!/<(?:script|link)[^>]+(?:src|href)="(?:game|renderer3d|style|manifest|icon)/i.test(html),'Bundle still needs external assets');
const out=path.join(root,'dist','classic-rally-test.html');
fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,html);
console.log('Standalone Classic trial built:',out,html.length,'bytes');
