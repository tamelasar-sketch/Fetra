/* ---------- SHATTA · voice assistant (T, 25 Oct 2026) ----------
   A small round button that floats over every page (drag it anywhere; it remembers where). Tap it and say
   "Shatta" then a command, in English or Arabic (it follows the app's language switch). Shatta takes you to the
   company, step or page, answers questions from the app's own numbers, adds colour-tagged to-dos, and talks back.
   No microphone on this screen? Type the command in the same box; Shatta still answers out loud.
   Anything the built-in commands don't cover goes to Claude (the page's `sample` capability) with today's numbers.
   Only reads the app's data, except "add a to-do", which writes one row to `todos` like the Home quick-add. */
(function(){
if(document.getElementById("shBtn")) return;
const safe = (f,d) => { try{ return f(); }catch(_){ return d; } };
const lsGet = (k,d) => { try{ const v=localStorage.getItem(k); return v==null?d:JSON.parse(v); }catch(_){ return d; } };
const lsSet = (k,v) => { try{ localStorage.setItem(k,JSON.stringify(v)); }catch(_){} };
const isAr = () => typeof fetraLang==="function" && fetraLang()==="ar";
const L = (en,ar_) => isAr() ? ar_ : en;
const h = s => String(s==null?"":s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const today = () => safe(()=>dayLocal(), new Date().toISOString().slice(0,10));
/* lower case, no Arabic diacritics, one spelling of alef / ta marbuta / ya, no punctuation */
const norm = s => String(s||"").toLowerCase().replace(/[ً-ْـ]/g,"").replace(/[أإآ]/g,"ا").replace(/ة/g,"ه").replace(/ى/g,"ي")
  .replace(/[^\p{L}\p{N}\s-]/gu," ").replace(/-/g," ").replace(/\s+/g," ").trim();
const has = (t, words) => words.some(w => (" "+t+" ").includes(" "+norm(w)+" "));
const hasRe = (t, re) => re.test(t);

/* ---- where things are ---- */
const COS = [
  {f:"TF", en:"Fetra Terra", ar:"فترة تيرا", w:["terra","tera","terah","crops","crop","plants","farming","fields","تيرا","المحاصيل","محاصيل","الزراعه","الزرع","النباتات"]},
  {f:"TV", en:"Fetra Vita", ar:"فترة فيتا", w:["vita","veta","vitae","livestock","animals","cattle","herd","cows","فيتا","المواشي","مواشي","الماشيه","الحيوانات","البهايم","العجول"]},
  {f:"FF", en:"Fetra Familia", ar:"فترة فاميليا", w:["familia","family","famiglia","فاميليا","العيله","العائله","الاسره"]},
  {f:"all", en:"Fetra Group", ar:"مجموعة فترة", w:["group","whole group","everything","all companies","the group","المجموعه","الكل","كل الشركات"]}
];
const STEPS = [
  {k:"today", en:"Today", ar:"النهارده", w:["today","home","summary","اليوم","النهارده","الرئيسيه","الملخص"]},
  {k:"money", en:"Money", ar:"الفلوس", w:["money","finance","finances","accounts","profit","الفلوس","فلوس","المال","الماليه","الحسابات","الربح"]},
  {k:"prod", en:"Production", ar:"الإنتاج", w:["production","produce","operations","land","الانتاج","انتاج","التشغيل"]},
  {k:"future", en:"Future", ar:"المستقبل", w:["future","plans","planning","forecast","المستقبل","الخطه","الخطط","التوقعات"]},
  {k:"inbox", en:"Inbox", ar:"الوارد", w:["inbox","alerts","notifications","messages","الوارد","التنبيهات","الاشعارات","الرسايل"]}
];
/* pages: id, the company it belongs to, words that name it */
const PAGES = [
  ["c-banana","TF",["banana","bananas","banana page","موز","الموز"]],
  ["c-potato","TF",["potato","potatoes","بطاطس","البطاطس"]],
  ["c-clover","TF",["clover","برسيم","البرسيم"]],
  ["c-wheat","TF",["wheat","قمح","القمح"]],
  ["c-corn","TF",["corn","maize","ذره","الذره"]],
  ["c-soy","TF",["soy","soya","soybean","soybeans","صويا","الصويا"]],
  ["c-persimmon","TF",["persimmon","persimmons","kaka","كاكا","الكاكا"]],
  ["c-herbs","TF",["herbs","spices","herbs and spices","اعشاب","الاعشاب","التوابل"]],
  ["c-stevia","TF",["stevia","ستيفيا","الستيفيا"]],
  ["c-cattle","TV",["arabawi","cattle page","the cattle","عرباوي","العرباوي"]],
  ["plots","TF",["plots","plot","land and plots","map","maps","قطع","القطع","الارض","الخريطه","الحيازات"]],
  ["timing","TF",["harvest timing","harvest","الحصاد","مواعيد الحصاد","القطع والحصاد"]],
  ["bcal","TF",["banana calendar","تقويم الموز"]],
  ["replant","TF",["replant","replanting","replant plan","تجديد","اعاده الزراعه","خطه التجديد"]],
  ["costs","TF",["crop costs","costs","expenses","تكاليف","التكاليف","المصاريف"]],
  ["trees","TF",["tree health","sick trees","diseases","صحه الاشجار","الاشجار المريضه","الامراض"]],
  ["store","TF",["warehouse","store","fertilizer store","المخزن","المخازن","السماد"]],
  ["ops","*",["daily operations","operations log","work log","العمليات","العمليات اليوميه","الشغل اليومي"]],
  ["shifts","TF",["crew shifts","shifts","الورديات","ورديات"]],
  ["team","TF",["workforce","workers","team","labour","labor","services","العمال","العماله","الفريق","الخدمات"]],
  ["herd","TV",["herd page","fetra vita page","weigh ins","weighing","القطيع","الوزن"]],
  ["feedinv","TV",["feed store","feed","concentrate","silage","العلف","مخزن العلف","السيلاج","المركزات"]],
  ["feedplan","TV",["feed plan","sale forecast","feed forecast","خطه العلف","توقع البيع"]],
  ["cash","FF",["money manager","cash","cash flow","السيوله","الكاش","مدير الفلوس"]],
  ["spend","FF",["manager spend","spending","مصاريف المدير","الصرف"]],
  ["bank","FF",["bank","baligh","البنك","بليغ"]],
  ["family","FF",["family payouts","payouts","charity","المصروف","الصدقات","العيله"]],
  ["ask","FF",["mami","mommy","mami's transfers","transfers","ماما","مامي","تحويلات"]],
  ["leaks","*",["profit leaks","leaks","losses","money losing","التسريب","الخساير","الخسائر","تسريب"]],
  ["todo","*",["to do","to dos","todo","todos","to do list","tasks","task list","المهام","مهام","قائمه المهام"]],
  ["overview","all",["overview","calendar","year calendar","نظره عامه","التقويم","النتيجه"]],
  ["today","all",["daily numbers","weather","forecast page","الطقس","الجو","ارقام اليوم"]],
  ["goals","all",["goals","targets","الاهداف","اهداف"]],
  ["plan","all",["planner","scenarios","scenario","المخطط","السيناريوهات"]],
  ["crops","TF",["crops and cycles","cycles","life cycles","الدورات","دوره الحياه"]],
  ["export","TF",["export","marketing","التصدير","التسويق"]],
  ["learn","*",["practices","latest practices","research","الممارسات","الابحاث","افضل الممارسات"]],
  ["reports","*",["reports","certification","certificates","التقارير","الشهادات","الاعتماد"]],
  ["printouts","*",["printouts","print","paper sheets","المطبوعات","الطباعه","الورق"]],
  ["paper","*",["weekly sheets","scan","scans","الكشوف","المسح"]],
  ["inbox","*",["inbox","alerts","الوارد","التنبيهات"]],
  ["home","*",["home","home page","main page","الرئيسيه","الصفحه الرئيسيه"]]
];
const tabExists = id => safe(()=>TABS.some(t=>t[0]===id), false);
const tabLabel = id => { const n=safe(()=>(TABS.find(t=>t[0]===id)||[,id])[1], id); const t=safe(()=>isAr()&&window.fetraTr&&fetraTr(n),null); return t||n; };

/* ---- going places ---- */
function setFarm(f){ if(f==null||f===farm) return; farm=f; const sel=document.getElementById("farmSel"); if(sel) sel.value=f; }
function clickStep(k){
  const b=document.querySelector(`#calmBar [data-cstep="${k}"]`)||document.querySelector(`#calmNav [data-cstep="${k}"]`);
  if(b){ b.click(); return true; } return false;
}
const CLASSIC_STEP = {today:"today",money:"money",prod:"plots",future:"plan",inbox:"inbox"};
function goTo({f, tab, step}){
  if(tab && !tabExists(tab)) tab=null;
  if(tab){ const p=PAGES.find(x=>x[0]===tab), pf=p?p[1]:"*";
    if(f==null && pf!=="*" && farm!==pf) f=pf;   /* a crop page opens under Terra, a herd page under Vita, and so on */
    setFarm(f); go(tab); return; }
  setFarm(f);
  if(step){ render(); if(!clickStep(step)) go(tabExists(CLASSIC_STEP[step])?CLASSIC_STEP[step]:"home"); return; }
  go(tabExists("home")?"home":"overview");
}
const coName = f => { const c=COS.find(x=>x.f===f)||COS[3]; return L(c.en,c.ar); };
const stepName = k => { const s=STEPS.find(x=>x.k===k); return s?L(s.en,s.ar):k; };

/* ---- numbers said out loud ---- */
const money = n => { n=Math.round(+n||0); const a=Math.abs(n), sg=n<0?L("minus ","سالب "):"";
  if(a>=1e6) return sg+(a/1e6).toFixed(a>=1e7?0:1).replace(/\.0$/,"")+L(" million pounds"," مليون جنيه");
  if(a>=1e3) return sg+Math.round(a/1e3)+L(" thousand pounds"," ألف جنيه");
  return sg+a+L(" pounds"," جنيه"); };
const num = n => safe(()=>fmt(n), String(n));
const MON_EN = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const MON_AR = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];
const monName = m => L(MON_EN,MON_AR)[+m.slice(5)-1];

/* ---- to-dos: every one gets a colour (red = urgent, amber = soon, green = routine) ---- */
const PRI_WORDS = {
  high:["urgent","urgently","red","asap","emergency","immediately","right now","now","today","tonight","sick","dying","dead","broken","burst","fire","vet","critical","عاجل","ضروري","حالا","فورا","دلوقتي","النهارده","الليله","مريض","مريضه","ميت","نافق","عطلان","عطل","طوارئ","بيطري","احمر","مستعجل"],
  med:["soon","amber","yellow","orange","tomorrow","this week","next week","before friday","in a few days","قريب","قريبا","بكره","بكرا","الاسبوع ده","الاسبوع الجاي","الاسبوع","اصفر","برتقالي","خلال ايام"],
  low:["routine","green","later","someday","whenever","no rush","روتين","روتيني","اخضر","بعدين","مش مستعجل","وقت ما","لما تفضى"]
};
function autoPri(t){
  const n=norm(t);
  if(/\b(red|urgent)\b|احمر|عاجل/.test(n)) return "high";
  if(/\b(amber|yellow)\b|اصفر/.test(n)) return "med";
  if(/\b(green|routine)\b|اخضر|روتين/.test(n)) return "low";
  for(const p of ["high","med","low"]) if(has(n,PRI_WORDS[p])) return p;
  return "low";
}
const PRI_SAY = {high:["red, urgent","أحمر، عاجل"],med:["amber, soon","برتقالي، قريبًا"],low:["green, routine","أخضر، روتيني"]};
const PRI_COL = {high:"var(--bad)",med:"var(--warn)",low:"var(--good)"};
function farmOfText(t){
  const n=norm(t);
  if(has(n,COS[1].w)||/cattle|calf|calves|cow|herd|feed|silage|vaccin|weigh|\bvet\b|veterinar|بيطري|عجل|عجول|بقر|مواشي|علف|سيلاج|تحصين|وزن/.test(n)) return "TV";
  if(has(n,COS[2].w)||/family|mami|baligh|bank|charity|عيله|ماما|بليغ|بنك|صدق/.test(n)) return "FF";
  return null;
}
function todoTitle(raw){
  let t=String(raw).trim()
    .replace(/^(please\s+)?(add|create|make|put|new|set)\s+(an?\s+|the\s+)?(new\s+)?((red|amber|yellow|green|urgent|routine)\s+)?(to[\s-]?do|task|reminder|note)(\s+(item|list))?\s*(to\s+(do|the\s+list)\s*)?[:,-]?\s*(to\s+)?/i,"")
    .replace(/^(please\s+)?remind\s+me\s+(to\s+)?/i,"")
    .replace(/^(please\s+)?(note|remember)\s+(that\s+|to\s+)?/i,"")
    .replace(/^(من فضلك\s+)?(اضف|أضف|ضيف|زود|سجل|اكتب)\s+(مهمه|مهمة|تاسك|ملاحظه|ملاحظة|تذكير)(\s+(جديده|جديدة))?(\s+(عاجله|عاجلة|مستعجله|مستعجلة|روتينيه|روتينية|حمرا|خضرا|صفرا))?\s*[:،,-]?\s*/,"")
    .replace(/^(فكرني|ذكرني|افتكر|افكرك)\s+(ب|ان|إن|اني)?\s*/,"");
  t=t.replace(/\s*[,،]?\s*\b(it'?s\s+)?(urgent|routine|red|amber|green)\b\.?$/i,"").replace(/\s*[,،]?\s*(عاجل|روتيني|أحمر|احمر|أخضر|اخضر)$/,"");
  return t.replace(/^[\s:،,-]+|[\s.]+$/g,"");
}
async function addTodo(title, pri, f){
  title=String(title||"").trim().slice(0,200);
  if(!title) return {say:L("What should the to-do say?","المهمة تقول إيه؟")};
  pri = PRI_COL[pri] ? pri : autoPri(title);
  f = f || farmOfText(title) || (farm==="all"||farm==="MM" ? "TF" : farm);
  if(typeof famDb==="undefined"||!famDb) return {say:L("I can't save to-dos on this screen right now.","مش قادر أحفظ مهام على الشاشة دي دلوقتي.")};
  const row={title,farm:f,kind:"Plan",grp:"Other",pri,done:false,at:new Date().toISOString(),src:"Shatta"};
  try{ await famDb.collection("todos").add(row); }
  catch(err){ return {say:L("I couldn't save it. Only the owner of the app can add to-dos.","ماقدرتش أحفظها. صاحب التطبيق بس اللي يقدر يضيف مهام."), bad:true}; }
  return {say:L(`Added to ${coName(f)}: ${title}. Tagged ${PRI_SAY[pri][0]}.`,`اتضافت في ${coName(f)}: ${title}. اللون ${PRI_SAY[pri][1]}.`),
    list:[{t:title,c:PRI_COL[pri],s:L(PRI_SAY[pri][0],PRI_SAY[pri][1])}], open:{f,tab:"todo"}};
}

/* ---- answers from the app's numbers ---- */
function salesNow(){
  const m=today().slice(0,7); let kg=0,egp=0,tr=0,mm=m;
  const sum = mo => { kg=0;egp=0;tr=0; Object.values(SALES).forEach(rows=>rows.forEach(r=>{ if(r[0]===mo){ tr+=r[1]; kg+=r[3]; egp+=r[4]; } })); };
  sum(m); if(!egp){ const all=Object.values(SALES).flat().map(r=>r[0]).sort(); mm=all[all.length-1]; sum(mm); }
  return {m:mm,kg,egp,tr};
}
function sayWeather(n){
  if(typeof wx==="undefined"||!wx||!wx.daily) return {say:L("The farm forecast isn't in yet today.","توقعات الطقس للمزرعة لسه ما وصلتش النهارده.")};
  const d=wx.daily, t=today(); let i=d.time.indexOf(t); if(i<0) i=0;
  const tm=/tomorrow|بكره|بكرا|غدا/.test(n); if(tm&&i+1<d.time.length) i++;
  const kind=safe(()=>wxKind(d.weather_code[i]),"cloud"), W={sun:["clear","صافي"],part:["partly cloudy","غائم جزئيًا"],cloud:["cloudy","غائم"],fog:["foggy","شبورة"],rain:["rain","مطر"],storm:["thunder","رعد"],snow:["snow","تلج"]}[kind]||["",""];
  const lo=Math.round(d.temperature_2m_min[i]), hi=Math.round(d.temperature_2m_max[i]), pr=d.precipitation_probability_max?Math.round(d.precipitation_probability_max[i]||0):null, wd=Math.round(d.wind_speed_10m_max[i]||0);
  const day=tm?L("Tomorrow","بكرة"):L("Today","النهارده");
  const rest=[]; for(let j=i+1;j<Math.min(d.time.length,i+4);j++) rest.push({t:new Date(d.time[j]+"T12:00:00").toLocaleDateString(isAr()?"ar-EG":"en-GB",{weekday:"long"}),s:`${Math.round(d.temperature_2m_min[j])}–${Math.round(d.temperature_2m_max[j])}°${d.precipitation_probability_max?" · "+Math.round(d.precipitation_probability_max[j]||0)+"%":""}`});
  return {say:L(`${day} at the farm: ${W[0]}, ${lo} to ${hi} degrees${pr!=null?`, ${pr} percent chance of rain`:""}, wind up to ${wd} kilometres an hour.`,
               `${day} في المزرعة: ${W[1]}، من ${lo} لـ ${hi} درجة${pr!=null?`، احتمال المطر ${pr}٪`:""}، والرياح لحد ${wd} كيلو في الساعة.`), list:rest, open:{f:"all",tab:"today"}};
}
function sayUrgent(){
  const H=safe(()=>window.fetraViews.headsUps().filter(x=>!x.ack&&!/^jobs\|/.test(x.id)),[]);
  const lv={bad:0,warn:1,info:2}; H.sort((a,b)=>(lv[a.lvl]??3)-(lv[b.lvl]??3));
  const red=safe(()=>todos.filter(t=>!t.done&&t.kind!=="Question"&&priOf(t)==="high"),[]);
  const tr = x => safe(()=>isAr()&&window.fetraTr&&fetraTr(x),null)||x;
  if(!H.length&&!red.length) return {say:L("Nothing urgent right now. All clear.","مفيش حاجة عاجلة دلوقتي. كله تمام."), open:{tab:"inbox"}};
  const top=H.slice(0,3), bad=H.filter(x=>x.lvl==="bad").length;
  return {say:L(`${bad?bad+" urgent":"Nothing red"}, ${H.length} in all${red.length?`, and ${red.length} red to-do${red.length>1?"s":""}`:""}. First: ${top[0]?top[0].t:red[0].title}.`,
               `${bad?bad+" حاجة عاجلة":"مفيش حاجة حمرا"}، ${H.length} في المجموع${red.length?`، و${red.length} مهمة حمرا`:""}. أولها: ${top[0]?tr(top[0].t):red[0].title}.`),
    list:[...top.map(x=>({t:tr(x.t),s:tr(x.d||""),c:x.lvl==="bad"?"var(--bad)":x.lvl==="warn"?"var(--warn)":"var(--muted)",go:x.go})),...red.slice(0,2).map(t=>({t:t.title,c:"var(--bad)",s:L("Red to-do","مهمة حمرا"),go:"todo"}))], open:{tab:"inbox"}};
}
function sayTodos(){
  const td=safe(()=>todos.filter(x=>!x.done&&x.kind!=="Question"&&(farm==="all"||farm==="MM"||x.farm===farm)).sort((a,b)=>priN(a)-priN(b)),[]);
  if(!td.length) return {say:L("No open to-dos here.","مفيش مهام مفتوحة هنا."), open:{tab:"todo"}};
  const r=td.filter(x=>priOf(x)==="high").length, a=td.filter(x=>priOf(x)==="med").length;
  return {say:L(`${td.length} open: ${r} red, ${a} amber. Top one: ${td[0].title}.`,`${td.length} مهمة مفتوحة: ${r} حمرا و${a} برتقالي. أهمها: ${td[0].title}.`),
    list:td.slice(0,5).map(x=>({t:x.title,c:PRI_COL[priOf(x)]||PRI_COL.med,s:L(PRI_SAY[priOf(x)][0],PRI_SAY[priOf(x)][1])})), open:{tab:"todo"}};
}
function saySales(){
  const s=salesNow();
  return {say:L(`Banana sales in ${monName(s.m)}: ${money(s.egp)} net, from ${num(s.kg)} kilos on ${s.tr} trucks.`,
               `مبيعات الموز في ${monName(s.m)}: ${money(s.egp)} صافي، من ${num(s.kg)} كيلو على ${s.tr} عربية.`),
    list:[{t:L("Average price","متوسط السعر"),s:s.kg?(s.egp/s.kg).toFixed(1)+L(" EGP a kg"," جنيه للكيلو"):"—"}], open:{f:"TF",tab:"c-banana"}};
}
function sayHerd(){
  const kn=safe(()=>fpKnown(),null), hd=safe(()=>HERD.head,null);
  if(hd==null) return {say:L("I can't find the herd numbers.","مش لاقي أرقام القطيع.")};
  return {say:L(`The herd is ${hd} head${kn?`, about ${num(kn.kg)} kilos as of ${safe(()=>dmy(kn.d),kn.d)}`:""}.`,`القطيع ${hd} راس${kn?`، حوالي ${num(kn.kg)} كيلو بتاريخ ${safe(()=>dmy(kn.d),kn.d)}`:""}.`), open:{f:"TV",tab:"c-cattle"}};
}
function sayCash(){
  const p=safe(()=>moneyPlan(),null); if(!p) return {say:L("I can't read the money plan right now.","مش قادر أقرا خطة الفلوس دلوقتي.")};
  return {say:L(`Lowest cash ahead is ${money(p.low.bal)}, in ${safe(()=>mLabel(p.low.m),p.low.m)}.`,`أقل رصيد جاي ${money(p.low.bal)}، في ${safe(()=>mLabel(p.low.m),p.low.m)}.`), bad:p.low.bal<0, open:{f:"FF",tab:"cash"}};
}
function sayBaligh(){
  const o=safe(()=>owedNow(),null); if(o==null) return {say:L("I can't read Baligh's account.","مش قادر أقرا حساب بليغ.")};
  return {say:L(`Owed to Baligh: ${money(o)}.`,`المستحق لبليغ: ${money(o)}.`), open:{f:"FF",tab:"bank"}};
}
const HELP = () => ({say:L("Say Shatta, then for example: open Vita money. Show bananas. What's urgent? Weather tomorrow. Add an urgent to-do, call the vet.",
  "قول شطة، وبعدين مثلًا: افتح فلوس فيتا. وريني الموز. إيه العاجل؟ الطقس بكرة. ضيف مهمة عاجلة: كلم الدكتور البيطري."),
  list:L([["Open Vita money"],["Show the bananas"],["What's urgent?"],["Weather tomorrow"],["Add urgent to-do: call the vet"],["Read my to-dos"]],[["افتح فلوس فيتا"],["وريني الموز"],["إيه العاجل؟"],["الطقس بكرة"],["ضيف مهمة عاجلة: كلم البيطري"],["اقرا مهامي"]]).map(x=>({t:x[0],ex:true}))});

/* ---- understanding a command ---- */
const WAKE = /^(?:(?:hey|hi|ok|okay|يا|اهلا)\s+)?(?:shatta|shata|shatter|shutta|shotta|chatta|shaata|shut up|shatah|chata|شطه|شطا|شتا|شته|شاطا|شطة)(?:\s+|$)/;
const ASK = /^(?:what|whats|how|which|when|where|is|are|do|does|did|tell|read|list|give|any)\b|^(?:ايه|اية|كام|قد ايه|اقرا|قولي|فيه|هل|امتي|فين|ازاي|عايز اعرف)(?:\s|$)|(?:\s)(?:ايه|كام)$/;
const GOWORDS = /\b(open|go|goto|take|show|switch|bring|navigate|display|jump)\b|افتح|روح|وديني|خدني|وريني|اعرض|ورني|حول|انقل|اظهر/;
function parse(raw){
  const n0=norm(raw), n=n0.replace(WAKE,"").trim(), body=String(raw).trim().replace(/^[^\p{L}]*(?:(?:hey|hi|ok|okay|يا)\s+)?(?:shatta|shata|shatter|shutta|shotta|chatta|شطة|شطه|شطا|شتا|شته)[\s,،.!:]*/iu,"");
  if(!n) return {wake:true};
  if(/^(help|what can you do|commands)\b|مساعده|تقدر تعمل ايه|بتعمل ايه/.test(n)) return {run:HELP};
  if(/^(stop|cancel|never mind|nevermind|close|bye|thanks|thank you)\b|^(خلاص|بس|الغي|اقفل|شكرا|مع السلامه)/.test(n)) return {close:true};
  if(/\b(speak|switch to|in) arabic\b|^عربي$|بالعربي|اتكلم عربي/.test(n)) return {lang:"ar"};
  if(/\b(speak|switch to|in) english\b|^english$|انجليزي|بالانجليزي|اتكلم انجليزي/.test(n)) return {lang:"en"};
  /* add a to-do */
  if(/^(please )?(add|create|make|put|new|set)( an?| the)?( new)?( (red|amber|yellow|green|urgent|routine))? (to ?do|todo|task|reminder|note)\b/.test(n)
    || /^(please )?remind me\b/.test(n) || /^(please )?(note|remember) (that|to)\b/.test(n)
    || /^(من فضلك )?(اضف|ضيف|زود|سجل|اكتب) (مهمه|تاسك|ملاحظه|تذكير)/.test(n) || /^(فكرني|ذكرني|افتكر)/.test(n))
    return {todo:todoTitle(body), pri:autoPri(body)};
  const ask=ASK.test(n)||/\?\s*$/.test(String(raw)), goW=GOWORDS.test(n);
  /* questions answered from the app's numbers */
  if(/weather|rain|temperature|forecast|\bhot\b|\bwind\b|طقس|الجو|مطر|حراره|رياح|هوا/.test(n) && !/forecast page|sale forecast|feed forecast/.test(n)) return {run:()=>sayWeather(n)};
  if(/urgent|fix first|what should i (do|fix)|problems?|alerts?|attention|عاجل|اصلح|مشاكل|مشكله|تنبيهات|المهم ايه|اعمل ايه/.test(n) && (ask||!goW)) return {run:sayUrgent};
  if(/(to ?dos?|todo|tasks)/.test(n) && (ask||/^(read|list)/.test(n)) || /^(اقرا )?مهامي|ايه المهام|المهام ايه|كام مهمه/.test(n)) return {run:sayTodos};
  if(/sales|sold|revenue|income|مبيعات|بعنا|البيع|ايراد/.test(n) && (ask||!goW)) return {run:saySales};
  if(/(how many|count|size).*(cattle|cows|head|herd|animals)|herd size|كام راس|عدد (المواشي|العجول|القطيع|الراس)|القطيع كام/.test(n)) return {run:sayHerd};
  if(/\bcash\b|lowest|سيوله|الكاش|الرصيد/.test(n) && ask) return {run:sayCash};
  if(/baligh|بليغ/.test(n) && (ask||/owe|مستحق|عليه|ليه/.test(n))) return {run:sayBaligh};
  /* places */
  let co=null, st=null, pg=null, pw="";
  for(const c of COS) if(!co && has(n,c.w)) co=c;
  for(const s of STEPS) if(!st && has(n,s.w)) st=s;
  for(const p of PAGES) for(const w of p[2]){ const x=norm(w); if(x.length>pw.length && has(n,[x])){ pw=x; pg=p; } }
  /* a word that also names a company or a step ("family", "home", "inbox") means the company or the step */
  if(pg && ((co&&co.w.map(norm).includes(pw)) || (st&&st.w.map(norm).includes(pw)))) pg=null;
  if(pg) return {go:{f:co?co.f:undefined, tab:pg[0]}};
  if(co||st) return {go:{f:co?co.f:undefined, step:st?st.k:"today"}};
  return {ai:body};
}
function placeLine(g){
  const where = g.tab ? tabLabel(g.tab) : stepName(g.step||"today");
  const f = g.f!=null ? g.f : farm;
  return L(`${coName(f)} · ${where}.`,`${coName(f)} · ${where}.`);
}

/* ---- Claude for anything else (the page's sample capability) ---- */
let samp = undefined;
async function sampler(){ if(samp!==undefined) return samp; samp=null; try{ if(window.claude&&typeof claude.use==="function") samp=await claude.use("sample"); }catch(_){ samp=null; } return samp; }
function snapshot(){
  const s=safe(salesNow,{}), H=safe(()=>window.fetraViews.headsUps().filter(x=>!x.ack&&!/^jobs\|/.test(x.id)).slice(0,6).map(x=>x.lvl+": "+x.t+" — "+(x.d||"")),[]);
  const td=safe(()=>todos.filter(x=>!x.done&&x.kind!=="Question").slice(0,12).map(x=>`[${priOf(x)}] ${x.title} (${x.farm})`),[]);
  return [`Today ${today()}. Farm: Fetra, Badaway, Sherbin, Dakahlia, Egypt. Bananas, potatoes, clover, wheat, corn, soy, persimmon, herbs, stevia; Arabawi cattle.`,
    `Companies: all = Fetra Group, TF = Fetra Terra (crops), TV = Fetra Vita (livestock), FF = Fetra Familia (money & family). Now showing ${farm}, page ${current}.`,
    `Steps: today, money, prod (production), future, inbox.`,
    `Pages (id: name): ${safe(()=>TABS.map(t=>t[0]+": "+t[1]).join("; "),"")}`,
    `Banana sales ${s.m}: EGP ${Math.round(s.egp||0)} net, ${Math.round(s.kg||0)} kg, ${s.tr} trucks.`,
    `Herd: ${safe(()=>HERD.head,"?")} head.`, `Owed to Baligh: ${safe(()=>Math.round(owedNow()),"?")} EGP.`,
    `Open alerts: ${H.join(" | ")||"none"}.`, `Open to-dos: ${td.join(" | ")||"none"}.`].join("\n");
}
async function askClaude(text){
  const s=await sampler(); if(!s) return null;
  const prompt=`You are Shatta, the voice assistant inside T's Fetra farm app. T said: "${text}"
Reply in ${isAr()?"Egyptian Arabic":"English"}, as something spoken aloud: one or two short sentences, no lists, no markdown.
If T wants a page, pick it. If T wants a to-do added, give it with pri "high" (urgent, red), "med" (soon, amber) or "low" (routine, green).
App state:
${snapshot()}
Reply with only JSON like {"say":"...","farm":"TV"|null,"tab":"page id"|null,"step":"money"|null,"todo":{"title":"...","pri":"high","farm":"TF"}|null}`;
  try{ return await s.json(prompt,{modelTier:"quick",cache:false}); }catch(e){ return e&&e.code==="not_granted" ? (samp=null,null) : {say:L("Sorry, I couldn't reach Claude just now.","آسف، مش قادر أوصل لكلود دلوقتي.")}; }
}

/* ---- talking ---- */
let voices=[]; const loadVoices=()=>{ voices=safe(()=>speechSynthesis.getVoices(),[])||[]; }; loadVoices();
safe(()=>speechSynthesis.addEventListener("voiceschanged",loadVoices));
let muted = lsGet("shattaMute",false);
function speak(text, then){
  if(muted||!("speechSynthesis" in window)||!text){ if(then) then(); return; }
  try{ speechSynthesis.cancel(); const u=new SpeechSynthesisUtterance(text), ar_=/[؀-ۿ]/.test(text);
    u.lang = ar_ ? "ar-EG" : "en-GB";
    const v = voices.find(v=>v.lang===u.lang) || voices.find(v=>v.lang&&v.lang.toLowerCase().startsWith(ar_?"ar":"en"));
    if(v) u.voice=v; u.rate = ar_ ? 1 : 1.03;
    let done=false; const fin=()=>{ if(done) return; done=true; if(then) then(); };
    u.onend=fin; u.onerror=fin; setTimeout(fin, 1500+text.length*90);
    speechSynthesis.speak(u);
  }catch(_){ if(then) then(); }
}

/* ---- listening ---- */
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
let rec=null, listening=false, micBlocked=!SR, awaitingCmd=false;
function listen(){
  if(!SR||micBlocked){ state(micBlocked&&SR?"blocked":"nomic"); focusInput(); return; }
  stopListen(); safe(()=>speechSynthesis.cancel());
  rec=new SR(); rec.lang = isAr() ? "ar-EG" : "en-US"; rec.interimResults=true; rec.continuous=false; rec.maxAlternatives=1;
  let finalT="";
  rec.onresult = e => { let it=""; for(let i=e.resultIndex;i<e.results.length;i++){ const r=e.results[i]; if(r.isFinal) finalT+=r[0].transcript; else it+=r[0].transcript; } heard(finalT||it, !finalT); };
  rec.onerror = e => { listening=false; paintBtn();
    if(e.error==="not-allowed"||e.error==="service-not-allowed"||e.error==="audio-capture"){ micBlocked=true; state("blocked"); focusInput(); }
    else if(e.error==="no-speech"){ state(awaitingCmd?"nothing":"idle"); }
    else state("idle"); };
  rec.onend = () => { const was=listening; listening=false; paintBtn(); if(was&&finalT.trim()) handle(finalT.trim(),"voice"); else if(was&&!finalT.trim()&&panelState==="listen") state(awaitingCmd?"nothing":"idle"); };
  try{ rec.start(); listening=true; state("listen"); paintBtn(); }catch(_){ micBlocked=true; state("blocked"); focusInput(); }
}
function stopListen(){ if(rec){ try{ rec.onend=null; rec.abort(); }catch(_){} rec=null; } listening=false; paintBtn(); }

/* ---- the button and the panel ---- */
const css=document.createElement("style"); css.id="shatta-css"; css.textContent=`
#shBtn{position:fixed;z-index:17;width:54px;height:54px;border-radius:50%;border:0;background:var(--nile);color:#fff;box-shadow:0 6px 18px rgba(0,0,0,.25);cursor:pointer;display:grid;place-items:center;touch-action:none;-webkit-user-select:none;user-select:none;padding:0}
#shBtn svg{width:26px;height:26px}
#shBtn .lbl{position:absolute;bottom:-17px;left:50%;transform:translateX(-50%);font-size:.66rem;font-weight:700;color:var(--fg);background:var(--surface);border:1px solid var(--line);border-radius:999px;padding:0 6px;line-height:15px;white-space:nowrap;pointer-events:none}
#shBtn.on::before{content:"";position:absolute;inset:-7px;border-radius:50%;border:3px solid var(--nile);animation:shPulse 1.2s ease-out infinite}
#shBtn.dragging{cursor:grabbing;opacity:.85}
@keyframes shPulse{from{opacity:.9;transform:scale(.9)}to{opacity:0;transform:scale(1.35)}}
#shPanel{position:fixed;z-index:18;inset-inline:max(12px,env(safe-area-inset-left,0px));bottom:calc(12px + env(safe-area-inset-bottom,0px));max-width:420px;margin-inline-start:auto;background:var(--surface);color:var(--fg);border:1px solid var(--line);border-radius:18px;box-shadow:0 12px 36px rgba(0,0,0,.28);padding:14px 14px 12px;display:grid;gap:10px;max-height:min(70vh,560px);overflow:auto;animation:shIn .18s ease-out}
body.calm #shPanel{bottom:calc(78px + env(safe-area-inset-bottom,0px))}
@media (min-width:900px){ body.calm #shPanel,#shPanel{bottom:24px;inset-inline-end:24px;inset-inline-start:auto;width:400px} }
@keyframes shIn{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}
#shPanel .sh-hd{display:flex;align-items:center;gap:10px}
#shPanel .sh-av{width:34px;height:34px;border-radius:50%;background:var(--nile);color:#fff;display:grid;place-items:center;flex:none}
#shPanel .sh-av svg{width:18px;height:18px}
#shPanel .sh-hd b{font-family:var(--display);font-size:1.1rem}
#shPanel .sh-hd small{display:block;color:var(--muted);font-size:.78rem;line-height:1.2}
#shPanel .sh-hd .sp{flex:1}
#shPanel .ic{width:34px;height:34px;border-radius:50%;border:1px solid var(--line);background:none;color:var(--muted);cursor:pointer;display:grid;place-items:center;font:inherit;font-size:.8rem;flex:none}
#shPanel .ic svg{width:17px;height:17px}
#shPanel .sh-you{font-size:.95rem;color:var(--muted);min-height:1.2em}
#shPanel .sh-you q{color:var(--fg);font-style:italic}
#shPanel .sh-say{font-size:1.02rem;line-height:1.45;background:var(--nile-soft);border-radius:12px;padding:10px 12px}
#shPanel .sh-say.bad{background:var(--bad-soft)}
#shPanel ul{list-style:none;margin:0;padding:0;display:grid;gap:4px}
#shPanel li{display:flex;gap:9px;align-items:flex-start;padding:6px 8px;border-radius:10px;border:1px solid var(--line)}
#shPanel li.go,#shPanel li.ex{cursor:pointer} #shPanel li.go:hover,#shPanel li.ex:hover{background:var(--surface-2)}
#shPanel li i{width:5px;align-self:stretch;border-radius:3px;flex:none;background:var(--line)}
#shPanel li span{min-width:0} #shPanel li small{display:block;color:var(--muted);font-size:.78rem}
#shPanel .sh-acts{display:flex;gap:8px;flex-wrap:wrap}
#shPanel form{display:flex;gap:8px}
#shPanel form input{flex:1;min-width:0;border-radius:999px;padding:9px 14px}
#shPanel .mic{width:42px;height:42px;border-radius:50%;border:0;background:var(--nile);color:#fff;cursor:pointer;display:grid;place-items:center;flex:none;position:relative}
#shPanel .mic.on::before{content:"";position:absolute;inset:-5px;border-radius:50%;border:3px solid var(--nile);animation:shPulse 1.2s ease-out infinite}
#shPanel .mic svg{width:20px;height:20px}
#shPanel .wave{display:inline-flex;gap:3px;align-items:center;height:14px;margin-inline-end:6px;vertical-align:middle}
#shPanel .wave i{width:3px;height:100%;background:var(--nile);border-radius:2px;animation:shW 1s ease-in-out infinite}
#shPanel .wave i:nth-child(2){animation-delay:.15s}#shPanel .wave i:nth-child(3){animation-delay:.3s}#shPanel .wave i:nth-child(4){animation-delay:.45s}
@keyframes shW{0%,100%{transform:scaleY(.3)}50%{transform:scaleY(1)}}
@media (prefers-reduced-motion:reduce){#shBtn.on::before,#shPanel .mic.on::before,#shPanel .wave i,#shPanel{animation:none}}
@media print{#shBtn,#shPanel{display:none!important}}`;
document.head.appendChild(css);
const MIC='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/></svg>';
const SPK='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/></svg>';
const MUTE='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M16 9.5l5 5M21 9.5l-5 5"/></svg>';
const SEND='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12l16-8-6 16-2.5-6.5z"/></svg>';

const btn=document.createElement("button"); btn.id="shBtn"; btn.type="button"; btn.setAttribute("data-noi18n","");
btn.innerHTML=MIC+'<span class="lbl">Shatta</span>'; document.body.appendChild(btn);
const panel=document.createElement("div"); panel.id="shPanel"; panel.hidden=true; panel.setAttribute("data-noi18n",""); panel.setAttribute("role","dialog"); document.body.appendChild(panel);

/* position: remembered per device, as a share of the screen so it survives turning the phone */
function defaultPos(){ const w=innerWidth, hh=innerHeight, calmOn=document.body.classList.contains("calm");
  const bottom = w<900 ? (calmOn?80:16)+46+30 : 24+46+30;   /* above the bell bubble */
  return {x:(w-54-16)/w, y:(hh-54-bottom)/hh}; }
let pos=lsGet("shattaPos",null);
function place(){ const p=pos||defaultPos(), w=innerWidth, hh=innerHeight;
  const x=Math.min(Math.max(8,p.x*w),w-62), y=Math.min(Math.max(8,p.y*hh),hh-80);
  btn.style.left=x+"px"; btn.style.top=y+"px"; }
place(); addEventListener("resize",place);
let drag=null;
btn.addEventListener("pointerdown",e=>{ drag={sx:e.clientX,sy:e.clientY,bx:btn.offsetLeft,by:btn.offsetTop,moved:false}; try{ btn.setPointerCapture(e.pointerId); }catch(_){} });
btn.addEventListener("pointermove",e=>{ if(!drag) return; const dx=e.clientX-drag.sx, dy=e.clientY-drag.sy;
  if(!drag.moved && Math.hypot(dx,dy)<8) return; drag.moved=true; btn.classList.add("dragging");
  btn.style.left=Math.min(Math.max(8,drag.bx+dx),innerWidth-62)+"px"; btn.style.top=Math.min(Math.max(8,drag.by+dy),innerHeight-80)+"px"; });
btn.addEventListener("pointerup",()=>{ if(!drag) return; const m=drag.moved; drag=null; btn.classList.remove("dragging");
  if(m){ pos={x:btn.offsetLeft/innerWidth,y:btn.offsetTop/innerHeight}; lsSet("shattaPos",pos); return; }
  press(); });
btn.addEventListener("pointercancel",()=>{ drag=null; btn.classList.remove("dragging"); });
btn.addEventListener("keydown",e=>{ if(e.key==="Enter"||e.key===" "){ e.preventDefault(); press(); } });
function paintBtn(){ btn.classList.toggle("on",listening); btn.setAttribute("aria-label",L("Shatta, voice assistant","شطة، المساعد الصوتي")); btn.querySelector(".lbl").textContent=L("Shatta","شطة");
  const m=panel.querySelector(".mic"); if(m){ m.classList.toggle("on",listening); m.setAttribute("aria-label",listening?L("Stop listening","وقف الاستماع"):L("Talk to Shatta","كلم شطة")); } }

let panelState="idle", you="", reply=null;
function press(){
  if(panel.hidden){ open(); listen(); return; }
  if(listening){ stopListen(); state("idle"); } else listen();
}
function open(){ panel.hidden=false; awaitingCmd=false; you=""; reply=null; paint(); }
function close(){ stopListen(); safe(()=>speechSynthesis.cancel()); panel.hidden=true; }
function focusInput(){ setTimeout(()=>{ const i=panel.querySelector("input"); if(i&&innerWidth>=900) i.focus(); },50); }
function state(s){ panelState=s; paint(); }
function heard(t, interim){ you=t; const y=panel.querySelector(".sh-you"); if(y) y.innerHTML=t?`<q>${h(t)}</q>${interim?"…":""}`:""; }
const STATUS = () => ({
  idle: L(`Tap the mic and say “Shatta”, then what you need.`,`دوس على المايك وقول «شطة»، وبعدين اللي عايزه.`),
  listen: `<span class="wave" aria-hidden="true"><i></i><i></i><i></i><i></i></span>`+(awaitingCmd?L("Yes? I'm listening…","أيوه؟ سامعك…"):L("Listening… say “Shatta”, then your command","سامعك… قول «شطة» وبعدين طلبك")),
  think: L("One moment…","لحظة…"),
  nothing: L("I didn't hear anything. Tap the mic and try again.","ما سمعتش حاجة. دوس على المايك وجرب تاني."),
  blocked: L("The microphone isn't allowed on this screen. Type your command below; Shatta still answers out loud.","المايك مش مسموح على الشاشة دي. اكتب طلبك تحت، وشطة هيرد بصوت عالي."),
  nomic: L("This browser can't listen. Type your command below; Shatta still answers out loud.","المتصفح ده مش بيسمع. اكتب طلبك تحت، وشطة هيرد بصوت عالي."),
  done: ""
}[panelState]||"");
function paint(){
  if(panel.hidden) return;
  const r=reply, st=STATUS();
  panel.setAttribute("aria-label",L("Shatta voice assistant","شطة المساعد الصوتي")); panel.dir=isAr()?"rtl":"ltr"; panel.lang=isAr()?"ar":"en";
  panel.innerHTML=`<div class="sh-hd"><span class="sh-av">${MIC}</span><span><b>${L("Shatta","شطة")}</b><small>${L("Voice assistant · English","مساعد صوتي · عربي")}</small></span><span class="sp"></span>
      <button type="button" class="ic" data-sh="lang" title="${L("Speak Arabic","اتكلم إنجليزي")}" lang="${isAr()?"en":"ar"}">${isAr()?"EN":"ع"}</button>
      <button type="button" class="ic" data-sh="mute" aria-pressed="${muted}" title="${muted?L("Turn voice on","شغل الصوت"):L("Turn voice off","اقفل الصوت")}">${muted?MUTE:SPK}</button>
      <button type="button" class="ic" data-sh="x" aria-label="${L("Close","اقفل")}">✕</button></div>
    ${st?`<div class="sh-st muted" role="status" style="font-size:.9rem">${st}</div>`:""}
    <div class="sh-you">${you?`<q>${h(you)}</q>`:""}</div>
    ${r?`<div class="sh-say${r.bad?" bad":""}" aria-live="polite">${h(r.say)}</div>`:""}
    ${r&&r.list&&r.list.length?`<ul>${r.list.map((x,i)=>`<li class="${x.ex?"ex":x.go?"go":""}" data-li="${i}"><i style="background:${x.c||"var(--nile)"}"></i><span>${h(x.t)}${x.s?`<small>${h(x.s)}</small>`:""}</span></li>`).join("")}</ul>`:""}
    ${r&&r.open?`<div class="sh-acts"><button type="button" class="btn ghost sm" data-sh="open">${L("Open","افتح")} ${h(r.open.tab?tabLabel(r.open.tab):stepName(r.open.step||"today"))}</button></div>`:""}
    ${!r&&panelState!=="listen"?`<ul>${HELP().list.slice(0,4).map((x,i)=>`<li class="ex" data-ex="${h(x.t)}"><i></i><span>${h(x.t)}</span></li>`).join("")}</ul>`:""}
    <form autocomplete="off"><input type="text" enterkeyhint="send" placeholder="${L("Or type: open Vita money","أو اكتب: افتح فلوس فيتا")}" aria-label="${L("Command for Shatta","طلب لشطة")}">
      ${SR?`<button type="button" class="mic" data-sh="mic">${MIC}</button>`:`<button type="submit" class="mic" aria-label="${L("Send","ابعت")}">${SEND}</button>`}</form>`;
  panel.querySelector('[data-sh="x"]').onclick=close;
  panel.querySelector('[data-sh="mute"]').onclick=()=>{ muted=!muted; lsSet("shattaMute",muted); if(muted) safe(()=>speechSynthesis.cancel()); paint(); };
  panel.querySelector('[data-sh="lang"]').onclick=()=>{ stopListen(); const nl=isAr()?"en":"ar"; if(typeof window.setLang==="function") window.setLang(nl); else { lsSet("fetraLang",nl); render(); } reply=null; you=""; state("idle"); paintBtn(); };
  const m=panel.querySelector('[data-sh="mic"]'); if(m) m.onclick=()=>{ if(listening){ stopListen(); state("idle"); } else { awaitingCmd=false; listen(); } };
  const o=panel.querySelector('[data-sh="open"]'); if(o) o.onclick=()=>goTo(r.open);
  panel.querySelectorAll("[data-ex]").forEach(li=>li.onclick=()=>handle(li.dataset.ex,"tap"));
  panel.querySelectorAll("li[data-li]").forEach(li=>li.onclick=()=>{ const x=r.list[+li.dataset.li]; if(x.ex) handle(x.t,"tap"); else if(x.go) goTo({tab:x.go}); });
  const f=panel.querySelector("form"); f.onsubmit=e=>{ e.preventDefault(); const v=f.querySelector("input").value.trim(); if(v) handle(v,"typed"); };
  paintBtn();
}
document.addEventListener("keydown",e=>{ if(e.key==="Escape"&&!panel.hidden) close(); });
document.addEventListener("pointerdown",e=>{ if(!panel.hidden&&!panel.contains(e.target)&&!btn.contains(e.target)&&!listening&&panelState!=="think") close(); });

async function handle(text, how){
  stopListen(); you=text; const p=parse(text);
  if(p.wake){ awaitingCmd=true; reply=null; state("listen"); speak(L("Yes?","أيوه؟"),()=>{ if(!panel.hidden) listen(); }); return; }
  awaitingCmd=false;
  if(p.close){ reply={say:L("Okay.","تمام.")}; paint(); speak(reply.say); setTimeout(close,900); return; }
  if(p.lang){ if(typeof window.setLang==="function") window.setLang(p.lang); reply={say:L("Okay, English from now on.","تمام، هتكلم عربي من دلوقتي.")}; state("done"); speak(reply.say); return; }
  let r=null;
  if(p.todo!=null){ state("think"); r=await addTodo(p.todo,p.pri); }
  else if(p.run){ r=p.run(); if(r&&r.open) goTo(r.open); }
  else if(p.go){ goTo(p.go); r={say:placeLine(p.go)}; }
  else if(p.ai){
    state("think"); const a=await askClaude(p.ai);
    if(a&&typeof a==="object"){
      if(a.todo&&a.todo.title){ r=await addTodo(a.todo.title,a.todo.pri,a.todo.farm); }
      else { const g={f:["all","TF","TV","FF"].includes(a.farm)?a.farm:undefined, tab:a.tab&&tabExists(a.tab)?a.tab:null, step:STEPS.some(s=>s.k===a.step)?a.step:null};
        if(g.tab||g.step||g.f!==undefined) goTo(g); r={say:String(a.say||placeLine(g)).slice(0,400)}; }
    } else r={say:L("Sorry, I didn't get that. Try: open Vita money, or: what's urgent?","آسف، ما فهمتش. جرب: افتح فلوس فيتا، أو: إيه العاجل؟"), list:HELP().list.slice(0,4)};
  }
  reply=r||{say:L("Done.","تم.")}; state("done");
  const inp=panel.querySelector("input"); if(inp&&how==="typed") inp.value="";
  speak(reply.say);
}
paintBtn();
/* re-label after the language switch re-renders the page */
const lb=document.getElementById("langBtn"); if(lb) lb.addEventListener("click",()=>setTimeout(()=>{ paintBtn(); if(!panel.hidden) paint(); },0));
window.fetraShatta = {open:()=>{ open(); }, run:t=>{ if(panel.hidden) open(); return handle(t,"typed"); }, parse, autoPri};
})();
