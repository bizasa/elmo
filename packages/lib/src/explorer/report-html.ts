import type { Narrative, ReportMetrics } from "./types";

function esc(s: string): string {
	return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] as string);
}

function fmtInt(n: number): string {
	return n.toLocaleString("vi");
}

function visTier(v: number): "good" | "mid" | "weak" {
	return v >= 50 ? "good" : v >= 25 ? "mid" : "weak";
}

function posTier(p: number | null): "good" | "mid" | "weak" | "na" {
	if (p == null) return "na";
	return p <= 1.3 ? "good" : p <= 1.7 ? "mid" : "weak";
}

function bar(v: number): string {
	return `<span class="bar"><span class="bar-fill t-${visTier(v)}" style="width:${v}%"></span></span>`;
}

function posChip(p: number | null): string {
	if (p == null) return `<span class="chip na">—</span>`;
	return `<span class="chip ${posTier(p)}">#${p.toFixed(2)}</span>`;
}

function visChip(v: number): string {
	return `<span class="chip ${visTier(v)}">${v}%</span>`;
}

function note(text: string | undefined): string {
	return text ? `<p class="note">${esc(text)}</p>` : "";
}

function rowbar(label: string, visibilityPct: number, avgPosition: number | null, runs: number): string {
	return `<div class="rowbar">
      <div class="rowbar-head"><span class="rl">${esc(label)}</span><span class="rv">${visibilityPct}%</span></div>
      ${bar(visibilityPct)}
      <div class="rowbar-foot"><span>${fmtInt(runs)} lượt chạy</span>${posChip(avgPosition)}</div>
    </div>`;
}

function pill(text: string): string {
	return `<span class="pill">${esc(text)}</span>`;
}

