"""Add the offline layer (offline.js) to the Fetra app. It must run before every other script,
so it goes right before the first <script>. Safe to run again: it replaces its own block.
Usage: python3 patch_offline.py <app.html> [dir with offline.js]"""
import re,sys
path=sys.argv[1]; here=sys.argv[2] if len(sys.argv)>2 else '.'
s=open(path,encoding='utf-8').read()
js=open(here+'/offline.js',encoding='utf-8').read()
s=re.sub(r'<script id="fetra-offline">.*?</script>\n?','',s,flags=re.S)
i=s.index('<script')
s=s[:i]+'<script id="fetra-offline">\n'+js+'</script>\n'+s[i:]
open(path,'w',encoding='utf-8').write(s)
print('patched',path,len(s))
