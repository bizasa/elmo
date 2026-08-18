export const EXPLORER_TEMPLATE = `<title>Visana AI Mentions Explorer</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
:root{
  --paper:#F5F6F9; --surface:#FFFFFF; --raise:#FBFCFE;
  --ink:#13161B; --muted:#586173; --faint:#8b93a1; --line:#E5E8EE;
  --accent:#2F55E6; --accent-soft:#EBEFFD;
  --good:#12805C; --good-bg:#E3F4ED; --mid:#A96500; --mid-bg:#FBEEDA; --weak:#C33A54; --weak-bg:#FBE6EB;
  --hl-v:#B9F0D6; --hl-c:#FCE3B8; --hl-a:#F7B9C6;
  --sans:system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
  --mono:ui-monospace,"SF Mono","Cascadia Code",Menlo,Consolas,monospace;
}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){
  --paper:#0C0F13; --surface:#14181F; --raise:#171C24;
  --ink:#E8ECF3; --muted:#98A1B0; --faint:#6b7482; --line:#242B35;
  --accent:#8098FF; --accent-soft:#1A2233;
  --good:#37C892; --good-bg:#10291F; --mid:#E0A23F; --mid-bg:#2C2211; --weak:#F1728B; --weak-bg:#2C1620;
  --hl-v:#1C5B41; --hl-c:#5A4413; --hl-a:#61232F;
}}
:root[data-theme="dark"]{
  --paper:#0C0F13; --surface:#14181F; --raise:#171C24;
  --ink:#E8ECF3; --muted:#98A1B0; --faint:#6b7482; --line:#242B35;
  --accent:#8098FF; --accent-soft:#1A2233;
  --good:#37C892; --good-bg:#10291F; --mid:#E0A23F; --mid-bg:#2C2211; --weak:#F1728B; --weak-bg:#2C1620;
  --hl-v:#1C5B41; --hl-c:#5A4413; --hl-a:#61232F;
}
*{box-sizing:border-box}
body{margin:0;background:var(--paper);color:var(--ink);font-family:var(--sans);line-height:1.55;-webkit-font-smoothing:antialiased}
.wrap{max-width:1080px;margin:0 auto;padding:clamp(18px,4vw,40px) clamp(14px,3vw,32px)}
.eyebrow{font-family:var(--mono);font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:var(--accent);font-weight:600}
h1{font-size:clamp(1.7rem,4vw,2.5rem);line-height:1.05;letter-spacing:-.025em;font-weight:720;margin:.2em 0 .25em;text-wrap:balance}
.lede{color:var(--muted);max-width:64ch;margin:0;font-size:15px}
.filters{position:sticky;top:0;z-index:5;background:color-mix(in srgb,var(--paper) 88%,transparent);
  backdrop-filter:blur(8px);border:1px solid var(--line);border-radius:14px;padding:14px 16px;margin:22px 0 16px;display:grid;gap:12px}
.frow{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.flabel{font-family:var(--mono);font-size:10.5px;text-transform:uppercase;letter-spacing:.08em;color:var(--faint);font-weight:600;min-width:64px}
.search{flex:1;min-width:200px;border:1px solid var(--line);background:var(--surface);color:var(--ink);
  border-radius:9px;padding:9px 12px;font-size:14px;font-family:var(--sans)}
.search:focus{outline:2px solid var(--accent);outline-offset:1px;border-color:transparent}
.chip{font-family:var(--mono);font-size:12px;font-weight:600;padding:6px 11px;border-radius:99px;border:1px solid var(--line);
  background:var(--surface);color:var(--muted);cursor:pointer;user-select:none;transition:.12s}
.chip:hover{border-color:var(--accent)}
.chip[aria-pressed="true"]{background:var(--accent);color:#fff;border-color:var(--accent)}
.chip.tri[data-on="yes"]{background:var(--good);border-color:var(--good);color:#fff}
.chip.tri[data-on="no"]{background:var(--weak);border-color:var(--weak);color:#fff}
select{border:1px solid var(--line);background:var(--surface);color:var(--ink);border-radius:9px;padding:8px 10px;font-size:13px;font-family:var(--sans);cursor:pointer}
.reset{margin-left:auto;font-family:var(--mono);font-size:12px;color:var(--accent);background:none;border:none;cursor:pointer;text-decoration:underline}
.statbar{display:flex;flex-wrap:wrap;gap:8px 20px;align-items:baseline;font-size:13px;color:var(--muted);margin-bottom:14px;font-variant-numeric:tabular-nums}
.statbar b{color:var(--ink);font-size:15px}
.results{display:grid;gap:12px}
.card{background:var(--surface);border:1px solid var(--line);border-radius:13px;padding:15px 16px}
.chead{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-bottom:9px}
.mchip{font-family:var(--mono);font-size:11px;font-weight:700;padding:3px 9px;border-radius:7px;color:#fff}
.m-google-ai-mode{background:#2F6BE6}.m-gemini{background:#0E9488}.m-chatgpt{background:#3B4252}.m-perplexity{background:#8257C4}.m-copilot{background:#1E88A8}
.tag{font-family:var(--mono);font-size:10px;text-transform:uppercase;letter-spacing:.05em;padding:2px 7px;border-radius:6px;background:var(--line);color:var(--muted);font-weight:600}
.date{font-family:var(--mono);font-size:11px;color:var(--faint);margin-left:auto}
.vbadge{font-family:var(--mono);font-size:11px;font-weight:700;padding:3px 9px;border-radius:7px}
.vbadge.y{background:var(--good-bg);color:var(--good)} .vbadge.n{background:var(--line);color:var(--faint)}
.prompt{font-weight:640;font-size:14.5px;margin:2px 0 8px}
.comps{display:flex;flex-wrap:wrap;gap:5px;margin-bottom:9px}
.cc{font-family:var(--mono);font-size:10.5px;font-weight:600;padding:2px 7px;border-radius:6px;background:var(--accent-soft);color:var(--accent)}
.cc.u{background:var(--weak-bg);color:var(--weak)}
.excerpt{font-size:13.5px;color:var(--muted);line-height:1.62;max-height:4.9em;overflow:hidden;position:relative}
.excerpt.open{max-height:none}
.excerpt mark{border-radius:3px;padding:0 2px;color:var(--ink)}
mark.hl-v{background:var(--hl-v)} mark.hl-c{background:var(--hl-c)} mark.hl-a{background:var(--hl-a)}
.more{font-family:var(--mono);font-size:11.5px;color:var(--accent);background:none;border:none;cursor:pointer;padding:6px 0 0}
.loadmore{margin:20px auto 0;display:block;font-family:var(--mono);font-size:13px;padding:10px 22px;border-radius:10px;
  border:1px solid var(--line);background:var(--surface);color:var(--ink);cursor:pointer}
.loadmore:hover{border-color:var(--accent)}
.empty{text-align:center;color:var(--faint);padding:50px 0;font-family:var(--mono);font-size:13px}
.legend{display:flex;flex-wrap:wrap;gap:14px;font-size:12px;color:var(--muted);margin-top:6px}
.legend span{display:inline-flex;align-items:center;gap:6px}
.sw{width:13px;height:13px;border-radius:3px;display:inline-block}
footer{margin-top:36px;padding-top:18px;border-top:1px solid var(--line);color:var(--faint);font-size:12px;font-family:var(--mono);line-height:1.8}
#narrative{margin:14px 0 22px;padding:16px 18px;border:1px solid var(--line);border-radius:13px;background:var(--raise)}
#narrative h2{font-size:15px;margin:0 0 8px} #narrative h3{font-size:12.5px;margin:14px 0 4px;color:var(--muted);text-transform:uppercase;letter-spacing:.05em}
#narrative ul{margin:4px 0 0;padding-left:18px} #narrative li{margin:2px 0;font-size:14px} #narrative p{margin:0;font-size:14px}
</style>

<div class="wrap">
  <div class="eyebrow">Elmo · Visana · Trình khám phá câu trả lời AI</div>
  <h1>Các LLM nói gì về Visana — tra cứu theo ngữ cảnh</h1>
  <p class="lede">Lọc theo model, sản phẩm, tầng phễu, có/không nhắc Visana, hoặc theo đối thủ — rồi đọc thẳng đoạn văn AI sinh ra (Visana tô xanh, đối thủ tô vàng). Dùng để đối chiếu chéo từng trường hợp cụ thể.</p>

  <div class="filters">
    <div class="frow"><input id="q" class="search" type="search" placeholder="Tìm trong câu hỏi hoặc nội dung trả lời…"><button class="reset" id="reset">Đặt lại</button></div>
    <div class="frow"><span class="flabel">Model</span><span id="fmodels"></span></div>
    <div class="frow"><span class="flabel">Sản phẩm</span><span id="fprods"></span>
      <span class="flabel" style="margin-left:12px">Phễu</span><span id="ffuns"></span></div>
    <div class="frow"><span class="flabel">Visana</span>
      <button class="chip tri" id="fvis" data-on="all">Tất cả</button>
      <span class="flabel" style="margin-left:12px">Đối thủ</span>
      <select id="fcomp"><option value="">— Mọi đối thủ —</option></select></div>
  </div>

  <div class="statbar" id="stat"></div>
  <div id="narrative">__NARRATIVE_HTML__</div>
  <div class="legend">
    <span><i class="sw" style="background:var(--hl-v)"></i>Visana</span>
    <span><i class="sw" style="background:var(--hl-c)"></i>Đối thủ</span>
    <span><i class="sw" style="background:var(--hl-a)"></i>Đối thủ đang lọc</span>
    <span><i class="sw" style="background:var(--weak-bg)"></i>chip đỏ = chưa được Visana theo dõi</span>
  </div>

  <div class="results" id="results"></div>
  <button class="loadmore" id="loadmore" hidden>Hiện thêm</button>

  <footer id="foot"></footer>
</div>

<script>const DATA = __DATA__;
const CFG = __CONFIG__;
const MODELS = CFG.models, PRODS = CFG.prods, FUNS = CFG.funs;
const UNTRACKED = new Set(CFG.untracked);
const ALTS = CFG.alts;
const BRAND_TERMS = CFG.brandTerms;
const BRAND_LABEL = __BRAND_LABEL__;</script>
<script>

const state = { q:"", models:new Set(), prods:new Set(), funs:new Set(), vis:"all", comp:"" };
let limit = 60;
const el = (id)=>document.getElementById(id);
const esc = (s)=>s.replace(/[&<>"]/g,(c)=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const escRe = (s)=>s.replace(/[.*+?^\${}()|[\\]\\\\]/g,"\\\\$&");

// build chip groups
function chips(host, items, set){
  el(host).innerHTML = items.map(([v,l])=>\`<button class="chip" data-v="\${v}" aria-pressed="false">\${l}</button>\`).join(" ");
  el(host).querySelectorAll(".chip").forEach(b=>b.onclick=()=>{
    const v=b.dataset.v; if(set.has(v)){set.delete(v);b.setAttribute("aria-pressed","false");}else{set.add(v);b.setAttribute("aria-pressed","true");}
    limit=60; render();
  });
}
chips("fmodels", MODELS, state.models);
chips("fprods", PRODS, state.prods);
chips("ffuns", FUNS, state.funs);

// competitor select
(function(){
  const counts={}; DATA.forEach(r=>r.c.forEach(c=>counts[c]=(counts[c]||0)+1));
  const opts=Object.entries(counts).sort((a,b)=>b[1]-a[1]);
  el("fcomp").innerHTML += opts.map(([c,n])=>\`<option value="\${esc(c)}">\${esc(c)}\${UNTRACKED.has(c)?" ⚠":""} (\${n})</option>\`).join("");
})();
el("fcomp").onchange=(e)=>{state.comp=e.target.value;limit=60;render();};

// visana tri-state
el("fvis").onclick=()=>{ state.vis = state.vis==="all"?"yes":state.vis==="yes"?"no":"all";
  const b=el("fvis"); b.dataset.on=state.vis; b.textContent = state.vis==="all"?"Tất cả":state.vis==="yes"?"Có nhắc":"Không nhắc"; limit=60; render(); };

el("q").oninput=(e)=>{state.q=e.target.value.trim().toLowerCase();limit=60;render();};
el("reset").onclick=()=>{ state.q="";state.models.clear();state.prods.clear();state.funs.clear();state.vis="all";state.comp="";
  el("q").value="";el("fcomp").value="";el("fvis").dataset.on="all";el("fvis").textContent="Tất cả";
  document.querySelectorAll(".chip[aria-pressed]").forEach(b=>b.setAttribute("aria-pressed","false")); limit=60; render(); };
el("loadmore").onclick=()=>{limit+=60;render();};

function match(r){
  if(state.models.size && !state.models.has(r.m)) return false;
  if(state.prods.size && !state.prods.has(r.pr)) return false;
  if(state.funs.size && !state.funs.has(r.fn)) return false;
  if(state.vis==="yes" && !r.v) return false;
  if(state.vis==="no" && r.v) return false;
  if(state.comp && !r.c.includes(state.comp)) return false;
  if(state.q && !(r.p.toLowerCase().includes(state.q) || r.x.toLowerCase().includes(state.q))) return false;
  return true;
}

function hl(text, comps){
  const map={}; BRAND_TERMS.forEach(a=>map[a]="hl-v");
  comps.forEach(name=>{ const cls = name===state.comp?"hl-a":"hl-c"; (ALTS[name]||[name.toLowerCase()]).forEach(a=>{ if(!map[a]||cls==="hl-a")map[a]=cls; }); });
  const parts=Object.keys(map).sort((a,b)=>b.length-a.length);
  const out=esc(text);
  const re=new RegExp("("+parts.map(escRe).join("|")+")","giu");
  return out.replace(re,(m)=>\`<mark class="\${map[m.toLowerCase()]||"hl-c"}">\${m}</mark>\`);
}

const mLabel=Object.fromEntries(MODELS), mCls=(m)=>"m-"+m;
function card(r){
  const comps=r.c.map(c=>\`<span class="cc \${UNTRACKED.has(c)?"u":""}">\${esc(c)}</span>\`).join("");
  return \`<div class="card">
    <div class="chead">
      <span class="mchip \${mCls(r.m)}">\${esc(mLabel[r.m]||r.m)}</span>
      <span class="tag">\${esc(r.pr)}</span><span class="tag">\${esc(r.fn)}</span>
      <span class="vbadge \${r.v?"y":"n"}">\${r.v?("✓ "+esc(BRAND_LABEL)+" #"+(r.pos??"?")):("✗ không nhắc "+esc(BRAND_LABEL))}</span>
      <span class="date">\${r.d}</span>
    </div>
    <div class="prompt">\${esc(r.p)}</div>
    \${comps?\`<div class="comps">\${comps}</div>\`:""}
    <div class="excerpt">\${hl(r.x, r.c)}</div>
    <button class="more">Xem đầy đủ</button>
  </div>\`;
}

function render(){
  const list=DATA.filter(match);
  const visN=list.filter(r=>r.v).length;
  const pct=list.length?Math.round(100*visN/list.length):0;
  el("stat").innerHTML=\`<span><b>\${list.length.toLocaleString("vi")}</b> / \${DATA.length.toLocaleString("vi")} lượt</span>\`+
    \`<span>\`+BRAND_LABEL+\` xuất hiện <b>\${pct}%</b> (\${visN.toLocaleString("vi")})</span>\`+
    (state.comp?\`<span>Đang lọc đối thủ: <b>\${esc(state.comp)}</b></span>\`:"");
  const shown=list.slice(0,limit);
  el("results").innerHTML = shown.length?shown.map(card).join(""):\`<div class="empty">Không có lượt nào khớp bộ lọc.</div>\`;
  el("results").querySelectorAll(".more").forEach((b)=>b.onclick=()=>{const ex=b.previousElementSibling;ex.classList.toggle("open");b.textContent=ex.classList.contains("open")?"Thu gọn":"Xem đầy đủ";});
  el("loadmore").hidden = list.length<=limit;
  el("loadmore").textContent=\`Hiện thêm (\${Math.min(60,list.length-limit)} / còn \${list.length-limit})\`;
}

el("foot").innerHTML = __FOOTER_HTML__;
render();
</script>
`;
