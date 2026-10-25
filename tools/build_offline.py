"""Build the offline copies of the Fetra app.
  python3 build_offline.py <app.html with offline.js> <data> <repo dir> <passcode>
<data> is either a Fetra-data-*.json file saved from the app (Offline · Save data for the offline copy)
or a folder of records (<collection path>/<doc id>.json).
Writes:
  <repo>/app/app.enc   the app + records, locked with the passcode (served on the public site)
  <repo>/app/sw.js     the service worker, with a new version so phones pick up the new build
  ./Fetra-offline.html one file for Windows or any computer: double-click, works with no internet (NOT locked: keep it private)"""
import json,os,sys,datetime,hashlib
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.primitives import hashes
ITER=310000   # same as app/index.html
app,data,repo,pw=sys.argv[1:5]
here=os.path.dirname(os.path.abspath(__file__))
html=open(app,encoding='utf-8').read()
assert '<script id="fetra-offline">' in html, 'run patch_offline.py first'
now=datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
if os.path.isdir(data):
  docs={}
  for root,_,fs in os.walk(data):
    for f in fs:
      if f.endswith('.json'):
        p=os.path.relpath(os.path.join(root,f[:-5]),data).replace(os.sep,'/')
        docs[p]=json.load(open(os.path.join(root,f),encoding='utf-8'))
  seed={'at':now,'docs':docs}; owner=''
else:
  d=json.load(open(data,encoding='utf-8')); assert d.get('kind')=='fetra-data'
  seed={'at':d['at'],'docs':d['docs']}; owner=d.get('owner','')
if not owner:
  owner=next((p.split('/')[1] for p,v in seed['docs'].items() if p.startswith('roles/') and v.get('role')=='owner'),'')
cfg={'owner':owner,'builtAt':now,'seed':seed}
cfgjs='<script>window.FETRA_OFFLINE='+json.dumps(cfg,ensure_ascii=False).replace('</','<\\/')+';</script>\n'
out=html.replace('<script id="fetra-offline">',cfgjs+'<script id="fetra-offline">',1)
open('Fetra-offline.html','w',encoding='utf-8').write(out)
salt=os.urandom(16); iv=os.urandom(12)
key=PBKDF2HMAC(algorithm=hashes.SHA256(),length=32,salt=salt,iterations=ITER).derive(pw.encode())
ct=AESGCM(key).encrypt(iv,out.encode('utf-8'),None)
os.makedirs(repo+'/app',exist_ok=True)
open(repo+'/app/app.enc','wb').write(salt+iv+ct)
ver=now.replace(':','').replace('-','')+'-'+hashlib.sha256(ct).hexdigest()[:8]
open(repo+'/app/sw.js','w').write(open(here+'/sw.template.js').read().replace('__VERSION__',ver))
print('records',len(seed['docs']),'owner',owner or '-','app.enc',len(salt+iv+ct),'version',ver)
