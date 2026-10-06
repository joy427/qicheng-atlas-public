const state = { companies: [], ownership: new Map(), query: "", exchange: "ALL", selected: null };
const $ = (selector) => document.querySelector(selector);
const escapeHtml = (value) => String(value ?? "").replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]);
const exchangeLabel = { SSE: "上交所", SZSE: "深交所", BSE: "北交所" };

function normalize(value) { return String(value ?? "").toLowerCase().replace(/\s+/g, ""); }

function renderResults() {
  const needle = normalize(state.query);
  const matches = state.companies.filter((company) => {
    if (state.exchange !== "ALL" && company.exchange !== state.exchange) return false;
    return !needle || company.search.includes(needle);
  });
  $("#result-count").textContent = `匹配 ${matches.length.toLocaleString("zh-CN")} 家`;
  $("#results").innerHTML = matches.slice(0, 100).map((company) => `
    <button class="company ${state.selected?.stockCode === company.stockCode ? "selected" : ""}" data-code="${company.stockCode}">
      <span class="code">${company.stockCode}</span>
      <span><span class="name">${escapeHtml(company.securityName)}</span><span class="meta">${escapeHtml(company.industry || company.board || "行业待补充")}</span></span>
      <span class="badge">${exchangeLabel[company.exchange] || company.exchange}</span>
    </button>`).join("") || '<div class="empty">没有找到匹配的公司。</div>';
}

function renderDetail(company) {
  const holders = state.ownership.get(company.stockCode) || [];
  const holderRows = holders.map((holder, index) => `<tr><td>${index + 1}</td><td>${escapeHtml(holder.name)}</td><td>${escapeHtml(holder.type || "未知")}</td><td>${Number(holder.percent).toFixed(4)}%</td></tr>`).join("");
  $("#detail").className = "detail-body";
  $("#detail").innerHTML = `
    <h2>${escapeHtml(company.securityName)}</h2>
    <div class="detail-code">${company.stockCode} · ${exchangeLabel[company.exchange] || company.exchange} · ${escapeHtml(company.board || "板块待补充")}</div>
    <div class="facts">
      <div class="fact"><small>公司全称</small><strong>${escapeHtml(company.companyFullName || company.securityName)}</strong></div>
      <div class="fact"><small>行业</small><strong>${escapeHtml(company.industry || "待补充")}</strong></div>
      <div class="fact"><small>上市日期</small><strong>${escapeHtml(company.listingDate || "待补充")}</strong></div>
      <div class="fact"><small>状态</small><strong>${escapeHtml(company.status || "上市")}</strong></div>
    </div>
    ${holders.length ? `<table><thead><tr><th>#</th><th>股东</th><th>类型</th><th>持股比例</th></tr></thead><tbody>${holderRows}</tbody></table>` : '<div class="notice">该公司尚未进入首批静态股东快照。企业目录信息仍可正常查看，股权数据会随每日分批导入逐步补齐。</div>'}
    <div class="notice">只读镜像不提供批量尽调提交、人工复核和实时预警。需要这些功能时，可在网络条件允许时使用全球完整版。</div>`;
}

async function boot() {
  try {
    const manifestResponse = await fetch("data/manifest.json");
    if (!manifestResponse.ok) throw new Error("数据清单加载失败");
    const manifest = await manifestResponse.json();
    const [companyChunks, ownershipChunks] = await Promise.all([
      Promise.all(manifest.companyChunks.map((name) => fetch(`data/${name}`).then((response) => response.ok ? response.json() : Promise.reject(new Error(`${name} 加载失败`))))),
      Promise.all(manifest.ownershipChunks.map((name) => fetch(`data/${name}`).then((response) => response.ok ? response.json() : Promise.reject(new Error(`${name} 加载失败`))))),
    ]);
    state.companies = companyChunks.flat().map((row) => {
      const [stockCode, securityName, companyFullName, exchange, board, industry, region, listingDate, status] = row;
      return { stockCode, securityName, companyFullName, exchange, board, industry, region, listingDate, status, search: normalize(row.join(" ")) };
    });
    for (const row of ownershipChunks.flat()) {
      const [stockCode, targetName, name, type, percent, sourceAsOf] = row;
      if (!state.ownership.has(stockCode)) state.ownership.set(stockCode, []);
      state.ownership.get(stockCode).push({ targetName, name, type, percent, sourceAsOf });
    }
    $("#company-count").textContent = manifest.companyCount.toLocaleString("zh-CN");
    $("#covered-count").textContent = manifest.companiesWithData.toLocaleString("zh-CN");
    $("#edge-count").textContent = manifest.edgeCount.toLocaleString("zh-CN");
    $("#generated-at").textContent = `镜像生成：${manifest.generatedAt.slice(0, 10)}`;
    renderResults();
  } catch (error) {
    $("#result-count").textContent = "数据载入失败";
    $("#results").innerHTML = `<div class="empty">${escapeHtml(error.message)}。请稍后刷新页面。</div>`;
  }
}

$("#search").addEventListener("input", (event) => { state.query = event.target.value; renderResults(); });
document.querySelectorAll(".filter").forEach((button) => button.addEventListener("click", () => {
  document.querySelectorAll(".filter").forEach((item) => item.classList.remove("active"));
  button.classList.add("active");
  state.exchange = button.dataset.exchange;
  renderResults();
}));
$("#results").addEventListener("click", (event) => {
  const button = event.target.closest("[data-code]");
  if (!button) return;
  state.selected = state.companies.find((company) => company.stockCode === button.dataset.code);
  renderResults();
  renderDetail(state.selected);
  if (window.innerWidth < 821) $("#detail").scrollIntoView({ behavior: "smooth", block: "start" });
});

boot();

