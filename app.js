/* =========================
   CATEGORIAS
========================= */

const categorias = {
  "Renda": ["Saldo anterior", "Salário", "13º", "Férias", "Outros"],

  "Habitação": ["Condomínio", "Prestação", "Luz", "Gás", "Internet", "Outros"],
  "Saúde": ["Plano", "Farmácia", "Consultas", "Exames", "Outros"],
  "Alimentação": ["Mercado", "Restaurante", "Cafeteria", "Outros"],
  "Transporte": ["Uber", "Táxi", "Ônibus", "Metrô", "Outros"],
  "Cursos": ["Curso principal", "Outros"],
  "Pessoal": ["Vestuário", "Salão", "Outros"],
  "Lazer": ["Viagem", "Livros", "Passeios", "Outros"],
  "Cartão": ["Assinaturas", "Compras"],
  "Outros gastos": ["Diversos"],

  "Investimentos": ["Ações", "FII", "Poupança", "Previdência"]
};

const RENDA_SUBS = ["Saldo anterior", "Salário", "13º", "Férias", "Outros"];

/* =========================
   HELPERS
========================= */

function ymNow() { return new Date().toISOString().slice(0, 7); }

function money(n) {
  const v = Number(n || 0);
  return "R$ " + v.toFixed(2);
}

function uid() {
  return (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random());
}

function sumByCategory(list) {
  const out = {};
  for (const l of list) {
    const k = l.categoria || "Sem categoria";
    out[k] = (out[k] || 0) + Number(l.valor || 0);
  }
  return out;
}

function sumRendaPorSubcategoria(lancs) {
  const out = {};
  RENDA_SUBS.forEach(s => out[s] = 0);
  lancs.forEach(l => {
    const sub = l.subcategoria || "Outros";
    if (!out[sub]) out[sub] = 0;
    out[sub] += Number(l.valor || 0);
  });
  return out;
}

/* =========================
   INIT SELECTS (LANÇAMENTO)
========================= */

const categoriaSelect = document.getElementById("categoria");
const subcategoriaSelect = document.getElementById("subcategoria");

function carregarCategorias() {
  if (!categoriaSelect) return;
  categoriaSelect.innerHTML = "";
  Object.keys(categorias).forEach(cat => {
    const opt = document.createElement("option");
    opt.textContent = cat;
    categoriaSelect.appendChild(opt);
  });
  atualizarSubcategorias();
}

function atualizarSubcategorias() {
  if (!categoriaSelect || !subcategoriaSelect) return;
  const cat = categoriaSelect.value;
  subcategoriaSelect.innerHTML = "";
  (categorias[cat] || ["Outros"]).forEach(sub => {
    const opt = document.createElement("option");
    opt.textContent = sub;
    subcategoriaSelect.appendChild(opt);
  });
}

if (categoriaSelect) categoriaSelect.addEventListener("change", atualizarSubcategorias);

function initLancamentoDefaults() {
  const comp = document.getElementById("competencia");
  if (comp && !comp.value) comp.value = ymNow();
}

/* =========================
   NAV
========================= */

function showView(view) {
  const ids = ["lancar", "mes", "cartao", "invest", "mais"];
  ids.forEach(id => {
    const el = document.getElementById(`view-${id}`);
    if (el) el.classList.remove("active");
  });

  const active = document.getElementById(`view-${view}`);
  if (active) active.classList.add("active");

  if (view === "mes") {
    initMesUI();
    renderDashboard();
  }

  if (view === "cartao") {
    initCartaoUI();
    renderCartao();
    renderSubscriptionsMaster();
  }

  if (view === "invest") {
    renderInvestimentos();
  }
}

/* =========================
   SALVAR LANÇAMENTO
========================= */

function salvarLancamento() {
  const dataStore = loadData();

  const conta = document.getElementById("conta")?.value || "Bradesco";
  const tipo = document.getElementById("tipo")?.value || "Despesa";
  const categoria = categoriaSelect?.value || "Outros gastos";
  const subcategoria = subcategoriaSelect?.value || "Diversos";
  const valor = Number(document.getElementById("valor")?.value || 0);
  const competencia = document.getElementById("competencia")?.value || ymNow();
  const descricao = document.getElementById("descricao")?.value || "";

  if (!valor || valor <= 0) {
    alert("Informe um valor válido.");
    return;
  }

  dataStore.lancamentos.push({
    id: uid(),
    conta,
    tipo,
    categoria,
    subcategoria,
    valor,
    competencia,
    descricao
  });

  saveData(dataStore);

  // limpa campos principais
  document.getElementById("valor").value = "";
  document.getElementById("descricao").value = "";

  alert("Lançamento salvo!");

  // se estiver no mês, atualiza
  renderDashboard();
}

