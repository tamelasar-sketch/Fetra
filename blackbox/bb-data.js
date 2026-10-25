/* FETRA-BLACKBOX data: turns the app's records into Excel sheets, and an edited Excel file back into record changes.
   Shared by the app (blackbox.js) and Claude's nightly copy (build_blackbox.js).
   - sheets(records, tables, meta) -> sheets for FetraXlsx.build. records: {"todos/t01": {...}, ...}; tables: {NAME: value} built into the app.
   - changes(sheetsRead, records, opts) -> {writes:[{path,data,isNew,todo}], skipped, notes} */
(function(root){
const LABEL = {todos:"To-dos", bbnotes:"My notes", trucks:"Banana trucks", costs:"Costs & prices", spend:"Spending", shifts:"Work shifts",
  fieldcounts:"Field counts", sickrounds:"Sick-tree rounds", tags:"Cattle tags", tagevents:"Cattle tag events", stock:"Store stock",
  feedlog:"Feed log", weather:"Weather", briefs:"Daily briefs", paper:"Paper sheets", paperscans:"Paper scans", approvals:"Approvals",
  roles:"People & roles", export:"Export plan", outbox:"Outbox"};
const ORDER = ["todos","bbnotes","trucks","spend","costs","shifts","fieldcounts","sickrounds","tags","tagevents","feedlog","stock","paper","paperscans","export","weather","briefs","approvals","roles","outbox"];
/* columns shown first, when a sheet has them */
const FIRST = ["title","pri","done","farm","grp","kind","date","plot","note","at","doneAt"];
/* sheets T can add rows to, and the defaults a new row gets */
const ADDABLE = {todos:1, bbnotes:1, trucks:1, spend:1, shifts:1, feedlog:1, stock:1, tagevents:1, sickrounds:1, fieldcounts:1, costs:1};
const TABLES = [ /* built into the app: [name, label, column names for rows that are plain lists] */
  ["SALES","Banana sales by month",["month","trucks","gross kg","net kg","EGP"]], ["TRUCKS","Banana trucks (built in)",["date","plot","gross kg","net kg","EGP"]],
  ["BANANA_PLOTS","Banana plots"], ["OTHER_PLOTS","Other plots"], ["AREAS","Farm areas",["name","colour","what is there"]], ["PLOT_CODE","Plot codes"],
  ["BAN","Banana figures"], ["SAT_PLANT","Banana planting (sat.)"], ["NDVI","Banana health (NDVI)"], ["BENCH","Banana benchmarks"], ["rpl","Banana replant plan"],
  ["POTATO25","Potato 2025"], ["POTATO26","Potato 2026"], ["CORN26","Corn 2026"], ["rot","Crop rotation"],
  ["ops","Operations"], ["crews","Crews"], ["services","Services & workforce"], ["JUNE_LAB","Labour log (June sheet)",["date","area","job","contractor","workers","x","rate","EGP"]],
  ["TRANSPORT","Transport prices",["way","EGP"]], ["energy","Energy & running costs"],
  ["PRICE_LIST","Price list"], ["PROGS","Fertiliser programmes"], ["FERT_GROUPS","Fertiliser groups"], ["PAYER","Who pays"],
  ["HERD","Herd (Vita)"], ["GROW","Herd growth"], ["HEALTH","Herd health plan"], ["FEED","Feed (concentrate)"], ["TV_PRICES","Cattle prices"], ["TV_RATION","Ration"], ["TV_SPENT","Herd spending"],
  ["FP_ITEMS","Feed plan items",["key","item","unit"]], ["FP_STAGES","Feed plan stages",["stage","name","aim"]], ["FP_PRICES","Feed prices"], ["FP_SEASONS","Cattle price seasons",["season","EGP per kg","why"]], ["FP_EID","Eid dates",["eid","date"]],
  ["INV","Store inventory"], ["FAM","Family payouts",["month","total","paid to","EGP"]], ["CASH","Cash position"], ["cf","Cash-flow plan"], ["exPlan","Export plan"],
  ["practices","Practices"], ["certBodies","Certification bodies"], ["GOALS","Goals"]];
const SKIP_KEYS = new Set(["pts","poly","geom","coords","ring","kmlPts"]);
const isObj = v => v && typeof v==="object" && !Array.isArray(v);
const flat = v => v==null ? null : typeof v==="object" ? JSON.stringify(v) : v;
const parentOf = p => p.slice(0, p.lastIndexOf("/"));
const sheetKey = p => { const s = parentOf(p).split("/"); return s.filter((_,i)=>i%2===0).join("-"); };   // outbox/u1/bank -> outbox-bank
const labelOf = k => LABEL[k] || (k.startsWith("outbox-") ? "Outbox · "+k.slice(7) : k);
const priStyle = v => v==="high" ? 2 : v==="med" ? 3 : v==="low" ? 4 : 0;

function colsOf(objs){
  const n = {}; objs.forEach(o => Object.keys(o||{}).forEach(k => { if(!SKIP_KEYS.has(k)) n[k] = (n[k]||0)+1; }));
  const ks = Object.keys(n);
  return [...FIRST.filter(k => n[k]), ...ks.filter(k => !FIRST.includes(k)).sort((a,b) => n[b]-n[a] || a.localeCompare(b))];
}
function recordSheet(key, paths, records){
  const cols = colsOf(paths.map(p => records[p]));
  if(key==="todos") ["title","pri","done","farm","grp","note"].forEach((k,i) => { if(!cols.includes(k)) cols.splice(i,0,k); });
  if(key==="bbnotes") ["date","sector","note"].forEach((k,i) => { if(!cols.includes(k)) cols.splice(i,0,k); });
  const rows = [["record", ...cols]];
  const done = cols.indexOf("done");
  paths.sort((a,b) => key==="todos" ? (!!records[a].done - !!records[b].done) || ["high","med","low"].indexOf(records[a].pri) - ["high","med","low"].indexOf(records[b].pri) || a.localeCompare(b) : a.localeCompare(b))
    .forEach(p => rows.push([p, ...cols.map(c => flat(records[p][c]))]));
  const pc = cols.indexOf("pri")+1;
  return {name: labelOf(key), key, header:true, rows,
    style: pc>0 ? (r,c,v) => c===pc ? priStyle(v) : 0 : null};
}
/* any value built into the app -> a table */
function tableRows(v, cols){
  const asRow = a => a.map(x => Array.isArray(x) && x.every(y => !isObj(y) && !Array.isArray(y)) ? x.join(", ") : flat(x));
  if(Array.isArray(v)){
    if(!v.length) return [["(empty)"]];
    if(v.every(isObj)){ const c = colsOf(v); return [c, ...v.map(o => c.map(k => flat(o[k])))]; }
    if(v.every(Array.isArray)){
      // [month,total,[[who,amount],...]] -> one row per inner pair
      const nest = v.some(r => r.some(x => Array.isArray(x) && x.length && x.every(Array.isArray)));
      if(nest){ const out = [cols || []]; v.forEach(r => { const head = r.filter(x => !Array.isArray(x)), inner = r.find(x => Array.isArray(x) && x.every(Array.isArray)) || [];
        if(!inner.length) out.push(asRow(head)); inner.forEach(i => out.push([...asRow(head), ...asRow(i)])); }); if(!cols) out[0] = out[1].map((_,i)=>"col "+(i+1)); return out; }
      const w = Math.max(...v.map(r=>r.length)); return [cols && cols.length>=w ? cols : Array.from({length:w},(_,i)=>(cols&&cols[i])||"col "+(i+1)), ...v.map(asRow)];
    }
    return [["value"], ...v.map(x => [flat(x)])];
  }
  if(isObj(v)){
    const vals = Object.values(v);
    if(vals.length && vals.every(isObj)){ const c = colsOf(vals); return [["key", ...c], ...Object.entries(v).map(([k,o]) => [k, ...c.map(f => flat(o[f]))])]; }
    if(vals.length && vals.every(a => Array.isArray(a) && a.every(Array.isArray))){
      const w = Math.max(0,...vals.flat().map(r=>r.length)); return [["key", ...Array.from({length:w},(_,i)=>(cols&&cols[i])||"col "+(i+1))], ...Object.entries(v).flatMap(([k,a]) => a.map(r => [k, ...asRow(r)]))];
    }
    if(vals.length && vals.every(a => Array.isArray(a))) return [["key", ...(cols||[]).slice(0, Math.max(...vals.map(a=>a.length)))], ...Object.entries(v).map(([k,a]) => [k, ...asRow(a)])];
    return [["item","value"], ...Object.entries(v).filter(([k]) => !SKIP_KEYS.has(k)).map(([k,x]) => [k, flat(x)])];
  }
  return [["value"], [flat(v)]];
}
function readMe(meta, counts){
  const L = [
    ["Fetra black box","صندوق فترة الأسود"],
    ["Saved",meta.at||""], ["From",meta.from||""], ["Records",String(counts.records)], ["App tables",String(counts.tables)],
    ["",""],
    ["What this file is","الملف ده إيه"],
    ["A full copy of the Fetra app (Terra crops, Vita cattle, Familia money, to-dos, logs). It opens with no internet in Excel (Windows, Mac, iPhone) or Numbers.","نسخة كاملة من تطبيق فترة (محاصيل تيرا، مواشي فيتا، فلوس العيلة، المهام، السجلات). بيفتح من غير نت على إكسل (ويندوز، ماك، آيفون) أو نمبرز."],
    ["",""],
    ["How to change or add","إزاي تعدّل أو تضيف"],
    ["Sheets with a 'record' column are the app's own records. Change a cell, or add a new row at the bottom with the 'record' cell left empty.","الشيتات اللي فيها عمود 'record' هي سجلات التطبيق. عدّل أي خانة، أو ضيف صف جديد تحت وسيب خانة 'record' فاضية."],
    ["Then in the app: Black box · Load from Excel, pick this file. The app shows what changed before it saves anything.","بعدها في التطبيق: الصندوق الأسود · تحميل من إكسل، واختار الملف ده. التطبيق بيوريك التغييرات قبل ما يحفظ."],
    ["To-dos: 'pri' is the colour tag: high = red (urgent), med = amber (soon), low = green (routine). Leave it empty on a new to-do and the app picks one.","المهام: 'pri' هو لون الأولوية: high أحمر (عاجل)، med برتقالي (قريب)، low أخضر (روتيني). لو سبته فاضي التطبيق بيختار."],
    ["'farm' is TF = Terra Fetra crops, TV = Terra Vita cattle, FF = Familia money. 'done' is TRUE or FALSE.","'farm' يعني TF محاصيل تيرا فترة، TV مواشي تيرا فيتا، FF فلوس العيلة. 'done' يا TRUE يا FALSE."],
    ["'My notes' is yours: write anything (date, sector, note). It is kept in the app too.","شيت 'My notes' بتاعك: اكتب أي حاجة (تاريخ، قطاع، ملاحظة). بتتحفظ في التطبيق كمان."],
    ["Sheets starting with 'App ·' are the figures built into the app. Read only: changes there are not loaded back. Ask Claude to change them.","الشيتات اللي بتبدأ بـ 'App ·' أرقام جوه التطبيق. للقراءة بس: التعديل فيها مش بيرجع للتطبيق. اطلب من كلود يغيرها."],
    ["Keep the file name and the first row of each sheet as they are. Cells with [ ] or { } hold lists: edit them carefully or leave them.","سيب اسم الملف وأول صف في كل شيت زي ما هم. الخانات اللي فيها [ ] أو { } قوايم: عدّلها بحرص أو سيبها."],
  ];
  return {name:"Read me", rows:L, widths:[48,90], style:(r,c) => r===0 ? 5 : ([6,9].includes(r) ? 5 : (r>=7 ? 6 : 0))};
}
function sheets(records, tables, meta){
  records = records || {}; tables = tables || {};
  const groups = {};
  Object.keys(records).forEach(p => { if(isObj(records[p])) (groups[sheetKey(p)] = groups[sheetKey(p)]||[]).push(p); });
  ["todos","bbnotes"].forEach(k => groups[k] = groups[k] || []);
  const keys = Object.keys(groups).sort((a,b) => { const ia = ORDER.indexOf(a.split("-")[0]), ib = ORDER.indexOf(b.split("-")[0]); return (ia<0?99:ia)-(ib<0?99:ib) || a.localeCompare(b); });
  const out = keys.map(k => recordSheet(k, groups[k], records));
  let nt = 0;
  TABLES.forEach(([n, label, cols]) => { if(tables[n]===undefined || tables[n]===null) return; nt++;
    let rows; try{ rows = tableRows(tables[n], cols); }catch(_){ rows = [["value"],[flat(tables[n])]]; }
    out.push({name:"App · "+label, key:"app:"+n, header:true, rows}); });
  const idx = {name:"_index", hidden:true, header:true, rows:[["sheet","collection","kind"], ...out.map(s => [s.name, s.key, s.key.startsWith("app:") ? "read-only" : "records"])]};
  /* each record as it was when the file was saved: on loading, only cells changed in Excel are taken, so newer app changes stay */
  const CH = 30000, base = {name:"_base", hidden:true, header:true, rows:[["record","json"]]};
  Object.keys(records).sort().forEach(p => { const j = JSON.stringify(records[p]); const r = [p]; for(let i=0;i<j.length;i+=CH) r.push(j.slice(i,i+CH)); base.rows.push(r); });
  return [readMe(meta||{}, {records:Object.keys(records).length, tables:nt}), ...out, idx, base];
}

/* ---------- Excel back into the app ---------- */
const BAD_CUT = s => typeof s==="string" && s.endsWith((root.FetraXlsx||{}).CUT || " …[cut here: the full text is kept in the app]");
const isDateStr = s => typeof s==="string" && /^\d{4}-\d\d-\d\d/.test(s);
const serialToISO = n => new Date(Math.round((n - 25569) * 864e5)).toISOString();
function coerce(old, v, field){
  if(v===null || v===undefined || v==="") return undefined;
  if(typeof v==="string") v = v.replace(/\r\n/g,"\n");
  if(typeof old==="number"){ const n = typeof v==="number" ? v : Number(String(v).replace(/[, ]/g,"")); return isFinite(n) ? n : v; }
  if(typeof old==="boolean"){ if(typeof v==="boolean") return v; const s = String(v).trim().toLowerCase(); return ["true","yes","1","done","x","✓","نعم","اه","تم"].includes(s) ? true : ["false","no","0","","لا"].includes(s) ? false : v; }
  if(old && typeof old==="object"){ try{ return JSON.parse(v); }catch(_){ return v; } }
  if(typeof old==="string"){
    if(typeof v==="number" && isDateStr(old) && v>20000 && v<80000) return old.length<=10 ? serialToISO(v).slice(0,10) : serialToISO(v);
    return typeof v==="string" ? v : String(v);
  }
  /* a field the record did not have */
  if(typeof v==="number" && /^(date|at|doneAt|due|when)$/i.test(field||"") && v>20000 && v<80000) return serialToISO(v).slice(0,10);
  if(typeof v==="string" && /^\s*[\[{]/.test(v)){ try{ return JSON.parse(v); }catch(_){} }
  if(typeof v==="string" && /^(done)$/.test(field||"")){ const s = v.trim().toLowerCase(); if(["true","yes","1","x","✓"].includes(s)) return true; if(["false","no","0"].includes(s)) return false; }
  return v;
}
const same = (a,b) => JSON.stringify(a)===JSON.stringify(b);
/* used when the voice assistant (Shatta) is not loaded: the same colour words */
function basicPri(t){
  const n = String(t||"").toLowerCase();
  if(/\b(red|urgent|urgently|asap|emergency|immediately|today|tonight|sick|dying|dead|broken|burst|fire|vet|critical)\b|عاجل|ضروري|حالا|فورا|النهارده|مريض|نافق|عطلان|طوارئ|بيطري|احمر|أحمر|مستعجل/.test(n)) return "high";
  if(/\b(amber|yellow|orange|soon|tomorrow|this week|next week)\b|قريب|بكره|بكرا|الاسبوع|الأسبوع|اصفر|برتقالي/.test(n)) return "med";
  return "low";
}
function basicFarm(t){
  const n = String(t||"").toLowerCase();
  if(/cattle|calf|calves|\bcow|herd|feed|silage|vaccin|weigh|\bvet\b|bull|بيطري|عجل|عجول|بقر|مواشي|علف|سيلاج|تحصين|وزن/.test(n)) return "TV";
  if(/family|mami|mommy|baligh|bank|charity|house|عيله|عيلة|ماما|بليغ|بنك|صدق|البيت/.test(n)) return "FF";
  return "TF";
}
function changes(read, records, opts){
  opts = opts || {}; records = records || {};
  const rid = opts.rid || (() => "xl-" + Date.now().toString(36) + Math.random().toString(36).slice(2,7));
  const index = {}; const ix = read.find(s => s.name==="_index");
  if(ix) ix.rows.slice(1).forEach(r => { if(r[0]) index[r[0]] = r[1]; });
  const base = {}; const bs = read.find(s => s.name==="_base");
  if(bs) bs.rows.slice(1).forEach(r => { if(r && r[0]) try{ base[r[0]] = JSON.parse(r.slice(1).filter(x => x!=null).join("")); }catch(_){} });
  const autoPri = opts.autoPri || basicPri, farmOf = opts.farmOf || basicFarm;
  const byLabel = {}; Object.entries(LABEL).forEach(([k,l]) => byLabel[l] = k);
  const writes = [], notes = []; let skipped = 0, readOnly = 0, dup = 0;
  for(const sh of read){
    if(sh.name==="Read me" || sh.name==="_index" || sh.name==="_base") continue;
    const key = index[sh.name] || byLabel[sh.name] || (String(sh.name).startsWith("App ·") ? "app:" : null);
    if(!key || key.startsWith("app:")){ if(key) readOnly++; continue; }
    const head = (sh.rows[0]||[]).map(h => h==null ? "" : String(h).trim());
    const rc = head.indexOf("record"); if(rc<0) continue;
    for(const row of sh.rows.slice(1)){
      if(!row || row.every(v => v===null || v===undefined || v==="")) continue;
      const path = row[rc] ? String(row[rc]).trim() : "";
      if(path){
        const cur = records[path];
        if(!cur){ skipped++; continue; }
        /* was: the record as the file had it (or, for an older file, as the app has it now) */
        const was = base[path] || cur;
        const nw = JSON.parse(JSON.stringify(cur)); let ch = false;
        head.forEach((f,c) => { if(!f || c===rc) return; const v = row[c];
          if(BAD_CUT(v)) return;
          const val = coerce(was[f], v, f);
          if(val===undefined){ if(was[f]!==undefined && was[f]!==null && was[f]!=="" && typeof was[f]!=="object" && f in nw){ delete nw[f]; ch = true; } return; }
          if(!same(val, was[f]) && !same(val, cur[f])){ nw[f] = val; ch = true; } });
        if(ch) writes.push({path, data:nw, isNew:false, todo: key==="todos"});
      } else {
        if(!ADDABLE[key]){ skipped++; continue; }
        const d = {};
        head.forEach((f,c) => { if(!f || c===rc) return; const val = coerce(undefined, row[c], f); if(val!==undefined) d[f] = val; });
        if(!Object.keys(d).length) continue;
        const PW = {high:"high",red:"high",urgent:"high","1":"high",med:"med",medium:"med",amber:"med",soon:"med","2":"med",low:"low",green:"low",routine:"low","3":"low"};
        if(key==="todos" && d.pri!==undefined && PW[String(d.pri).trim().toLowerCase()]) d.pri = PW[String(d.pri).trim().toLowerCase()];
        if(key==="todos" && d.farm!==undefined) d.farm = String(d.farm).trim().toUpperCase();
        /* the same row loaded twice (the file was not saved again in between): skip it */
        if(Object.keys(records).some(p => parentOf(p)===key && Object.keys(d).every(f => same(records[p][f], d[f])))){ dup++; continue; }
        const now = (opts.now || new Date().toISOString());
        d.at = d.at || now; d.src = d.src || "excel";
        if(key==="todos"){
          if(!d.title){ d.title = d.note || "(no title)"; }
          const pw = String(d.pri||"").trim().toLowerCase();
          d.pri = PW[pw] || autoPri(pw+" "+d.title+" "+(d.note||""));
          d.done = d.done===true; d.kind = d.kind || "Plan";
          d.farm = ["TF","TV","FF"].includes(String(d.farm||"").toUpperCase()) ? String(d.farm).toUpperCase() : farmOf(d.title+" "+(d.note||"")) || "TF";
          d.grp = d.grp || "Other";
        }
        if(key==="bbnotes"){ d.date = d.date || now.slice(0,10); }
        writes.push({path: key+"/"+rid(), data:d, isNew:true, todo: key==="todos"});
      }
    }
  }
  return {writes, skipped, readOnly, dup};
}
const api = {sheets, changes, coerce, TABLES, LABEL};
if(typeof module!=="undefined" && module.exports) module.exports = api; else root.FetraBBData = api;
})(typeof window!=="undefined" ? window : globalThis);
