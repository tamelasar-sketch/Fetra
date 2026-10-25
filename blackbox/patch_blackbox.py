"""Add the black box (Excel copy of the app, saved on the device) to the Fetra app.
Safe to run again: it replaces its own block. It goes right after the app's main script (it reads the figures built
into it through window.fetraTables) and after the offline block (it uses window.fetraOffline).
Run patch_offline.py first.  Usage: python3 patch_blackbox.py <app.html> [dir with blackbox files]"""
import re,sys,json
path=sys.argv[1]; here=sys.argv[2] if len(sys.argv)>2 else '.'
s=open(path,encoding='utf-8').read()
assert '<script id="fetra-offline">' in s, 'run patch_offline.py first'
core=open(here+'/xlsx-core.js',encoding='utf-8').read()
data=open(here+'/bb-data.js',encoding='utf-8').read()
ui=open(here+'/blackbox.js',encoding='utf-8').read()
import subprocess,os
names=json.loads(subprocess.check_output(['node','-e','console.log(JSON.stringify(require(process.argv[1]).TABLES.map(t=>t[0])))',os.path.abspath(here+'/bb-data.js')]))
tab='/* the figures built into the app, for the App sheets */\nwindow.fetraTables = function(){ const o = {};\n'+''.join(f'  try{{ o.{n} = JSON.parse(JSON.stringify({n})); }}catch(_){{}}\n' for n in names)+'  return o; };\n'
s=re.sub(r'\n?<script id="fetra-blackbox">.*?</script>\n?','\n',s,flags=re.S)
blk='<script id="fetra-blackbox">\n'+core+data+tab+ui+'</script>\n'
m=re.search(r'<script id="fetra-offline">.*?</script>\n<script>\n.*?</script>\n',s,flags=re.S)
assert m, 'main script not found after the offline block'
s=s[:m.end()]+blk+s[m.end():]
open(path,'w',encoding='utf-8').write(s)
print('patched',path,len(s),'tables',len(names))
