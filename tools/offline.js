/* FETRA-OFFLINE: keeps the farm data on this device and lets the app run with no internet.
   Two modes:
   - Main app (claude.ai): keeps a copy of every record in this device's storage, and offers
     "save data for the offline copy" and "bring in changes from the offline copy".
   - Offline copy (window.FETRA_OFFLINE set by the installable shell or the single file):
     stands in for claude.ai's db/user/downloads with this device's storage and lists every
     change, so it can be carried back to the main app when there is internet. */
(function(){
const CFG = window.FETRA_OFFLINE || null;
const MAIN_URL = "https://claude.ai/artifact/8JDUdbDysPYgLj79BWNzc4";
const APP_URL = "https://tamelasar-sketch.github.io/Fetra/app/";
const K_DB = "fetraOffline.db", K_MIRROR = "fetraOffline.mirror";
/* every collection the app reads; outbox/<id>/<c> are added per person */
const COLS = ["approvals","roles","fieldcounts","sickrounds","trucks","costs","weather","shifts","todos","spend","export","tags","tagevents","stock","feedlog","briefs","paper","paperscans","outbox"];
const SUBS = ["bank","transfers","requests","sent","progress"];
const ar = () => typeof window.fetraLang==="function" && window.fetraLang()==="ar";
const T = (en,a) => ar() ? a : en;
const load = k => { try{ return JSON.parse(localStorage.getItem(k)||"null"); }catch(_){ return null; } };
const save = (k,v) => { try{ localStorage.setItem(k,JSON.stringify(v)); return true; }catch(_){ return false; } };
const clone = v => v==null ? v : JSON.parse(JSON.stringify(v));
const stamp = () => new Date().toISOString();
const day = () => stamp().slice(0,10);
try{ navigator.storage && navigator.storage.persist && navigator.storage.persist(); }catch(_){}

function giveFile(name, text){
  const blob = new Blob([text], {type: name.endsWith(".html") ? "text/html" : "application/json"});
  if(!CFG && window.claude && claude.use) return claude.use("downloads").then(dl => {
    if(dl) return dl.save({filename:name, data:blob}).then(()=>true);
    return plainDownload(name, blob);
  }).catch(e => e && e.code==="cancelled" ? false : plainDownload(name, blob));
  try{
    const f = new File([blob], name, {type: blob.type});
    if(/iPhone|iPad|Android/i.test(navigator.userAgent) && navigator.canShare && navigator.canShare({files:[f]}))
      return navigator.share({files:[f], title:name}).then(()=>true, ()=>false);
  }catch(_){}
  return plainDownload(name, blob);
}
function plainDownload(name, blob){
  const u = URL.createObjectURL(blob), a = document.createElement("a");
  a.href = u; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(u), 5000);
  return Promise.resolve(true);
}
function pickFile(){
  return new Promise(res => {
    const i = document.createElement("input"); i.type = "file"; i.accept = ".json,application/json";
    i.onchange = () => { const f = i.files && i.files[0]; if(!f) return res(null); f.text().then(t => { try{ res(JSON.parse(t)); }catch(_){ res({bad:true}); } }); };
    i.click();
  });
}

/* ---------- the offline copy: a local stand-in for claude.ai's db ---------- */
function localDb(){
  let st = load(K_DB);
  const seedAt = CFG.seed && CFG.seed.at || "";
  if(!st || (seedAt && (st.seedAt||"") < seedAt && !Object.keys(st.pending||{}).length)) st = {docs: clone((CFG.seed||{}).docs||{}), pending:{}, seedAt, from: seedAt};
  st.pending = st.pending || {};
  const docL = {}, colL = {};
  const persist = () => { if(!save(K_DB, st)) warn(T("This device is out of space: the last change was not kept.","المساحة على الجهاز خلصت: آخر تعديل ما اتحفظش.")); };
  const parent = p => p.slice(0, p.lastIndexOf("/"));
  const snapDoc = (p) => { const d = st.docs[p]; return {id:p.slice(p.lastIndexOf("/")+1), exists: !!d, data: () => clone(d), metadata:{fromCache:true, hasPendingWrites: !!st.pending[p]}}; };
  const inCol = c => Object.keys(st.docs).filter(p => parent(p)===c).sort();
  function snapCol(c, q){
    let docs = inCol(c).map(snapDoc);
    (q.where||[]).forEach(([f,op,v]) => { docs = docs.filter(d => { const x = (d.data()||{})[f];
      return op==="=="||op==="eq" ? x===v : op==="!="||op==="ne" ? x!==v : op==="<" ? x<v : op==="<=" ? x<=v : op===">" ? x>v : op===">=" ? x>=v : op==="in" ? (v||[]).includes(x) : op==="array-contains" ? Array.isArray(x)&&x.includes(v) : true; }); });
    if(q.order){ const [f,dir] = q.order; docs.sort((a,b) => { const x=(a.data()||{})[f], y=(b.data()||{})[f]; return (x>y?1:x<y?-1:0)*(dir==="desc"?-1:1); }); }
    if(q.lim) docs = docs.slice(0, q.lim);
    return {docs, size:docs.length, empty:!docs.length, docChanges:()=>docs.map((d,i)=>({type:"added",doc:d,oldIndex:-1,newIndex:i})), metadata:{fromCache:true,hasPendingWrites:false}};
  }
  function fire(p){
    const c = parent(p);
    setTimeout(() => { (docL[p]||[]).forEach(fn => fn()); (colL[c]||[]).forEach(fn => fn()); }, 0);
  }
  function write(p, data){
    if(data===null) delete st.docs[p]; else st.docs[p] = clone(data);
    st.pending[p] = stamp(); persist(); fire(p); badge(); nag();
  }
  const listen = (map, key, fn) => { (map[key] = map[key]||[]).push(fn); setTimeout(fn, 0); return () => { map[key] = (map[key]||[]).filter(x => x!==fn); }; };
  const rid = () => Array.from(crypto.getRandomValues(new Uint8Array(10)), b => "abcdefghijklmnopqrstuvwxyz0123456789"[b%36]).join("");
  function doc(path){
    const p = path.replace(/^\/+|\/+$/g,"");
    return { id: p.slice(p.lastIndexOf("/")+1), path: p,
      get: async () => snapDoc(p),
      set: async d => write(p, d||{}),
      update: async d => { if(!st.docs[p]) throw {code:"invalid_argument", message:"No such record"}; const n = {...st.docs[p]}; Object.entries(d||{}).forEach(([k,v]) => { if(v && v.__delete__) delete n[k]; else n[k] = v; }); write(p, n); },
      delete: async () => write(p, null),
      acquire: async () => ({acquired:true}),
      onSnapshot: (next) => listen(docL, p, () => next(snapDoc(p))),
      collection: sub => col(p+"/"+sub) };
  }
  function col(path, q){
    const c = path.replace(/^\/+|\/+$/g,""); q = q || {};
    const query = {
      where: (f,op,v) => col(c, {...q, where:[...(q.where||[]), [f,op,v]]}),
      orderBy: (f,dir) => col(c, {...q, order:[f,dir]}),
      limit: n => col(c, {...q, lim:n}),
      get: async () => snapCol(c, q),
      onSnapshot: next => listen(colL, c, () => next(snapCol(c, q))) };
    return Object.assign(query, { path: c,
      doc: id => doc(c+"/"+(id||rid())),
      add: async d => { const r = doc(c+"/"+rid()); await r.set(d); return r; } });
  }
  return { api: {doc, collection: col}, st, persist };
}

let LOCAL = null;
if(CFG){
  LOCAL = localDb();
  const owner = CFG.owner || "local-owner";
  const user = { id: async()=>owner, me: async()=>({id:owner, name:"T"}), isOwner: async()=>true, canEdit: async()=>true,
    can: async()=>true, profiles: async ids => Object.fromEntries((ids||[]).map(i => [i, {id:i, name:(CFG.names||{})[i]||""}])), search: async()=>[] };
  const downloads = { save: ({filename, data}) => (data instanceof Blob ? data.text() : Promise.resolve(String(data))).then(t => giveFile(filename, t)) };
  const caps = { db: LOCAL.api, user, downloads };
  /* Claude (Shatta's free questions, reading photos) and photo storage live on claude.ai: absent here */
  window.claude = { use: name => new Promise(r => setTimeout(() => r(caps[name]||null), 0)) };
}

/* ---------- the main app: keep a copy of every record on this device ---------- */
let mirror = load(K_MIRROR) || {docs:{}, at:""};
async function startMirror(){
  if(CFG || !window.claude || !claude.use) return;
  let db = null; try{ db = await claude.use("db"); }catch(_){}
  if(!db) return;
  let timer = 0;
  const keep = () => { clearTimeout(timer); timer = setTimeout(() => { mirror.at = stamp(); save(K_MIRROR, mirror); }, 800); };
  const watched = {};
  const watch = c => { if(watched[c]) return; watched[c] = true;
    try{ db.collection(c).onSnapshot(snap => {
      Object.keys(mirror.docs).filter(p => p.slice(0,p.lastIndexOf("/"))===c).forEach(p => delete mirror.docs[p]);
      snap.docs.forEach(d => { mirror.docs[c+"/"+d.id] = d.data()||{}; });
      if(c==="outbox"||c==="roles") snap.docs.forEach(d => SUBS.forEach(s => watch("outbox/"+d.id+"/"+s)));
      keep();
    }, ()=>{}); }catch(_){}
  };
  COLS.forEach(watch);
  try{ const u = await claude.use("user"); const id = u && await u.id(); if(id){ mirror.owner = mirror.owner || ((await u.isOwner()) ? id : ""); SUBS.forEach(s => watch("outbox/"+id+"/"+s)); } }catch(_){}
  window.fetraOfflineDb = db;
}

/* ---------- moving data between the two ---------- */
async function saveForOffline(){
  if(!Object.keys(mirror.docs).length){ say(T("Still loading the records, try again in a few seconds.","لسه بيحمّل البيانات، جرّب كمان شوية.")); return; }
  const out = {kind:"fetra-data", at: stamp(), owner: mirror.owner||"", docs: mirror.docs};
  const ok = await giveFile(`Fetra-data-${day()}.json`, JSON.stringify(out));
  say(ok ? T("Saved. In the offline copy tap Offline · Load fresh data and pick this file.","اتحفظ. في النسخة بدون نت اضغط «بدون نت · تحميل بيانات جديدة» واختار الملف ده.") : "");
}
async function bringIn(){
  const f = await pickFile(); if(!f) return;
  if(f.bad || f.kind!=="fetra-changes"){ say(T("That is not a Fetra changes file.","ده مش ملف تعديلات فترة.")); return; }
  const db = window.fetraOfflineDb; if(!db){ say(T("Open the main app to bring changes in.","افتح التطبيق الأساسي عشان تدخل التعديلات.")); return; }
  let n = 0, bad = 0;
  for(const ch of f.changes||[]){
    try{ const r = db.doc(ch.path); if(ch.data===null) await r.delete(); else await r.set(ch.data); n++; }catch(_){ bad++; }
  }
  say(T(`${n} change${n===1?"":"s"} brought in from the offline copy${bad?`, ${bad} could not be saved`:""}.`, `اتضاف ${n} تعديل من النسخة بدون نت${bad?`، و${bad} ما اتحفظوش`:""}.`));
}
async function sendChanges(){
  const st = LOCAL.st, paths = Object.keys(st.pending);
  if(!paths.length){ say(T("Nothing new to send.","مفيش تعديلات جديدة.")); return; }
  const changes = paths.map(p => ({path:p, at:st.pending[p], data: st.docs[p] ? st.docs[p] : null}));
  const ok = await giveFile(`Fetra-changes-${day()}.json`, JSON.stringify({kind:"fetra-changes", at:stamp(), changes}));
  if(ok){ st.sentAt = stamp(); LOCAL.persist(); nag(); badge(); }
  say(ok ? T("Saved. In the main app tap Offline · Bring in changes and pick this file. Then tap Clear sent changes here.","اتحفظ. في التطبيق الأساسي اضغط «بدون نت · إدخال التعديلات» واختار الملف. بعدها اضغط «مسح التعديلات المبعوتة» هنا.") : "");
}
/* changes made since the last "Save changes" */
const unsaved = () => LOCAL ? Object.values(LOCAL.st.pending).filter(at => at > (LOCAL.st.sentAt||"")).length : 0;
/* the reminder strip under the header: offline copy with unsaved changes, or the main app with the internet gone */
function nag(){
  const top = document.querySelector("header.top"); if(!top) return;
  let bar = document.getElementById("offWarn");
  const n = unsaved(), net = navigator.onLine;
  const show = CFG ? n>0 : !net;
  if(!show){ if(bar) bar.remove(); return; }
  if(!bar){ bar = document.createElement("div"); bar.id = "offWarn"; bar.className = "wrap"; top.insertAdjacentElement("afterend", bar); }
  bar.innerHTML = `<div class="ask" role="status" style="display:flex;flex-wrap:wrap;gap:8px 12px;align-items:center;margin-top:10px">
    <span style="flex:1;min-width:200px">${CFG
      ? `<b>${net?T("Not saved","لسه ما اتحفظش"):T("No internet","مفيش نت")}</b> · ${T(`${n} change${n===1?" is":"s are"} only on this device. Tap Save before you close the app, so they can go into the main app.`, `${n} تعديل موجودين على الجهاز ده بس. اضغط «حفظ» قبل ما تقفل التطبيق عشان يدخلوا التطبيق الأساسي.`)}`
      : `<b>${T("No internet","مفيش نت")}</b> · ${T("What you add now may not be saved. Use the offline copy (Offline button), then tap Save there.","اللي هتضيفه دلوقتي ممكن ما يتحفظش. استخدم النسخة بدون نت (زرار بدون نت) واضغط «حفظ» هناك.")}`}</span>
    ${CFG?`<button class="btn sm" id="offWarnSave" type="button">${T("Save","حفظ")}</button>`:""}</div>`;
  const b = document.getElementById("offWarnSave"); if(b) b.onclick = sendChanges;
}
/* closing with unsaved changes: computers show "Leave site?" and stay open on Cancel.
   Phones never ask when an app is swiped away, so the next opening brings up the Save sheet instead. */
window.addEventListener("beforeunload", e => { if(CFG && unsaved()){ e.preventDefault(); e.returnValue = ""; return ""; } });
function clearSent(){
  if(!confirm(T("Only clear once the changes are in the main app. Clear the list?","امسح بس لو التعديلات دخلت التطبيق الأساسي. تمسح القائمة؟"))) return;
  LOCAL.st.pending = {}; LOCAL.persist(); badge(); say(T("Cleared.","اتمسحت."));
}
async function loadFresh(){
  const f = await pickFile(); if(!f) return;
  if(f.bad || f.kind!=="fetra-data"){ say(T("That is not a Fetra data file.","ده مش ملف بيانات فترة.")); return; }
  const st = LOCAL.st, docs = clone(f.docs||{});
  Object.keys(st.pending).forEach(p => { if(st.docs[p]) docs[p] = st.docs[p]; else delete docs[p]; });   // changes not yet sent stay
  st.docs = docs; st.from = f.at; LOCAL.persist(); location.reload();
}

/* ---------- the Offline button and its sheet ---------- */
let msg = "";
function say(m){ msg = m; if(document.getElementById("offBox")) sheet(); }
function warn(m){ msg = m; sheet(); }
const esc = s => String(s).replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
function fmt(iso){ if(!iso) return "–"; const d = new Date(iso); return isNaN(d) ? iso : d.toLocaleString(ar()?"ar-EG":"en-GB",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"}); }
function badge(){
  const b = document.getElementById("offBtn"); if(!b) return;
  const n = LOCAL ? Object.keys(LOCAL.st.pending).length : 0;
  b.textContent = CFG ? T(`Offline copy${n?` · ${n} to send`:""}`, `نسخة بدون نت${n?` · ${n} للإرسال`:""}`) : T("Offline","بدون نت");
  b.title = T("Use Fetra with no internet","استخدم فترة من غير نت");
}
function sheet(){
  const root = document.getElementById("modalRoot") || document.body;
  let box = document.getElementById("offBox");
  if(!box){ box = document.createElement("div"); box.id = "offBox"; box.className = "modal"; root.appendChild(box);
    box.addEventListener("click", e => { if(e.target===box) close(); }); }
  const net = navigator.onLine;
  const btn = (id, en, a, ghost) => `<button class="btn${ghost?" ghost":""}" id="${id}" type="button">${T(en,a)}</button>`;
  let body;
  if(CFG){
    const st = LOCAL.st, n = Object.keys(st.pending).length;
    body = `<h3>${T("Offline copy on this device","نسخة بدون نت على الجهاز ده")}</h3>
      <p class="note" style="margin-top:0">${T("Everything you add here is kept on this device, with or without internet.","أي حاجة تضيفها هنا بتتحفظ على الجهاز، بنت أو من غير نت.")}</p>
      <ul style="margin:8px 0;padding-inline-start:18px">
        <li>${T("Internet now","النت دلوقتي")}: <b>${net?T("on","شغال"):T("off","مقطوع")}</b></li>
        <li>${T("Data from the main app","البيانات من التطبيق الأساسي")}: <b>${esc(fmt(st.from))}</b></li>
        <li>${T("Changes not yet in the main app","تعديلات لسه ما دخلتش التطبيق الأساسي")}: <b>${n}</b>${unsaved()?` · <b style="color:var(--bad)">${T(`${unsaved()} not saved yet`,`${unsaved()} لسه ما اتحفظوش`)}</b>`:""}</li>
        <li>${T("App version","نسخة التطبيق")}: <b>${esc(fmt(CFG.builtAt))}</b></li>
      </ul>
      <div class="links" style="flex-wrap:wrap;gap:8px">${btn("offSend","Save changes for the main app","حفظ التعديلات للتطبيق الأساسي")}${btn("offFresh","Load fresh data","تحميل بيانات جديدة",1)}${n?btn("offClear","Clear sent changes","مسح التعديلات المبعوتة",1):""}</div>
      <p class="note">${T("Needs internet, so not in this copy: Shatta's free questions to Claude (its built-in commands, typed, still work), reading photos of paper sheets, live weather (the last forecast is shown), and map links.","محتاج نت ومش موجود هنا: أسئلة شطة الحرة لكلود (الأوامر العادية مكتوبة شغالة)، قراءة صور الورق، الطقس المباشر (بيظهر آخر توقع)، ولينكات الخرايط.")}</p>
      <p class="note"><a href="${MAIN_URL}" target="_blank" rel="noopener">${T("Open the main app (needs internet)","افتح التطبيق الأساسي (محتاج نت)")}</a></p>`;
  } else {
    const n = Object.keys(mirror.docs).length;
    body = `<h3>${T("Use Fetra with no internet","استخدم فترة من غير نت")}</h3>
      <p class="note" style="margin-top:0">${T("This device keeps a copy of your records","الجهاز ده محتفظ بنسخة من البيانات")}: <b>${n}</b> · ${esc(fmt(mirror.at))}</p>
      <ol style="margin:8px 0;padding-inline-start:18px">
        <li>${T("Install the offline copy once","نزّل النسخة بدون نت مرة واحدة")}: <a href="${APP_URL}" target="_blank" rel="noopener">${APP_URL.replace("https://","")}</a> ${T("(iPhone: Share, Add to Home Screen. Windows: Edge, Install app.)","(آيفون: مشاركة، إضافة للشاشة الرئيسية. ويندوز: إيدج، تثبيت التطبيق.)")}</li>
        <li>${T("To give it today's numbers","عشان تديها أرقام النهارده")}: ${btn("offData","Save data for the offline copy","حفظ البيانات للنسخة بدون نت",1)}</li>
        <li>${T("Back online, bring in what was added offline","لما النت يرجع، دخّل اللي اتضاف من غير نت")}: ${btn("offIn","Bring in changes","إدخال التعديلات",1)}</li>
      </ol>`;
  }
  box.innerHTML = `<div class="box" role="dialog" aria-modal="true" aria-labelledby="offH">${body.replace("<h3>",'<h3 id="offH">')}
    ${msg?`<p class="src" style="margin-top:10px">${esc(msg)}</p>`:""}
    <p style="text-align:end;margin:12px 0 0"><button class="btn ghost sm" id="offClose" type="button">${T("Close","قفل")}</button></p></div>`;
  const on = (id, fn) => { const e = document.getElementById(id); if(e) e.onclick = fn; };
  on("offClose", close); on("offSend", sendChanges); on("offFresh", loadFresh); on("offClear", clearSent); on("offData", saveForOffline); on("offIn", bringIn);
}
function close(){ msg = ""; const b = document.getElementById("offBox"); if(b) b.remove(); }
window.addEventListener("online", () => { badge(); nag(); if(document.getElementById("offBox")) sheet(); });
window.addEventListener("offline", () => { badge(); nag(); if(document.getElementById("offBox")) sheet(); });

function addButton(){
  const brand = document.querySelector("header.top .brand"); if(!brand || document.getElementById("offBtn")) return;
  const b = document.createElement("button"); b.id = "offBtn"; b.type = "button"; b.className = "layoutBtn";
  b.setAttribute("data-noi18n",""); b.onclick = () => { msg = ""; sheet(); };
  const lang = document.getElementById("langBtn"); brand.insertBefore(b, lang ? lang.nextSibling : null);
  badge(); nag();
  /* left last time without saving: ask first thing */
  if(CFG && unsaved()) setTimeout(() => { msg = T("You closed the app last time with changes not saved. Tap Save changes for the main app.","قفلت التطبيق آخر مرة من غير ما تحفظ. اضغط «حفظ التعديلات للتطبيق الأساسي»."); sheet(); }, 1500);
  if(document.documentElement) new MutationObserver(() => { badge(); nag(); }).observe(document.documentElement, {attributes:true, attributeFilter:["dir","lang"]});
}
if(document.readyState==="loading") document.addEventListener("DOMContentLoaded", addButton); else addButton();
setTimeout(addButton, 0);
startMirror();
window.fetraOffline = { sheet, saveForOffline, bringIn, mode: CFG ? "offline" : "main" };
})();
