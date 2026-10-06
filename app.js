const state = { companies: [], ownership: new Map(), ownershipChunks: new Map(), manifest: null, query: "", exchange: "ALL", selected: null, visible: 100 };
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
  const rows = matches.slice(0, state.visible).map((company) => `
    <button class="company ${state.selected?.stockCode === company.stockCode ? "selected" : ""}" data-code="${company.stockCode}">
      <span class="code">${company.stockCode}</span>
      <span><span class="name">${escapeHtml(company.securityName)}</span><span class="meta">${escapeHtml(company.industry || company.board || "行业待补充")}</span></span>
      <span class="badge">${exchangeLabel[company.exchange] || company.exchange}</span>
    </button>`).join("");
  const more = matches.length > state.visible ? `<button class="load-more" data-load-more="true">继续显示（剩余 ${(matches.length - state.visible).toLocaleString("zh-CN")} 家）</button>` : "";
  $("#results").innerHTML = rows ? rows + more : '<div class="empty">没有找到匹配的公司。</div>';
}

function renderDetail(company, holders = []) {
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

async function loadOwnership(stockCode) {
  if (state.ownership.has(stockCode)) return state.ownership.get(stockCode);
  const chunkIndexes = state.manifest.ownershipIndex[stockCode] || [];
  const rows = (await Promise.all(chunkIndexes.map(async (index) => {
    if (!state.ownershipChunks.has(index)) {
      const name = state.manifest.ownershipChunks[index];
      const response = await fetch(`data/${name}`);
      if (!response.ok) throw new Error(`${name} 加载失败`);
      state.ownershipChunks.set(index, await response.json());
    }
    return state.ownershipChunks.get(index);
  }))).flat().filter((row) => row[0] === stockCode);
  const holders = rows.map((row) => ({ targetName: row[1], name: row[2], type: row[3], percent: row[4], sourceAsOf: row[5] }));
  state.ownership.set(stockCode, holders);
  return holders;
}

async function boot() {
  try {
    const manifestResponse = await fetch("data/manifest.json");
    if (!manifestResponse.ok) throw new Error("数据清单加载失败");
    const manifest = await manifestResponse.json();
    state.manifest = manifest;
    const companyChunks = await Promise.all(manifest.companyChunks.map((name) => fetch(`data/${name}`).then((response) => response.ok ? response.json() : Promise.reject(new Error(`${name} 加载失败`)))));
    state.companies = companyChunks.flat().map((row) => {
      const [stockCode, securityName, companyFullName, exchange, board, industry, region, listingDate, status] = row;
      return { stockCode, securityName, companyFullName, exchange, board, industry, region, listingDate, status, search: normalize(row.join(" ")) };
    });
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

$("#search").addEventListener("input", (event) => { state.query = event.target.value; state.visible = 100; renderResults(); });
document.querySelectorAll(".filter").forEach((button) => button.addEventListener("click", () => {
  document.querySelectorAll(".filter").forEach((item) => item.classList.remove("active"));
  button.classList.add("active");
  state.exchange = button.dataset.exchange;
  state.visible = 100;
  renderResults();
}));
$("#results").addEventListener("click", async (event) => {
  if (event.target.closest("[data-load-more]")) {
    state.visible += 100;
    renderResults();
    return;
  }
  const button = event.target.closest("[data-code]");
  if (!button) return;
  state.selected = state.companies.find((company) => company.stockCode === button.dataset.code);
  renderResults();
  const selectedCode = state.selected.stockCode;
  $("#detail").className = "empty";
  $("#detail").textContent = "正在载入该公司的股东快照…";
  try {
    const holders = await loadOwnership(selectedCode);
    if (state.selected?.stockCode === selectedCode) renderDetail(state.selected, holders);
  } catch (error) {
    $("#detail").textContent = `${error.message}。请稍后重试。`;
  }
  if (window.innerWidth < 821) $("#detail").scrollIntoView({ behavior: "smooth", block: "start" });
});

boot();

