/* FETRA-XLSX: writes and reads plain .xlsx files with no internet and no add-ons.
   Used by the app (blackbox.js) and by Claude's nightly copy (build_blackbox.js, Node).
   - build(sheets) -> Uint8Array. sheets: [{name, rows:[[cell,...],...], header:true, hidden, widths, style(r,c,v)}]
     cell: string | number | boolean | null. Row 0 is the header when header is true.
   - read(bytes) -> Promise<[{name, hidden, rows:[[...]]}]>. Reads files saved by Excel (Windows, Mac, iPhone) and Numbers. */
(function(root){
const enc = s => new TextEncoder().encode(s);
const CRC = (() => { const t = new Uint32Array(256); for(let n=0;n<256;n++){ let c=n; for(let k=0;k<8;k++) c = c&1 ? 0xEDB88320^(c>>>1) : c>>>1; t[n]=c>>>0; } return t; })();
const crc32 = b => { let c = 0xFFFFFFFF; for(let i=0;i<b.length;i++) c = CRC[(c^b[i])&255]^(c>>>8); return (c^0xFFFFFFFF)>>>0; };
/* store-only zip (no compression): every reader opens it */
function zip(files){
  const parts = [], cen = []; let off = 0;
  const now = new Date(), dt = ((now.getHours()<<11)|(now.getMinutes()<<5)|(now.getSeconds()>>1)) & 0xFFFF,
        dd = (((now.getFullYear()-1980)<<9)|((now.getMonth()+1)<<5)|now.getDate()) & 0xFFFF;
  for(const [name, data] of files){
    const nb = enc(name), crc = crc32(data), h = new DataView(new ArrayBuffer(30));
    h.setUint32(0,0x04034b50,true); h.setUint16(4,20,true); h.setUint16(6,0x0800,true); h.setUint16(8,0,true);
    h.setUint16(10,dt,true); h.setUint16(12,dd,true); h.setUint32(14,crc,true); h.setUint32(18,data.length,true); h.setUint32(22,data.length,true);
    h.setUint16(26,nb.length,true); h.setUint16(28,0,true);
    parts.push(new Uint8Array(h.buffer), nb, data);
    const c = new DataView(new ArrayBuffer(46));
    c.setUint32(0,0x02014b50,true); c.setUint16(4,20,true); c.setUint16(6,20,true); c.setUint16(8,0x0800,true); c.setUint16(10,0,true);
    c.setUint16(12,dt,true); c.setUint16(14,dd,true); c.setUint32(16,crc,true); c.setUint32(20,data.length,true); c.setUint32(24,data.length,true);
    c.setUint16(28,nb.length,true); c.setUint32(42,off,true);
    cen.push(new Uint8Array(c.buffer), nb);
    off += 30 + nb.length + data.length;
  }
  const csz = cen.reduce((a,b)=>a+b.length,0), e = new DataView(new ArrayBuffer(22));
  e.setUint32(0,0x06054b50,true); e.setUint16(8,files.length,true); e.setUint16(10,files.length,true); e.setUint32(12,csz,true); e.setUint32(16,off,true);
  const all = [...parts, ...cen, new Uint8Array(e.buffer)], out = new Uint8Array(all.reduce((a,b)=>a+b.length,0));
  let p = 0; for(const a of all){ out.set(a,p); p += a.length; }
  return out;
}
const MAXCELL = 32000, CUT = " …[cut here: the full text is kept in the app]";
const x = s => String(s).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g,"").replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const colName = i => { let s = ""; i++; while(i>0){ const m = (i-1)%26; s = String.fromCharCode(65+m)+s; i = Math.floor((i-1)/26); } return s; };
const sheetName = (n, used) => { let s = String(n).replace(/[\[\]:*?\/\\]/g,"-").replace(/^'|'$/g,"").slice(0,31) || "Sheet"; let k = s, i = 2; while(used.has(k.toLowerCase())) k = s.slice(0,28)+" "+(i++); used.add(k.toLowerCase()); return k; };
/* styles: 0 plain, 1 header, 2 red, 3 amber, 4 green, 5 bold, 6 wrapped, 7 grey (read-only note) */
const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<fonts count="4"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font><font><b/><sz val="12"/><name val="Calibri"/></font><font><i/><sz val="10"/><color rgb="FF666666"/><name val="Calibri"/></font></fonts>
<fills count="7"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FF2E5E3E"/><bgColor indexed="64"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFF4B6B0"/><bgColor indexed="64"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFFBE3A6"/><bgColor indexed="64"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFC9E7C1"/><bgColor indexed="64"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFEFEFEF"/><bgColor indexed="64"/></patternFill></fill></fills>
<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="8"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>
<xf numFmtId="0" fontId="0" fillId="3" borderId="0" xfId="0" applyFill="1"/>
<xf numFmtId="0" fontId="0" fillId="4" borderId="0" xfId="0" applyFill="1"/>
<xf numFmtId="0" fontId="0" fillId="5" borderId="0" xfId="0" applyFill="1"/>
<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment wrapText="1" vertical="top"/></xf>
<xf numFmtId="0" fontId="3" fillId="6" borderId="0" xfId="0" applyFont="1" applyFill="1"/></cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;
function cellXml(ref, v, s){
  const st = s ? ` s="${s}"` : "";
  if(v===null || v===undefined || v==="") return s ? `<c r="${ref}"${st}/>` : "";
  if(typeof v==="number" && isFinite(v)) return `<c r="${ref}"${st}><v>${v}</v></c>`;
  if(typeof v==="boolean") return `<c r="${ref}"${st} t="b"><v>${v?1:0}</v></c>`;
  let t = String(v); if(t.length > MAXCELL) t = t.slice(0, MAXCELL) + CUT;
  return `<c r="${ref}"${st} t="inlineStr"><is><t xml:space="preserve">${x(t)}</t></is></c>`;
}
function sheetXml(sh){
  const rows = sh.rows||[], ncol = Math.max(1, ...rows.map(r=>r.length));
  const widths = sh.widths || Array.from({length:ncol}, (_,c) => Math.min(60, Math.max(8, ...rows.slice(0,200).map(r => { const v = r[c]; return v==null ? 0 : String(v).length; }))+2));
  const body = rows.map((r,i) => `<row r="${i+1}">${r.map((v,c) => cellXml(colName(c)+(i+1), v, sh.header&&i===0 ? 1 : (sh.style ? sh.style(i,c,v) : 0))).join("")}</row>`).join("");
  const frz = sh.header && rows.length>1 ? `<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A2" sqref="A2"/>` : "";
  const filt = sh.header && rows.length>1 ? `<autoFilter ref="A1:${colName(ncol-1)}${rows.length}"/>` : "";
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheetViews><sheetView workbookViewId="0"${sh.rtl?' rightToLeft="1"':""}>${frz}</sheetView></sheetViews><sheetFormatPr defaultRowHeight="15"/><cols>${widths.map((w,i)=>`<col min="${i+1}" max="${i+1}" width="${w}" customWidth="1"/>`).join("")}</cols><sheetData>${body}</sheetData>${filt}</worksheet>`;
}
function build(sheets){
  const used = new Set(), list = sheets.map(s => ({...s, name: sheetName(s.name, used)}));
  const files = [];
  files.push(["[Content_Types].xml", enc(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${list.map((_,i)=>`<Override PartName="/xl/worksheets/sheet${i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")}</Types>`)]);
  files.push(["_rels/.rels", enc(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`)]);
  const filters = list.map((s,i) => { const r = s.rows||[]; if(!s.header || r.length<2) return ""; const nc = Math.max(1,...r.map(a=>a.length));
    return `<definedName name="_xlnm._FilterDatabase" localSheetId="${i}" hidden="1">'${x(s.name.replace(/'/g,"''"))}'!$A$1:$${colName(nc-1)}$${r.length}</definedName>`; }).join("");
  files.push(["xl/workbook.xml", enc(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView activeTab="0"/></bookViews><sheets>${list.map((s,i)=>`<sheet name="${x(s.name)}" sheetId="${i+1}"${s.hidden?' state="hidden"':""} r:id="rId${i+1}"/>`).join("")}</sheets>${filters?`<definedNames>${filters}</definedNames>`:""}</workbook>`)]);
  files.push(["xl/_rels/workbook.xml.rels", enc(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${list.map((_,i)=>`<Relationship Id="rId${i+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i+1}.xml"/>`).join("")}<Relationship Id="rId${list.length+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`)]);
  files.push(["xl/styles.xml", enc(STYLES)]);
  list.forEach((s,i) => files.push([`xl/worksheets/sheet${i+1}.xml`, enc(sheetXml(s))]));
  const out = zip(files); out.sheetNames = list.map(s=>s.name);
  return out;
}

