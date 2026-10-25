/* FETRA-BLACKBOX: an Excel copy of everything in the app, kept on the device like a flight recorder.
   - Laptop (Chrome or Edge, the offline copy or the installed app): pick a folder once (and a second, synced one if wanted).
     Fetra-black-box.xlsx is then rewritten there a few seconds after every change and when the app is put away,
     with a dated copy per day in "Daily copies". If the browser forgets the permission, a bar asks for one tap.
   - iPhone, and the main app on claude.ai (a page inside claude.ai cannot write to folders): one tap saves the file
     (iPhone: Share sheet, Save to Files, On My iPhone). A bar reminds when it has not been saved for a day.
   - Load from Excel: changes typed in Excel (or new rows) come back into the app after a preview. New to-dos get a colour tag.
   Needs window.FetraXlsx, window.FetraBBData (same block) and window.fetraOffline (offline.js). */
(function(){
const X = window.FetraXlsx, D = window.FetraBBData;
const FILE = "Fetra-black-box.xlsx", DAILY = "Daily copies", K = "fetraBB";
const ar = () => typeof window.fetraLang==="function" && window.fetraLang()==="ar";
const T = (en,a) => ar() ? a : en;
const esc = s => String(s).replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const OFF = () => window.fetraOffline || null;
const inFrame = (() => { try{ return window.self!==window.top; }catch(_){ return true; } })();
const canFolder = !inFrame && typeof window.showDirectoryPicker==="function";
const isPhone = /iPhone|iPad|Android/i.test(navigator.userAgent) || (navigator.platform==="MacIntel" && navigator.maxTouchPoints>1);
const stamp = () => new Date().toISOString();
const localDay = () => { const d = new Date(); return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0"); };
const load = () => { try{ return JSON.parse(localStorage.getItem(K)||"{}")||{}; }catch(_){ return {}; } };
let st = load(); st.written = st.written || {};
const keep = () => { try{ localStorage.setItem(K, JSON.stringify(st)); }catch(_){} };
function fmt(iso){ if(!iso) return T("never","لسه"); const d = new Date(iso); return isNaN(d) ? iso : d.toLocaleString(ar()?"ar-EG":"en-GB",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"}); }

/* ---------- folder handles live in IndexedDB (localStorage cannot hold them) ---------- */
const idb = (mode, fn) => new Promise((res, rej) => {
  let r; try{ r = indexedDB.open("fetraBlackBox", 1); }catch(e){ return rej(e); }
  r.onupgradeneeded = () => r.result.createObjectStore("h");
  r.onerror = () => rej(r.error);
  r.onsuccess = () => { const tx = r.result.transaction("h", mode), q = fn(tx.objectStore("h")); tx.oncomplete = () => res(q && q.result); tx.onerror = () => rej(tx.error); };
});
const hGet = k => idb("readonly", s => s.get(k)).catch(() => null);
const hSet = (k, v) => idb("readwrite", s => v ? s.put(v, k) : s.delete(k)).catch(() => null);
const SLOTS = [["local","This laptop","على اللابتوب ده"],["synced","Synced folder (iCloud Drive / OneDrive)","فولدر متزامن (آي كلاود / وان درايف)"]];
const folders = {};
let ready = canFolder ? Promise.all(SLOTS.map(([k]) => hGet(k).then(h => { if(h) folders[k] = h; }))) : Promise.resolve();

/* ---------- making the file ---------- */
function tables(){ try{ return typeof window.fetraTables==="function" ? window.fetraTables() : {}; }catch(_){ return {}; } }
function where(){
  const o = OFF(), mode = o && o.mode==="offline" ? T("offline copy","النسخة بدون نت") : T("main app","التطبيق الأساسي");
  return `${mode} · ${isPhone ? "phone" : "computer"} · ${navigator.onLine ? "online" : "no internet"}`;
}
function records(){ const o = OFF(); return o && o.records ? o.records() : {}; }
function makeFile(){
  const recs = records();
  return X.build(D.sheets(recs, tables(), {at: new Date().toLocaleString("en-GB")+" ("+stamp()+")", from: where()}));
}
const blobOf = bytes => new Blob([bytes], {type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"});

/* ---------- writing to the picked folders ---------- */
let dirty = false, timer = 0, busy = false, needAllow = {}, handEdited = {}, lastErr = "";
async function perm(h, ask){
  try{ const o = {mode:"readwrite"}; let p = await h.queryPermission(o); if(p!=="granted" && ask) p = await h.requestPermission(o); return p; }catch(_){ return "denied"; }
}
async function writeFile(dir, name, bytes){
  const fh = await dir.getFileHandle(name, {create:true}), w = await fh.createWritable();
  await w.write(bytes); await w.close();
  return (await fh.getFile()).lastModified;
}
async function saveFolders(why){
  await ready;
  const keys = Object.keys(folders); if(!keys.length || busy) return false;
  busy = true; let ok = false, bytes = null; lastErr = "";
  try{
    for(const k of keys){
      const h = folders[k];
      if(await perm(h, why==="tap")!=="granted"){ needAllow[k] = true; continue; }
      needAllow[k] = false;
      bytes = bytes || makeFile();
      try{
        /* the file was changed by hand since the app last wrote it: do not overwrite, ask first */
        let fh = null; try{ fh = await h.getFileHandle(FILE); }catch(_){}
        const f = fh && await fh.getFile();
        const was = st.written[k], wasN = (st.writtenSize||{})[k];
        if(f && was && why!=="replace" && (f.lastModified > was + 1000 || (f.lastModified!==was && f.size!==wasN))){ handEdited[k] = fh; }
        else { st.written[k] = await writeFile(h, FILE, bytes); (st.writtenSize = st.writtenSize||{})[k] = bytes.length; delete handEdited[k]; }
        const dd = await h.getDirectoryHandle(DAILY, {create:true});
        await writeFile(dd, `Fetra-black-box-${localDay()}.xlsx`, bytes);
        ok = true;
      }catch(e){ lastErr = e && e.name==="NoModificationAllowedError" ? T("The file is open in Excel: it is saved again once Excel closes it.","الملف مفتوح في إكسل: هيتحفظ تاني لما تقفله.") : String(e && e.message || e); }
    }
    if(ok){ st.lastSaved = stamp(); st.lastWhere = "folder"; dirty = false; keep(); }
  } finally { busy = false; }
  bar(); if(document.getElementById("bbBox")) sheet();
  return ok;
}
function schedule(ms){ clearTimeout(timer); timer = setTimeout(() => { if(dirty) saveFolders("auto"); }, ms); }
window.addEventListener("fetra-change", () => { dirty = true; if(Object.keys(folders).length) schedule(4000); else bar(); });
/* putting the app away (closing, switching app, locking the laptop): save right away */
document.addEventListener("visibilitychange", () => { if(document.visibilityState==="hidden" && dirty) saveFolders("auto"); });
window.addEventListener("pagehide", () => { if(dirty) saveFolders("auto"); });
setInterval(() => { if(dirty && Object.keys(folders).length) saveFolders("auto"); }, 120000);

async function pickFolder(k){
  try{
    const h = await window.showDirectoryPicker({id:"fetra-bb-"+k, mode:"readwrite", startIn:"documents"});
    folders[k] = h; await hSet(k, h); delete st.written[k]; keep();
    say(T(`Saving to the folder "${h.name}".`, `بيتحفظ في فولدر "${h.name}".`));
    await saveFolders("tap");
  }catch(e){ if(!(e && e.name==="AbortError")) say(T("That folder could not be used: ","الفولدر ده ما ينفعش: ")+(e && e.message || e)); }
}
async function forget(k){ delete folders[k]; delete st.written[k]; keep(); await hSet(k, null); sheet(); bar(); }

/* ---------- one-tap save (iPhone, claude.ai, or no folder picked) ---------- */
async function saveNow(){
  if(Object.keys(folders).length){ const ok = await saveFolders("tap"); if(ok){ say(T("Saved to your folder.","اتحفظ في الفولدر.")); return; } }
  const bytes = makeFile(), name = FILE;
  let ok = false;
  try{
    if(inFrame && window.claude && claude.use){
      const dl = await claude.use("downloads");
      if(dl){ await dl.save({filename:name, data:blobOf(bytes)}); ok = true; }
    }
  }catch(e){ if(e && e.code==="declined"){ say(""); return; } }
  if(!ok){
    try{
      const f = new File([bytes], name, {type: blobOf(bytes).type});
      if(isPhone && navigator.canShare && navigator.canShare({files:[f]})){ await navigator.share({files:[f], title:name}); ok = true; }
    }catch(e){ if(e && e.name==="AbortError"){ say(""); return; } }
  }
  if(!ok){
    const u = URL.createObjectURL(blobOf(bytes)), a = document.createElement("a");
    a.href = u; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 8000); ok = true;
  }
  st.lastSaved = st.lastManual = stamp(); st.lastWhere = "file"; dirty = false; keep(); bar();
  say(isPhone ? T("Saved. On iPhone pick Save to Files, then On My iPhone, folder Fetra, and Replace.","اتحفظ. على الآيفون اختار «حفظ في الملفات»، بعدين «على الآيفون»، فولدر Fetra، و«استبدال».")
              : T("Saved to your Downloads folder.","اتحفظ في فولدر التنزيلات."));
}

/* ---------- Excel back into the app ---------- */
let preview = null;
function pickXlsx(){
  return new Promise(res => {
    const i = document.createElement("input"); i.type = "file"; i.accept = ".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    i.onchange = () => { const f = i.files && i.files[0]; res(f || null); }; i.click();
  });
}
async function loadExcel(file, slot){
  if(!file) return;
  let read;
  try{ read = await X.read(new Uint8Array(await file.arrayBuffer())); }catch(e){ say(T("That file could not be read as Excel (.xlsx).","الملف ده ما اتقريش كملف إكسل (.xlsx).")); return; }
  const sh = window.fetraShatta || {};
  const res = D.changes(read, records(), {autoPri: sh.autoPri});
  preview = {res, slot, name: file.name}; msg = ""; sheet();
}
async function applyPreview(){
  const p = preview; if(!p) return; preview = null;
  const o = OFF(); let n = 0, bad = 0;
  for(const w of p.res.writes){ try{ await o.writeDoc(w.path, w.data); n++; }catch(_){ bad++; } }
  const todos = p.res.writes.filter(w => w.isNew && w.todo).length;
  say(T(`${n} change${n===1?"":"s"} saved into the app${todos?` (${todos} new to-do${todos===1?"":"s"}, colour-tagged)`:""}${bad?`, ${bad} could not be saved`:""}.`,
        `اتحفظ ${n} تعديل في التطبيق${todos?` (${todos} مهمة جديدة بلون أولوية)`:""}${bad?`، و${bad} ما اتحفظوش`:""}.`));
  /* rewrite the file at once so the new rows carry their record ids (loading it again adds nothing twice) */
  dirty = true;
  setTimeout(async () => {
    if(Object.keys(folders).length) await saveFolders("replace");
    else say(msg + " " + T("Tap Save now so your Excel file matches the app again.","اضغط «احفظ دلوقتي» عشان ملف الإكسل يبقى زي التطبيق."));
  }, 1500);
}

/* ---------- the bar under the header ---------- */
function bar(){
  const top = document.querySelector("header.top"); if(!top) return;
  let el = document.getElementById("bbBar");
  const nRec = Object.keys(records()).length;
  let html = "";
  const he = Object.keys(handEdited)[0], na = Object.keys(needAllow).find(k => needAllow[k] && folders[k]);
  if(he) html = `<span style="flex:1;min-width:200px"><b>${T("Black box","الصندوق الأسود")}</b> · ${T("You changed the Excel file by hand. Load your changes into the app?","عدّلت ملف الإكسل بإيدك. تدخّل التعديلات في التطبيق؟")}</span>
    <button class="btn sm" id="bbLoadHE" type="button">${T("Load my changes","دخّل تعديلاتي")}</button><button class="btn ghost sm" id="bbReplHE" type="button">${T("Replace it with the app's","استبدله بنسخة التطبيق")}</button>`;
  else if(na) html = `<span style="flex:1;min-width:200px"><b>${T("Black box","الصندوق الأسود")}</b> · ${T("Tap Allow so the Excel copy keeps saving to your folder.","اضغط «سماح» عشان نسخة الإكسل تفضل تتحفظ في الفولدر.")}</span>
    <button class="btn sm" id="bbAllow" type="button">${T("Allow","سماح")}</button>`;
  else if(!Object.keys(folders).length && nRec && (!st.lastSaved || Date.now() - new Date(st.lastSaved) > 20*3600e3) && st.snooze!==localDay())
    html = `<span style="flex:1;min-width:200px"><b>${T("Black box","الصندوق الأسود")}</b> · ${st.lastSaved ? T(`Last Excel copy: ${fmt(st.lastSaved)}. Save today's on this ${isPhone?"phone":"computer"}.`,`آخر نسخة إكسل: ${fmt(st.lastSaved)}. احفظ نسخة النهارده على ${isPhone?"الموبايل":"الجهاز"} ده.`)
      : T(`No Excel copy on this ${isPhone?"phone":"computer"} yet. Save one so you have everything with no internet.`,`لسه مفيش نسخة إكسل على ${isPhone?"الموبايل":"الجهاز"} ده. احفظ واحدة عشان يبقى معاك كل حاجة من غير نت.`)}</span>
    <button class="btn sm" id="bbSaveBar" type="button">${T("Save now","احفظ دلوقتي")}</button><button class="btn ghost sm" id="bbSnooze" type="button" aria-label="${T("Not today","مش النهارده")}">✕</button>`;
  if(!html){ if(el) el.remove(); return; }
  if(!el){ el = document.createElement("div"); el.id = "bbBar"; el.className = "wrap"; el.setAttribute("data-noi18n",""); (document.getElementById("offWarn") || top).insertAdjacentElement("afterend", el); }
  el.innerHTML = `<div class="ask" role="status" style="display:flex;flex-wrap:wrap;gap:8px 12px;align-items:center;margin-top:10px">${html}</div>`;
  const on = (id, fn) => { const e = document.getElementById(id); if(e) e.onclick = fn; };
  on("bbAllow", () => saveFolders("tap"));
  on("bbSaveBar", saveNow);
  on("bbSnooze", () => { st.snooze = localDay(); keep(); bar(); });
  on("bbLoadHE", async () => { const fh = handEdited[he]; try{ await loadExcel(await fh.getFile(), he); }catch(_){ say(T("Could not open the file.","الملف ما اتفتحش.")); } });
  on("bbReplHE", () => { delete handEdited[he]; saveFolders("replace"); });
}

/* ---------- the Black box sheet ---------- */
let msg = "";
function say(m){ msg = m; if(document.getElementById("bbBox")) sheet(); }
function sheet(){
  const root = document.getElementById("modalRoot") || document.body;
  let box = document.getElementById("bbBox");
  if(!box){ box = document.createElement("div"); box.id = "bbBox"; box.className = "modal"; box.setAttribute("data-noi18n",""); root.appendChild(box);
    box.addEventListener("click", e => { if(e.target===box) close(); }); }
  const btn = (id, en, a, ghost) => `<button class="btn${ghost?" ghost":""} sm" id="${id}" type="button">${T(en,a)}</button>`;
  const nRec = Object.keys(records()).length;
  let body = `<h3 id="bbH">${T("Black box: Excel copy of the app","الصندوق الأسود: نسخة إكسل من التطبيق")}</h3>
    <p class="note" style="margin-top:0">${T("Everything in the app (crops, cattle, family money, to-dos, logs) in one Excel file on this device. It opens with no internet in Excel or Numbers, on the laptop or the iPhone.","كل اللي في التطبيق (المحاصيل، المواشي، فلوس العيلة، المهام، السجلات) في ملف إكسل واحد على الجهاز ده. بيفتح من غير نت على إكسل أو نمبرز، على اللابتوب أو الآيفون.")}</p>
    <ul style="margin:8px 0;padding-inline-start:18px">
      <li>${T("Last saved","آخر حفظ")}: <b>${esc(fmt(st.lastSaved))}</b>${dirty?` · <span style="color:var(--warn)">${T("new changes since","فيه تعديلات بعده")}</span>`:""}</li>
      <li>${T("Records in the app","السجلات في التطبيق")}: <b>${nRec}</b></li>
    </ul>`;
  if(preview){
    const r = preview.res, W = r.writes, nn = W.filter(w=>w.isNew).length, nc = W.length - nn;
    const lab = w => { const d = w.data; const c = w.path.split("/")[0];
      const what = w.todo ? `${T("To-do","مهمة")}: ${esc(d.title||"")} ${!d.pri?"":`<span class="pill" style="background:${d.pri==="high"?"var(--bad)":d.pri==="med"?"var(--warn)":"var(--good)"};color:#fff;padding:0 6px;border-radius:8px">${d.pri==="high"?T("red","أحمر"):d.pri==="med"?T("amber","برتقالي"):T("green","أخضر")}</span>`}${d.done?" ✓":""}`
        : `${esc((D.LABEL||{})[c]||c)}: ${esc(d.title||d.note||d.plot||d.date||w.path)}`;
      return `<li>${w.isNew?T("New","جديد"):T("Changed","متعدّل")} · ${what}</li>`; };
    body += `<div class="ask" style="margin:10px 0"><b>${T("From","من")} ${esc(preview.name)}</b>: ${T(`${nc} changed, ${nn} new`,`${nc} متعدّل، ${nn} جديد`)}${r.dup?` · ${T(`${r.dup} already in the app`,`${r.dup} موجودين أصلًا`)}`:""}${r.skipped?` · ${T(`${r.skipped} rows left out (record gone, or that sheet only takes changes)`,`${r.skipped} صف اتساب`)}`:""}
      ${W.length?`<ul style="margin:6px 0;padding-inline-start:18px;max-height:220px;overflow:auto">${W.slice(0,40).map(lab).join("")}${W.length>40?`<li>… ${W.length-40} ${T("more","كمان")}</li>`:""}</ul>`:`<p class="note">${T("Nothing new: the file matches the app.","مفيش جديد: الملف زي التطبيق.")}</p>`}
      <p class="note" style="margin:4px 0">${T("Sheets starting with 'App ·' are read only and are not loaded.","الشيتات اللي بتبدأ بـ 'App ·' للقراءة بس ومش بتدخل.")}</p>
      <div class="links" style="flex-wrap:wrap;gap:8px">${W.length?btn("bbApply","Save these into the app","احفظهم في التطبيق"):""}${btn("bbCancel","Cancel","إلغاء",1)}</div></div>`;
  }
  if(canFolder){
    body += `<h4 style="margin:12px 0 4px">${T("Saves by itself to","بيتحفظ لوحده في")}</h4><ul style="margin:4px 0;padding-inline-start:18px">${SLOTS.map(([k,en,a]) => {
      const h = folders[k];
      return `<li>${T(en,a)}: ${h ? `<b>${esc(h.name)}</b>${needAllow[k]?` · <span style="color:var(--bad)">${T("needs Allow","محتاج سماح")}</span>`:""} ${btn("bbForget-"+k,"Stop","إيقاف",1)}` : btn("bbPick-"+k, k==="local"?"Pick a folder on this laptop":"Pick a synced folder (optional)", k==="local"?"اختار فولدر على اللابتوب":"اختار فولدر متزامن (اختياري)", k!=="local")}</li>`; }).join("")}</ul>
      <p class="note">${T(`It writes ${FILE} a few seconds after each change and when you close or switch away, plus one dated copy a day in "${DAILY}". Pick Documents\\Fetra Black Box for the laptop. For the iPhone too, pick the Fetra folder in iCloud Drive (needs iCloud for Windows): it reaches the iPhone's Files app whenever there is internet.`,`بيكتب ${FILE} بعد كل تعديل بثواني ولما تقفل أو تبدّل، ونسخة بالتاريخ كل يوم في "${DAILY}". للابتوب اختار Documents\\Fetra Black Box. وعشان يوصل للآيفون كمان اختار فولدر Fetra في آي كلاود درايف (محتاج آي كلاود لويندوز): بيوصل لتطبيق الملفات على الآيفون لما يبقى فيه نت.`)}</p>`;
  } else if(inFrame){
    body += `<p class="note">${T("Inside claude.ai the app cannot write to a folder by itself, so this copy saves with one tap (to Downloads on the laptop, to Files on the iPhone). For saving by itself on the laptop, open the offline copy (Offline button) in Chrome or Edge and pick a folder there once.","جوه claude.ai التطبيق مش بيقدر يكتب في فولدر لوحده، فالنسخة دي بتتحفظ بضغطة (في التنزيلات على اللابتوب، وفي الملفات على الآيفون). عشان يتحفظ لوحده على اللابتوب افتح النسخة بدون نت (زرار بدون نت) على كروم أو إيدج واختار فولدر مرة واحدة.")}</p>`;
  } else {
    body += `<p class="note">${isPhone
      ? T("The iPhone does not let any app save files by itself, so it is one tap: Save now, then Save to Files, On My iPhone, folder Fetra, Replace. The file stays on the phone with no internet. A bar reminds you when it is a day old.","الآيفون مش بيسمح لأي تطبيق يحفظ ملفات لوحده، فهي ضغطة واحدة: احفظ دلوقتي، بعدين حفظ في الملفات، على الآيفون، فولدر Fetra، استبدال. الملف بيفضل على الموبايل من غير نت. فيه تنبيه لما يعدّي يوم.")
      : T("This browser cannot save to a folder by itself: use Chrome or Edge for that. Here it saves with one tap.","المتصفح ده مش بيحفظ في فولدر لوحده: استخدم كروم أو إيدج. هنا بيتحفظ بضغطة.")}</p>`;
  }
  body += `<div class="links" style="flex-wrap:wrap;gap:8px;margin-top:6px">${btn("bbSave","Save now","احفظ دلوقتي")}${btn("bbLoad","Load from Excel","تحميل من إكسل",1)}</div>
    <p class="note">${T("Load from Excel: change cells or add rows in the file (leave the 'record' cell empty on a new row), then pick the file here. You see the changes before anything is saved. New to-dos get a colour tag: red urgent, amber soon, green routine.","تحميل من إكسل: عدّل الخانات أو ضيف صفوف في الملف (سيب خانة 'record' فاضية في الصف الجديد)، واختار الملف هنا. هتشوف التغييرات قبل ما يتحفظ أي حاجة. المهام الجديدة بتاخد لون: أحمر عاجل، برتقالي قريب، أخضر روتيني.")}</p>`;
  box.innerHTML = `<div class="box" role="dialog" aria-modal="true" aria-labelledby="bbH">${body}
    ${msg||lastErr?`<p class="src" style="margin-top:10px">${esc(msg||lastErr)}</p>`:""}
    <p style="text-align:end;margin:12px 0 0"><button class="btn ghost sm" id="bbClose" type="button">${T("Close","قفل")}</button></p></div>`;
  const on = (id, fn) => { const e = document.getElementById(id); if(e) e.onclick = fn; };
  on("bbClose", close); on("bbSave", saveNow); on("bbLoad", async () => loadExcel(await pickXlsx()));
  on("bbApply", applyPreview); on("bbCancel", () => { preview = null; sheet(); });
  SLOTS.forEach(([k]) => { on("bbPick-"+k, () => pickFolder(k)); on("bbForget-"+k, () => forget(k)); });
}
function close(){ msg = ""; preview = null; const b = document.getElementById("bbBox"); if(b) b.remove(); }

function addButton(){
  const brand = document.querySelector("header.top .brand"); if(!brand || document.getElementById("bbBtn")) return;
  const b = document.createElement("button"); b.id = "bbBtn"; b.type = "button"; b.className = "layoutBtn";
  b.setAttribute("data-noi18n",""); b.onclick = () => { msg = ""; sheet(); };
  const off = document.getElementById("offBtn"), lang = document.getElementById("langBtn");
  brand.insertBefore(b, off ? off.nextSibling : lang ? lang.nextSibling : null);
  label(); bar();
  if(document.documentElement) new MutationObserver(() => { label(); bar(); }).observe(document.documentElement, {attributes:true, attributeFilter:["dir","lang"]});
}
function label(){ const b = document.getElementById("bbBtn"); if(b){ b.textContent = T("Black box","الصندوق الأسود"); b.title = T("Excel copy of everything, kept on this device","نسخة إكسل من كل حاجة، على الجهاز ده"); } }
if(document.readyState==="loading") document.addEventListener("DOMContentLoaded", addButton); else addButton();
setTimeout(addButton, 0);
/* first save after opening, once the records are in */
ready.then(() => setTimeout(() => { bar(); if(Object.keys(folders).length){ dirty = true; saveFolders("auto"); } }, 6000));
window.fetraBlackBox = { sheet, saveNow, makeFile, loadExcel, folders: () => Object.keys(folders) };
})();