export function renderReportBody(metrics: ReportMetrics, narrative: Narrative | null, opts: { brandName: string; windowDays: number }): string {
	const { brandName, windowDays } = opts;

	const modelRows = metrics.byModel
		.map(
			(x) => `<tr>
      <td class="q"><strong>${esc(x.model)}</strong></td>
      <td class="num">${fmtInt(x.runs)}</td>
      <td class="num">${fmtInt(x.mentioned)}</td>
      <td class="visc"><span class="visnum">${x.visibilityPct}%</span>${bar(x.visibilityPct)}</td>
      <td class="ctr">${posChip(x.avgPosition)}</td>
    </tr>`,
		)
		.join("\n");

	const funnelBars = metrics.byFunnel.map((f) => rowbar(f.key.toUpperCase(), f.visibilityPct, f.avgPosition, f.runs)).join("");
	const productBars = metrics.byProduct.map((p) => rowbar(p.key, p.visibilityPct, p.avgPosition, p.runs)).join("");

	const trackedPills = metrics.competitorsTracked.length
		? metrics.competitorsTracked.map(pill).join("")
		: `<span class="pill">— không có —</span>`;
	const untrackedPills = metrics.competitorsUntracked.length
		? metrics.competitorsUntracked.map(pill).join("")
		: `<span class="pill">— không có —</span>`;

	const weakRows = metrics.weakPrompts
		.map(
			(p) => `<tr>
      <td class="q">${esc(p.prompt)}</td>
      <td class="ctr">${p.product ? esc(p.product) : "—"}</td>
      <td class="ctr">${p.funnel ? `<span class="tag fn">${esc(p.funnel)}</span>` : "—"}</td>
      <td class="num">${fmtInt(p.mentioned)}/${fmtInt(p.runs)}</td>
      <td class="ctr">${visChip(p.visibilityPct)}</td>
    </tr>`,
		)
		.join("\n");

	const allRows = metrics.allPrompts
		.map(
			(p) => `<tr>
      <td class="q">${esc(p.prompt)}</td>
      <td class="ctr">${p.product ? esc(p.product) : "—"}</td>
      <td class="ctr">${p.funnel ? `<span class="tag fn">${esc(p.funnel)}</span>` : "—"}</td>
      <td class="num">${fmtInt(p.runs)}</td>
      <td class="visc"><span class="visnum">${p.visibilityPct}%</span>${bar(p.visibilityPct)}</td>
      <td class="ctr">${posChip(p.avgPosition)}</td>
    </tr>`,
		)
		.join("\n");

	const recs =
		narrative && narrative.recommendations.length
			? narrative.recommendations.map((r) => `<div class="rec"><h3>${esc(r.title)}</h3><p>${esc(r.body)}</p></div>`).join("")
			: "";

	return `<header>
    <div class="eyebrow">Elmo · Báo cáo AI Visibility (GEO)</div>
    <h1>${esc(brandName)} trên các cỗ máy trả lời AI</h1>
    <p class="lede">Các LLM nhắc ${esc(brandName)} ở đâu, xếp brand ở vị trí nào, và <em>nói gì</em> về brand — tổng hợp từ ${fmtInt(metrics.totalAnswers)} lượt chạy prompt trong ${windowDays} ngày qua.</p>
    <div class="meta">
      <span>Brand <b>${esc(brandName)}</b></span><span>Cửa sổ <b>${windowDays} ngày</b></span><span>Model <b>${metrics.modelCount}</b></span>
      <span>Prompt <b>${metrics.promptCount}</b></span><span>Sản phẩm <b>${metrics.productCount}</b></span>
    </div>
  </header>

  ${note(narrative?.summary)}

  <div class="metrics">
    <div class="metric"><div class="k">AI Visibility</div><div class="v ${visTier(metrics.visibilityPct)}">${metrics.visibilityPct}%</div><div class="s">${fmtInt(metrics.mentioned)} / ${fmtInt(metrics.totalAnswers)} lượt có nhắc brand</div></div>
    <div class="metric"><div class="k">Vị trí trung bình</div><div class="v ${posTier(metrics.avgPosition)}">${metrics.avgPosition == null ? "—" : `#${metrics.avgPosition.toFixed(2)}`}</div><div class="s">khi được nhắc, trên tập brand + đối thủ</div></div>
    <div class="metric"><div class="k">Prompt phủ tốt (&ge;50%)</div><div class="v good">${metrics.promptsStrong}</div><div class="s">trên tổng ${metrics.promptCount} prompt</div></div>
    <div class="metric"><div class="k">Prompt gần như vắng (&lt;15%)</div><div class="v weak">${metrics.promptsWeak}</div><div class="s">trên tổng ${metrics.promptCount} prompt</div></div>
  </div>

  <section>
    <div class="sec-head"><span class="sec-num">01</span><h2>Phân bổ theo model</h2></div>
    ${note(narrative?.byModelNote)}
    <div class="tablewrap"><table>
      <thead><tr><th>Model</th><th class="num">Lượt chạy</th><th class="num">Có nhắc</th><th>Visibility</th><th class="ctr">Vị trí TB</th></tr></thead>
      <tbody>${modelRows}</tbody>
    </table></div>
  </section>

  <section>
    <div class="sec-head"><span class="sec-num">02</span><h2>Theo tầng phễu &amp; sản phẩm</h2></div>
    ${note(narrative?.byFunnelNote)}
    <div class="subhead">Theo tầng phễu</div>
    <div class="rowbars">${funnelBars}</div>
    <div class="subhead">Theo sản phẩm</div>
    <div class="grid2 rowbars">${productBars}</div>
  </section>

  <section>
    <div class="sec-head"><span class="sec-num">03</span><h2>LLM nói gì về ${esc(brandName)}</h2></div>
    ${note(narrative?.whatLLMsSay)}
  </section>

  <section>
    <div class="sec-head"><span class="sec-num">04</span><h2>Đối thủ bị nhắc kèm</h2></div>
    <div class="compcols">
      <div class="compcol tracked"><h4>Đang theo dõi &amp; hay bị nhắc kèm</h4>
        <div class="pills">${trackedPills}</div></div>
      <div class="compcol untracked"><h4>Chưa theo dõi — nên thêm</h4>
        <div class="pills">${untrackedPills}</div></div>
    </div>
  </section>

  <section>
    <div class="sec-head"><span class="sec-num">05</span><h2>Prompt gần như chưa được nhắc</h2></div>
    ${note(narrative?.weakNote)}
    <div class="tablewrap"><table>
      <thead><tr><th>Prompt</th><th class="ctr">Sản phẩm</th><th class="ctr">Phễu</th><th class="num">Nhắc/Chạy</th><th class="ctr">Visibility</th></tr></thead>
      <tbody>${weakRows}</tbody>
    </table></div>
  </section>

  <section>
    <div class="sec-head"><span class="sec-num">06</span><h2>Toàn bộ prompt</h2></div>
    <div class="tablewrap"><table>
      <thead><tr><th>Prompt (query)</th><th class="ctr">Sản phẩm</th><th class="ctr">Phễu</th><th class="num">Lượt</th><th>Visibility</th><th class="ctr">Vị trí TB</th></tr></thead>
      <tbody>${allRows}</tbody>
    </table></div>
  </section>

  <section>
    <div class="sec-head"><span class="sec-num">07</span><h2>Khuyến nghị GEO</h2></div>
    <div class="recs">${recs}</div>
  </section>`;
}