/* =========================
   MÊS (DASHBOARD)
========================= */

function initMesUI() {
  const dash = document.getElementById("dash-month");
  if (dash && !dash.value) dash.value = ymNow();
  if (dash) dash.onchange = renderDashboard;
}

function renderDashboard() {
  const data = loadData();
  const month = document.getElementById("dash-month")?.value || ymNow();
  const L = (data.lancamentos || []).filter(l => l.competencia === month);

  // ===== BRADESCO =====
  const bradRendaLancs = L.filter(l =>
    l.conta === "Bradesco" &&
    l.tipo === "Receita" &&
    l.categoria === "Renda"
  );

  const rendaPorSub = sumRendaPorSubcategoria(bradRendaLancs);

  const totalDisponivel =
    rendaPorSub["Saldo anterior"] +
    rendaPorSub["Salário"] +
    rendaPorSub["13º"] +
    rendaPorSub["Férias"] +
    rendaPorSub["Outros"];

  const bradDespesasBase = L.filter(l =>
    l.conta === "Bradesco" &&
    (l.tipo === "Despesa" || l.tipo === "Transferência")
  );

  const cardLancs = L.filter(l => l.conta === "Cartão");
  const totalCartao = cardLancs.reduce((a, b) => a + Number(b.valor || 0), 0);

  const bradByCat = sumByCategory(bradDespesasBase);
  bradByCat["Cartão"] = totalCartao;

  const totalDespesasBrad =
    bradDespesasBase.reduce((a,b)=>a+Number(b.valor||0),0) + totalCartao;

  const resultadoBrad = totalDisponivel - totalDespesasBrad;

  // ===== BB =====
  const bbEntradas = L.filter(l =>
    l.conta === "Banco do Brasil" &&
    (l.tipo === "Receita" || l.tipo === "Transferência")
  );

  const bbSaidas = L.filter(l =>
    l.conta === "Banco do Brasil" &&
    l.tipo === "Despesa"
  );

  const bbInvest = bbSaidas.filter(l => l.categoria === "Investimentos");
  const bbGastos = bbSaidas.filter(l => l.categoria !== "Investimentos");

  const totalBbEntradas = bbEntradas.reduce((a,b)=>a+Number(b.valor||0),0);
  const totalBbInvest = bbInvest.reduce((a,b)=>a+Number(b.valor||0),0);
  const totalBbGastos = bbGastos.reduce((a,b)=>a+Number(b.valor||0),0);
  const resultadoBB = totalBbEntradas - (totalBbInvest + totalBbGastos);

  const dashboardEl = document.getElementById("dashboard");
  if (!dashboardEl) return;

  // Monta layout BRAD | BB
  const bradCatsSorted = Object.entries(bradByCat).sort((a,b)=>b[1]-a[1]);
  const bbGastosByCat = sumByCategory(bbGastos);
  const bbInvestBySub = {};
  bbInvest.forEach(l => {
    const k = l.subcategoria || "Invest";
    bbInvestBySub[k] = (bbInvestBySub[k] || 0) + Number(l.valor || 0);
  });

  dashboardEl.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem">

      <div class="card">
        <h4>Bradesco</h4>
        <div class="row"><span>Saldo anterior</span><span>${money(rendaPorSub["Saldo anterior"])}</span></div>
        <div class="row"><span>Salário</span><span>${money(rendaPorSub["Salário"])}</span></div>
        <div class="row"><span>13º</span><span>${money(rendaPorSub["13º"])}</span></div>
        <div class="row"><span>Férias</span><span>${money(rendaPorSub["Férias"])}</span></div>
        <div class="row"><span>Outros</span><span>${money(rendaPorSub["Outros"])}</span></div>
        <hr/>
        <div class="row big"><span>Total disponível</span><span>${money(totalDisponivel)}</span></div>

        <hr/>
        <h4>Gastos</h4>
        ${bradCatsSorted.map(([k,v]) => `<div class="row"><span>${k}</span><span>${money(v)}</span></div>`).join("")}
        <hr/>
        <div class="row big"><span>Total gastos</span><span>${money(totalDespesasBrad)}</span></div>
        <div class="row big"><span>Diferença do mês</span><span>${money(resultadoBrad)}</span></div>
      </div>

      <div class="card">
        <h4>Banco do Brasil</h4>
        <div class="row big"><span>Entradas</span><span>${money(totalBbEntradas)}</span></div>
        <div class="row"><span>Gastos</span><span>${money(totalBbGastos)}</span></div>
        <div class="row"><span>Investimentos</span><span>${money(totalBbInvest)}</span></div>
        <hr/>
        <div class="row big"><span>Resultado BB</span><span>${money(resultadoBB)}</span></div>

        <hr/>
        <h4>Gastos (por categoria)</h4>
        ${Object.entries(bbGastosByCat).sort((a,b)=>b[1]-a[1]).map(([k,v]) => `<div class="row"><span>${k}</span><span>${money(v)}</span></div>`).join("")}

        <hr/>
        <h4>Investimentos (por tipo)</h4>
        ${Object.entries(bbInvestBySub).sort((a,b)=>b[1]-a[1]).map(([k,v]) => `<div class="row"><span>${k}</span><span>${money(v)}</span></div>`).join("")}
      </div>

    </div>
  `;
}

/* =========================
   CARTÃO
========================= */

function initCartaoUI() {
  const el = document.getElementById("card-month");
  if (el && !el.value) el.value = ymNow();
  if (el) el.onchange = renderCartao;

  const btnAddSub = document.getElementById("btn-add-sub");
  const btnSync = document.getElementById("btn-sync-subs");

  if (btnAddSub) btnAddSub.onclick = addSubscription;
  if (btnSync) btnSync.onclick = syncSubscriptionsToMonth;
}

function addSubscription() {
  const data = loadData();

  const name = prompt("Nome da assinatura:");
  if (!name) return;

  const value = Number(prompt("Valor (ex: 19.90):"));
  if (!isFinite(value) || value <= 0) return alert("Valor inválido.");

  let periodicity = (prompt("Periodicidade: mensal ou anual?", "mensal") || "mensal").toLowerCase();
  if (!["mensal","anual"].includes(periodicity)) return alert("Use mensal ou anual.");

  let dueMonth = null;
  if (periodicity === "anual") {
    dueMonth = (prompt("Mês de cobrança (01 a 12):", "01") || "").padStart(2,"0");
    if (!/^(0[1-9]|1[0-2])$/.test(dueMonth)) return alert("Mês inválido.");
  }

  data.subscriptions.push({
    id: uid(),
    name: name.trim(),
    value,
    periodicity,
    dueMonth,
    active: true
  });

  saveData(data);
  renderSubscriptionsMaster();
}

function toggleSubscriptionActive(id) {
  const data = loadData();
  const s = data.subscriptions.find(x => x.id === id);
  if (!s) return;
  s.active = !s.active;
  saveData(data);
  renderSubscriptionsMaster();
}

function editSubscription(id) {
  const data = loadData();
  const s = data.subscriptions.find(x => x.id === id);
  if (!s) return;

  const name = prompt("Nome:", s.name) ?? s.name;
  const value = Number(prompt("Valor:", String(s.value)) ?? s.value);
  if (!name.trim() || !isFinite(value) || value <= 0) return alert("Dados inválidos.");

  let periodicity = (prompt("Periodicidade: mensal ou anual?", s.periodicity) ?? s.periodicity).toLowerCase();
  if (!["mensal","anual"].includes(periodicity)) return alert("Use mensal ou anual.");

  let dueMonth = null;
  if (periodicity === "anual") {
    dueMonth = (prompt("Mês de cobrança (01 a 12):", s.dueMonth || "01") || "").padStart(2,"0");
    if (!/^(0[1-9]|1[0-2])$/.test(dueMonth)) return alert("Mês inválido.");
  }

  s.name = name.trim();
  s.value = value;
  s.periodicity = periodicity;
  s.dueMonth = dueMonth;

  saveData(data);
  renderSubscriptionsMaster();
}

function deleteSubscription(id) {
  if (!confirm("Excluir assinatura?")) return;
  const data = loadData();
  data.subscriptions = data.subscriptions.filter(x => x.id !== id);
  saveData(data);
  renderSubscriptionsMaster();
}

function renderSubscriptionsMaster() {
  const data = loadData();
  const el = document.getElementById("subs-master-list");
  if (!el) return;

  if (!data.subscriptions.length) {
    el.innerHTML = "<em>Nenhuma assinatura cadastrada.</em>";
    return;
  }

  el.innerHTML = data.subscriptions.map(s => `
    <div class="row">
      <span>${s.active ? "🟢" : "⚪"} ${s.name} (${s.periodicity}${s.periodicity==="anual" ? " mês "+s.dueMonth : ""})</span>
      <span>${money(s.value)}</span>
    </div>
    <div style="display:flex;gap:0.4rem;margin:0.3rem 0 0.8rem 0">
      <button style="flex:1;background:#555" onclick="toggleSubscriptionActive('${s.id}')">${s.active ? "Desativar" : "Ativar"}</button>
      <button style="flex:1;background:#666" onclick="editSubscription('${s.id}')">Editar</button>
      <button style="flex:1;background:#c0392b" onclick="deleteSubscription('${s.id}')">Excluir</button>
    </div>
  `).join("");
}

function syncSubscriptionsToMonth() {
  const data = loadData();
  const month = document.getElementById("card-month")?.value || ymNow();
  const mm = month.slice(5,7);

  const subs = data.subscriptions.filter(s => s.active);
  subs.forEach(s => {
    const shouldCharge = s.periodicity === "mensal" || (s.periodicity === "anual" && s.dueMonth === mm);
    if (!shouldCharge) return;

    const metaKey = `SUB:${s.id}:${month}`;
    const exists = data.lancamentos.some(l => l.metaKey === metaKey);
    if (exists) return;

    data.lancamentos.push({
      id: uid(),
      conta: "Cartão",
      tipo: "Assinatura",
      categoria: "Cartão",
      subcategoria: "Assinaturas",
      valor: Number(s.value),
      competencia: month,
      descricao: s.name,
      metaKey
    });
  });

  saveData(data);
  renderCartao();
}

function renderCartao() {
  const data = loadData();
  const month = document.getElementById("card-month")?.value || ymNow();

  const items = data.lancamentos.filter(l => l.conta === "Cartão" && l.competencia === month);
  const subs = items.filter(l => l.tipo === "Assinatura");
  const geral = items.filter(l => l.tipo !== "Assinatura");

  const totalSubs = subs.reduce((a,b)=>a+Number(b.valor||0),0);
  const totalGeral = geral.reduce((a,b)=>a+Number(b.valor||0),0);

  const el = document.getElementById("card-list");
  if (!el) return;

  el.innerHTML = `
    <div class="row big"><span>Assinaturas</span><span>${money(totalSubs)}</span></div>
    <div class="row big"><span>Gastos gerais</span><span>${money(totalGeral)}</span></div>
    <hr/>
    <div class="row big"><span>Total fatura</span><span>${money(totalSubs + totalGeral)}</span></div>
    <hr/>
    <h4>Itens</h4>
    ${items.map(l => `<div class="row"><span>${l.descricao || l.subcategoria}</span><span>${money(l.valor)}</span></div>`).join("") || "<em>Sem itens.</em>"}
  `;
}

/* =========================
   INVESTIMENTOS (BB)
========================= */

function renderInvestimentos() {
  const data = loadData();
  const month = document.getElementById("dash-month")?.value || ymNow();

  const bbInvest = data.lancamentos.filter(l =>
    l.conta === "Banco do Brasil" &&
    l.tipo === "Despesa" &&
    l.categoria === "Investimentos" &&
    l.competencia === month
  );

  const bySub = {};
  bbInvest.forEach(l => {
    const k = l.subcategoria || "Investimentos";
    bySub[k] = (bySub[k] || 0) + Number(l.valor || 0);
  });

  const total = bbInvest.reduce((a,b)=>a+Number(b.valor||0),0);

  const el = document.getElementById("invest-view");
  if (!el) return;

  el.innerHTML = `
    <div class="card">
      <div class="row big"><span>Total investido (mês)</span><span>${money(total)}</span></div>
      <hr/>
      ${Object.entries(bySub).sort((a,b)=>b[1]-a[1]).map(([k,v]) => `<div class="row"><span>${k}</span><span>${money(v)}</span></div>`).join("") || "<em>Sem investimentos lançados.</em>"}
    </div>
  `;
}

/* =========================
   EXPORT EXCEL (.xlsx)
========================= */

function exportExcel() {
  const data = loadData();
  const month = document.getElementById("dash-month")?.value || ymNow();
  const L = data.lancamentos.filter(l => l.competencia === month);

  // BRAD
  const rendaBrad = L.filter(l => l.conta==="Bradesco" && l.tipo==="Receita" && l.categoria==="Renda");
  const rendaPorSub = sumRendaPorSubcategoria(rendaBrad);
  const totalDisponivel = RENDA_SUBS.reduce((acc,s)=>acc+(rendaPorSub[s]||0),0);

  const despesasBradBase = L.filter(l => l.conta==="Bradesco" && (l.tipo==="Despesa" || l.tipo==="Transferência"));
  const cardLancs = L.filter(l => l.conta==="Cartão");
  const totalCartao = cardLancs.reduce((a,b)=>a+Number(b.valor||0),0);

  const bradByCat = sumByCategory(despesasBradBase);
  bradByCat["Cartão"] = totalCartao;

  const totalDespesasBrad = despesasBradBase.reduce((a,b)=>a+Number(b.valor||0),0) + totalCartao;
  const resultadoBrad = totalDisponivel - totalDespesasBrad;

  // BB
  const bbEntradas = L.filter(l => l.conta==="Banco do Brasil" && (l.tipo==="Receita" || l.tipo==="Transferência"));
  const bbSaidas = L.filter(l => l.conta==="Banco do Brasil" && l.tipo==="Despesa");
  const bbInvest = bbSaidas.filter(l => l.categoria==="Investimentos");
  const bbGastos = bbSaidas.filter(l => l.categoria!=="Investimentos");

  const totalBbEntradas = bbEntradas.reduce((a,b)=>a+Number(b.valor||0),0);
  const totalBbInvest = bbInvest.reduce((a,b)=>a+Number(b.valor||0),0);
  const totalBbGastos = bbGastos.reduce((a,b)=>a+Number(b.valor||0),0);
  const resultadoBB = totalBbEntradas - (totalBbInvest + totalBbGastos);

  // Cartão
  const subs = cardLancs.filter(l => l.tipo==="Assinatura");
  const geral = cardLancs.filter(l => l.tipo!=="Assinatura");
  const totalSubs = subs.reduce((a,b)=>a+Number(b.valor||0),0);
  const totalGeral = geral.reduce((a,b)=>a+Number(b.valor||0),0);

  const sheet = [];
  sheet.push([`Financeiro — ${month}`]);
  sheet.push([]);
  sheet.push(["BRADESCO", "", "", "BANCO DO BRASIL", "", "", "CARTÃO"]);
  sheet.push([]);
  sheet.push(["RENDA"]);
  RENDA_SUBS.forEach(s => sheet.push([s, rendaPorSub[s] || 0]));
  sheet.push(["TOTAL DISPONÍVEL", totalDisponivel]);
  sheet.push([]);
  sheet.push(["GASTOS"]);
  Object.entries(bradByCat).forEach(([k,v]) => sheet.push([k, v]));
  sheet.push(["TOTAL GASTOS", totalDespesasBrad]);
  sheet.push(["DIFERENÇA DO MÊS", resultadoBrad]);
  sheet.push([]);
  sheet.push(["BB — Entradas", totalBbEntradas]);
  sheet.push(["BB — Gastos", totalBbGastos]);
  sheet.push(["BB — Investimentos", totalBbInvest]);
  sheet.push(["BB — Resultado", resultadoBB]);
  sheet.push([]);
  sheet.push(["CARTÃO — Assinaturas", totalSubs]);
  sheet.push(["CARTÃO — Gerais", totalGeral]);
  sheet.push(["CARTÃO — Total", totalSubs + totalGeral]);

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(sheet);
  XLSX.utils.book_append_sheet(wb, ws, month);

  XLSX.writeFile(wb, `Financeiro_${month}.xlsx`);
}

/* =========================
   BOOT
========================= */

carregarCategorias();
initLancamentoDefaults();