/* ---------- reading ---------- */
async function inflate(data){
  if(typeof DecompressionStream!=="undefined"){
    const ds = new DecompressionStream("deflate-raw"), w = ds.writable.getWriter(); w.write(data); w.close();
    return new Uint8Array(await new Response(ds.readable).arrayBuffer());
  }
  if(typeof require==="function") return new Uint8Array(require("zlib").inflateRawSync(data));
  throw new Error("This browser cannot open compressed files");
}
async function unzip(bytes){
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes), v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  let e = b.length - 22; while(e >= 0 && v.getUint32(e,true)!==0x06054b50) e--;
  if(e < 0) throw new Error("not a zip");
  const n = v.getUint16(e+10,true); let p = v.getUint32(e+16,true); const out = {}, dec = new TextDecoder();
  for(let i=0;i<n;i++){
    const meth = v.getUint16(p+10,true), csz = v.getUint32(p+20,true), nl = v.getUint16(p+28,true), xl = v.getUint16(p+30,true), cl = v.getUint16(p+32,true), lo = v.getUint32(p+42,true);
    const name = dec.decode(b.subarray(p+46, p+46+nl));
    const ds = lo + 30 + v.getUint16(lo+26,true) + v.getUint16(lo+28,true), raw = b.subarray(ds, ds+csz);
    out[name] = meth===0 ? raw : meth===8 ? null : undefined;
    if(meth===8) out[name] = await inflate(raw);
    p += 46 + nl + xl + cl;
  }
  return out;
}
const unx = s => s.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (m,c) => c[0]==="#" ? String.fromCodePoint(c[1].toLowerCase()==="x" ? parseInt(c.slice(2),16) : parseInt(c.slice(1),10)) : ({amp:"&",lt:"<",gt:">",quot:'"',apos:"'"})[c.toLowerCase()]);
const texts = s => { let t = ""; s.replace(/<(?:\w+:)?t(?:\s[^>]*)?>([\s\S]*?)<\/(?:\w+:)?t>|<(?:\w+:)?t\s*\/>/g, (m,a) => { t += a ? unx(a) : ""; }); return t; };
const attr = (tag, a) => { const m = tag.match(new RegExp(`\\s${a}="([^"]*)"`)); return m ? unx(m[1]) : null; };
const colIdx = ref => { const m = /^([A-Z]+)/.exec(ref||""); if(!m) return -1; let n = 0; for(const ch of m[1]) n = n*26 + ch.charCodeAt(0)-64; return n-1; };
async function read(bytes){
  const f = await unzip(bytes), dec = new TextDecoder(), get = p => f[p] ? dec.decode(f[p]) : "";
  const shared = []; get("xl/sharedStrings.xml").replace(/<(?:\w+:)?si>([\s\S]*?)<\/(?:\w+:)?si>/g, (m,a) => { shared.push(texts(a.replace(/<(?:\w+:)?rPh[\s\S]*?<\/(?:\w+:)?rPh>/g,""))); });
  const rels = {}; get("xl/_rels/workbook.xml.rels").replace(/<Relationship\b[^>]*>/g, t => { rels[attr(t,"Id")] = attr(t,"Target"); });
  const sheets = [];
  for(const t of get("xl/workbook.xml").match(/<(?:\w+:)?sheet\b[^>]*>/g) || []){
    const rid = attr(t,"r:id") || (t.match(/\s\w+:id="([^"]*)"/)||[])[1];
    let target = rels[rid] || ""; target = target.startsWith("/") ? target.slice(1) : "xl/" + target.replace(/^\.\//,"");
    const xml = get(target), rows = [];
    (xml.match(/<(?:\w+:)?row\b[^>]*?(?:\/>|>[\s\S]*?<\/(?:\w+:)?row>)/g) || []).forEach((rx, ri) => {
      const rn = parseInt(attr(rx.slice(0, rx.indexOf(">")+1), "r")||"0",10) || ri+1, row = [];
      let auto = 0;
      (rx.match(/<(?:\w+:)?c\b[^>]*?(?:\/>|>[\s\S]*?<\/(?:\w+:)?c>)/g) || []).forEach(cx => {
        const head = cx.slice(0, cx.indexOf(">")+1), ref = attr(head,"r"), ty = attr(head,"t");
        const ci = ref ? colIdx(ref) : auto; auto = ci+1;
        const vm = cx.match(/<(?:\w+:)?v>([\s\S]*?)<\/(?:\w+:)?v>/), vv = vm ? unx(vm[1]) : null;
        let val = null;
        if(ty==="s") val = vv==null ? null : shared[+vv] ?? "";
        else if(ty==="inlineStr") val = texts(cx);
        else if(ty==="str") val = vv ?? "";
        else if(ty==="b") val = vv==="1" || vv==="true";
        else if(ty==="e") val = null;
        else if(vv!=null && vv!=="") val = Number(vv);
        row[ci] = val;
      });
      rows[rn-1] = row;
    });
    for(let i=0;i<rows.length;i++) if(!rows[i]) rows[i] = [];
    sheets.push({name: attr(t,"name"), hidden: /state="(hidden|veryHidden)"/.test(t), rows});
  }
  return sheets;
}
const api = {build, read, colName, CUT, MAXCELL};
if(typeof module!=="undefined" && module.exports) module.exports = api; else root.FetraXlsx = api;
})(typeof window!=="undefined" ? window : globalThis);
