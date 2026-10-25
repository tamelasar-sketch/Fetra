"""Add Shatta, the voice assistant (floating mic button), to the Fetra ledger.
Safe to run again: it replaces its own block. It goes last, after the i18n block (it reads fetraLang and window.setLang).
Order: leaks, views, paper, calm, i18n, shatta.  Usage: python3 patch_shatta.py <app.html> [dir with shatta.js]"""
import re,sys
path=sys.argv[1]; here=sys.argv[2] if len(sys.argv)>2 else '.'
s=open(path,encoding='utf-8').read()
js=open(here+'/shatta.js',encoding='utf-8').read()
s=re.sub(r'\n?<script id="fetra-shatta">.*?</script>\n?','\n',s,flags=re.S)
blk='<script id="fetra-shatta">\n'+js+'</script>\n'
m=re.search(r'<script id="fetra-i18n">.*?</script>\n?',s,flags=re.S)
i=m.end() if m else s.rindex('</script>')+len('</script>')
s=s[:i]+'\n'+blk+s[i:]
open(path,'w',encoding='utf-8').write(s)
print('patched',path,len(s))
