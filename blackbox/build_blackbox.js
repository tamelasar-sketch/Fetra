/* Claude's copy of the black box: builds Fetra-black-box.xlsx from the app's shared records and the figures built into the app.
   node build_blackbox.js <records dir> <app.html> <out.xlsx>
   <records dir>: the ArtifactData out_dir layout (<collection path>/<doc id>.json). */
const fs = require("fs"), path = require("path"), vm = require("vm");
const X = require("./xlsx-core.js"), D = require("./bb-data.js");
const [dir, app, out] = process.argv.slice(2);
const records = {};
(function walk(d){ for(const f of fs.readdirSync(d)){ const p = path.join(d,f);
  if(fs.statSync(p).isDirectory()) walk(p);
  else if(f.endsWith(".json")){ const rel = path.relative(dir, p).slice(0,-5).split(path.sep).join("/"); records[rel] = JSON.parse(fs.readFileSync(p,"utf8")); } } })(dir);
/* the figures built into the app: each `const NAME = …;` evaluated on its own */
const html = fs.readFileSync(app, "utf8");
const m = html.match(/<script>\n([\s\S]*?)<\/script>\n<script id="fetra-leaks">/); const src = m ? m[1] : "";
function exprEnd(s, i){
  let d = 0;
  for(; i<s.length; i++){
    const c = s[i];
    if(c==='"'||c==="'"||c==="`"){ const q = c; for(i++; i<s.length && s[i]!==q; i++){ if(s[i]==="\\") i++; } continue; }
    if(c==="/" && s[i+1]==="*"){ i = s.indexOf("*/", i+2)+1; continue; }
    if(c==="/" && s[i+1]==="/"){ i = s.indexOf("\n", i); continue; }
    if("([{".includes(c)) d++; else if(")]}".includes(c)) d--;
    else if(c===";" && d===0) return i;
    if(d<0) return i;
  }
  return i;
}
const ctx = vm.createContext({});
const tables = {};
for(const [name] of D.TABLES){
  const r = new RegExp(`(?:^|\\n)(?:const|let)\\s+${name}\\s*=`).exec(src); if(!r) continue;
  const st = r.index + r[0].length, en = exprEnd(src, st);
  try{ const v = vm.runInContext(`(${src.slice(st,en)})`, ctx, {timeout:2000}); ctx[name] = v; tables[name] = JSON.parse(JSON.stringify(v)); }catch(e){ /* depends on the page: left out */ }
}
const at = new Date().toISOString();
const bytes = X.build(D.sheets(records, tables, {at, from:"Claude's nightly copy (shared records + app figures)"}));
fs.writeFileSync(out, bytes);
console.log("records", Object.keys(records).length, "tables", Object.keys(tables).length, "bytes", bytes.length, "->", out);
