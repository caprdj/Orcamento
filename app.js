const RENDA_SUBS = ["Saldo anterior", "Salário", "13º", "Férias", "Outros"];

const categorias = {
  "Renda": ["Saldo anterior", "Salário", "13º", "Férias", "Outros"],

  "Habitação": ["Condomínio", "Prestação", "Luz", "Gás", "Outros"],
  "Saúde": ["Plano", "Farmácia", "Consultas", "Outros"],
  "Alimentação": ["Mercado", "Restaurante", "Cafeteria", "Outros"],
  "Transporte": ["Uber", "Rio Card", "Outros"],
  "Cursos": ["Curso principal", "Outros"],
  "Pessoal": ["Vestuário", "Salão", "Outros"],
  "Lazer": ["Viagem", "Livros", "Passeios", "Outros"],
  "Cartão": ["Assinaturas", "Compras"],
  "Outros gastos": ["Diversos"],
  "Investimentos": ["Ações", "FII", "Poupança", "Previdência"]
};

const categoriaSelect = document.getElementById("categoria");
const subcategoriaSelect = document.getElementById("subcategoria");

function carregarCategorias() {
  categoriaSelect.innerHTML = "";
  Object.keys(categorias).forEach(cat => {
    const opt = document.createElement("option");
    opt.textContent = cat;
    categoriaSelect.appendChild(opt);
  });
  atualizarSubcategorias();
}

function atualizarSubcategorias() {
  const cat = categoriaSelect.value;
  subcategoriaSelect.innerHTML = "";
  categorias[cat].forEach(sub => {
    const opt = document.createElement("option");
    opt.textContent = sub;
    subcategoriaSelect.appendChild(opt);
  });
}

categoriaSelect.addEventListener("change", atualizarSubcategorias);

function salvarLancamento() {
  const dataStore = loadData();

  dataStore.lancamentos.push({
  id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random(),
  valor: Number(document.getElementById("valor").value),
  conta: document.getElementById("conta").value,
  tipo: document.getElementById("tipo").value,
  categoria: categoriaSelect.value,
  subcategoria: subcategoriaSelect.value,
  data: document.getElementById("data").value,
  competencia: document.getElementById("competencia").value,
  descricao: document.getElementById("descricao").value
});

  saveData(dataStore);
  alert("Lançamento salvo!");
}

carregarCategorias();

function showView(view) {
  const views = ["launch", "mes", "cartao", "investimentos", "mais"];

  views.forEach(v => {
    const el = document.getElementById(`view-${v}`);
    if (el) el.classList.add("hidden");
  });

  const active = document.getElementById(`view-${view}`);
  if (active) active.classList.remove("hidden");

  if (view === "mes") {
  const dashMonthEl = document.getElementById("dash-month");
  if (view === "cartao") {
  initCartaoUI();
  renderCartao();
}
  if (dashMonthEl && !dashMonthEl.value) dashMonthEl.value = ymNow();

  renderDashboardRefinado();

  // Re-render quando trocar o mês
  dashMonthEl.onchange = () => renderDashboardRefinado();
}
}

function renderDashboard() {
  const data = loadData();
  const mesAtual = document.getElementById("competencia")?.value || new Date().toISOString().slice(0,7);

  const brad = {};
  const bb = {};

  data.lancamentos
    .filter(l => l.competencia === mesAtual)
    .forEach(l => {
      const alvo = l.conta === "Banco do Brasil" ? bb : brad;
      if (!alvo[l.categoria]) alvo[l.categoria] = 0;
      alvo[l.categoria] += l.valor;
    });

  renderTotais("brad-totais", brad);
  renderTotais("bb-totais", bb);

  renderBarras("brad-barras", brad);
  renderBarras("bb-barras", bb);
}

function renderTotais(containerId, dados) {
  const el = document.getElementById(containerId);
  el.innerHTML = "";

  Object.entries(dados).forEach(([cat, val]) => {
    const p = document.createElement("p");
    p.textContent = `${cat}: R$ ${val.toFixed(2)}`;
    el.appendChild(p);
  });
}

function renderBarras(containerId, dados) {
  const el = document.getElementById(containerId);
  el.innerHTML = "";

  const max = Math.max(...Object.values(dados), 1);

  Object.entries(dados).forEach(([cat, val]) => {
    const bar = document.createElement("div");
    bar.className = "bar";

    bar.innerHTML = `
      <div class="bar-label">${cat} — R$ ${val.toFixed(2)}</div>
      <div class="bar-track">
        <div class="bar-fill" style="width:${(val/max)*100}%"></div>
      </div>
    `;

    el.appendChild(bar);
  });
}
function money(n) {
  const v = Number(n || 0);
  return "R$ " + v.toFixed(2);
}

function ymNow() {
  return new Date().toISOString().slice(0, 7);
}

function isBrad(l) {
  return l.conta === "Bradesco";
}

function isBB(l) {
  return l.conta === "Banco do Brasil";
}

function isCard(l) {
  return l.conta === "Cartão";
}

function sumByCategory(list) {
  const out = {};
  for (const l of list) {
    const k = l.categoria || "Sem categoria";
    out[k] = (out[k] || 0) + Number(l.valor || 0);
  }
  return out;
}

function renderDashboardRefinado() {
  const data = loadData();
  const dashMonthEl = document.getElementById("dash-month");
  const month = dashMonthEl?.value || ymNow();

  // Filtra por competência
  const L = (data.lancamentos || []).filter(l => l.competencia === month);

 // ===== BRADESCO (vida mensal) =====

// Renda BRAD: Receita + Categoria = Renda
const bradRendaLancs = L.filter(l =>
  isBrad(l) &&
  l.tipo === "Receita" &&
  l.categoria === "Renda"
);

// Soma renda por subcategoria (fixas)
const rendaPorSub = sumRendaPorSubcategoria(bradRendaLancs);

// Total disponível do mês
const totalDisponivel =
  rendaPorSub["Saldo anterior"] +
  rendaPorSub["Salário"] +
  rendaPorSub["13º"] +
  rendaPorSub["Férias"] +
  rendaPorSub["Outros"];

// Despesas BRAD (saídas): Despesa + Transferência
const bradDespesasBase = L.filter(l =>
  isBrad(l) && (l.tipo === "Despesa" || l.tipo === "Transferência")
);

// Cartão (fatura do mês)
const cardLancs = L.filter(isCard);
const totalCartao = cardLancs.reduce((a, b) => a + Number(b.valor || 0), 0);

// Total despesas BRAD
const totalDespesasBradSemCartao =
  bradDespesasBase.reduce((a,b)=>a+Number(b.valor||0),0);

const totalDespesasBrad =
  totalDespesasBradSemCartao + totalCartao;

// Gastos BRAD por categoria (inclui cartão como bloco)
const bradByCat = sumByCategory(bradDespesasBase);
bradByCat["Cartão"] =
  (bradByCat["Cartão"] || 0) + totalCartao;

// Resultado do mês
const resultadoBrad = totalDisponivel - totalDespesasBrad;

// Render BRAD (novo, baseado em Renda)
renderCardBradRenda(
  month,
  rendaPorSub,
  totalDisponivel,
  bradByCat,
  totalDespesasBrad,
  resultadoBrad
);

  // ===== BANCO DO BRASIL (entradas/saídas) =====
  // Entradas BB: tipo = Receita OU Transferência (entrada do BRAD) OU Dividendo (se você usar tipo "Receita")
  const bbEntradas = L.filter(l => isBB(l) && (l.tipo === "Receita" || l.tipo === "Transferência"));

  // Saídas BB: tipo = Despesa
  const bbSaidas = L.filter(l => isBB(l) && l.tipo === "Despesa");

  // Dentro das saídas BB, separar investimentos (categoria Investimentos) vs gastos
  const bbSaidasInvest = bbSaidas.filter(l => l.categoria === "Investimentos");
  const bbSaidasGastos = bbSaidas.filter(l => l.categoria !== "Investimentos");

  const totalBbEntradas = bbEntradas.reduce((a, b) => a + Number(b.valor || 0), 0);
  const totalBbInvest = bbSaidasInvest.reduce((a, b) => a + Number(b.valor || 0), 0);
  const totalBbGastos = bbSaidasGastos.reduce((a, b) => a + Number(b.valor || 0), 0);
  const totalBbSaidas = totalBbInvest + totalBbGastos;

  const resultadoBB = totalBbEntradas - totalBbSaidas;

  // Barras BB separadas
  const bbByCatGastos = sumByCategory(bbSaidasGastos);
  const bbByCatInvest = sumByCategory(bbSaidasInvest); // tende a ser só "Investimentos" (com subcategoria), mas ok.

  renderCardBB(month, totalBbEntradas, totalBbGastos, totalBbInvest, resultadoBB, bbByCatGastos, bbByCatInvest);

  // ===== Gráficos (barras) =====
  renderBarras("brad-barras", bradByCat);
  renderBarras("bb-barras-gastos", bbByCatGastos, "Gastos BB");
  renderBarras("bb-barras-invest", bbByCatInvest, "Investimentos BB");
}

function renderCardBrad(month, bradReceitas, totalReceitasBrad, totalDespesasBrad, totalCartao, bradByCat, resultadoBrad) {
  const rendaEl = document.getElementById("brad-renda");
  const gastosEl = document.getElementById("brad-gastos");
  const resEl = document.getElementById("brad-resultado");

  // Aqui a gente não “adivinha” o que é salário/saldo anterior/outros recebidos sem uma regra.
  // Por enquanto: mostramos Receita total e lista de receitas do mês (você nomeia na descrição).
  rendaEl.innerHTML = `
    <div class="card">
      <div class="row"><span>Receitas do mês</span><span>${money(totalReceitasBrad)}</span></div>
      <div class="sep"></div>
      ${bradReceitas.slice(0, 6).map(r => `<div class="row"><span>${(r.descricao||"Receita").slice(0,22)}</span><span>${money(r.valor)}</span></div>`).join("")}
      ${bradReceitas.length > 6 ? `<div class="row"><span>…</span><span></span></div>` : ""}
    </div>
  `;

  // Gastos por categoria (inclui cartão como bloco)
  const gastosOrdenados = Object.entries(bradByCat).sort((a,b)=>b[1]-a[1]);

  gastosEl.innerHTML = `
    <div class="card">
      <div class="row"><span>Cartão (fatura)</span><span>${money(totalCartao)}</span></div>
      <div class="sep"></div>
      ${gastosOrdenados.map(([k,v]) => `<div class="row"><span>${k}</span><span>${money(v)}</span></div>`).join("")}
      <div class="sep"></div>
      <div class="row big"><span>Total gastos</span><span>${money(totalDespesasBrad)}</span></div>
    </div>
  `;

  resEl.innerHTML = `
    <div class="card">
      <div class="row big"><span>Diferença do mês</span><span>${money(resultadoBrad)}</span></div>
      <div class="row"><span>Competência</span><span>${month}</span></div>
    </div>
  `;
}

function renderCardBB(month, totalEntradas, totalGastos, totalInvest, resultado, bbByCatGastos, bbByCatInvest) {
  const entEl = document.getElementById("bb-entradas");
  const saiEl = document.getElementById("bb-saidas");
  const resEl = document.getElementById("bb-resultado");

  entEl.innerHTML = `
    <div class="card">
      <div class="row big"><span>Entradas</span><span>${money(totalEntradas)}</span></div>
      <div class="row"><span>Competência</span><span>${month}</span></div>
    </div>
  `;

  saiEl.innerHTML = `
    <div class="card">
      <div class="row"><span>Gastos (BB)</span><span>${money(totalGastos)}</span></div>
      <div class="row"><span>Investimentos</span><span>${money(totalInvest)}</span></div>
      <div class="sep"></div>
      <div class="row big"><span>Total saídas</span><span>${money(totalGastos + totalInvest)}</span></div>
    </div>
  `;

  resEl.innerHTML = `
    <div class="card">
      <div class="row big"><span>Resultado BB</span><span>${money(resultado)}</span></div>
    </div>
  `;
}

// Reusa sua função de barras (com um título opcional)
function renderBarras(containerId, dados, titulo) {
  const el = document.getElementById(containerId);
  if (!el) return;

  el.innerHTML = "";

  const entries = Object.entries(dados || {}).sort((a,b)=>b[1]-a[1]);
  if (!entries.length) {
    el.innerHTML = `<div class="card"><em>Sem dados.</em></div>`;
    return;
  }

  const max = Math.max(...entries.map(e => e[1]), 1);

  if (titulo) {
    const h = document.createElement("div");
    h.className = "card";
    h.innerHTML = `<strong>${titulo}</strong>`;
    el.appendChild(h);
  }

  entries.forEach(([cat, val]) => {
    const bar = document.createElement("div");
    bar.className = "bar";

    bar.innerHTML = `
      <div class="bar-label">${cat} — ${money(val)}</div>
      <div class="bar-track">
        <div class="bar-fill" style="width:${(val/max)*100}%"></div>
      </div>
    `;
    el.appendChild(bar);
  });
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

function renderCardBradRenda(month, rendaPorSub, totalDisponivel, bradByCat, totalDespesasBrad, resultadoBrad) {
  const rendaEl = document.getElementById("brad-renda");
  const gastosEl = document.getElementById("brad-gastos");
  const resEl = document.getElementById("brad-resultado");

  // ===== Renda (5 linhas fixas) =====
  rendaEl.innerHTML = `
    <div class="card">
      <div class="row"><span>Saldo anterior</span><span>${money(rendaPorSub["Saldo anterior"])}</span></div>
      <div class="row"><span>Salário</span><span>${money(rendaPorSub["Salário"])}</span></div>
      <div class="row"><span>13º</span><span>${money(rendaPorSub["13º"])}</span></div>
      <div class="row"><span>Férias</span><span>${money(rendaPorSub["Férias"])}</span></div>
      <div class="row"><span>Outros</span><span>${money(rendaPorSub["Outros"])}</span></div>
      <div class="sep"></div>
      <div class="row big"><span>Total disponível</span><span>${money(totalDisponivel)}</span></div>
      <div class="row"><span>Competência</span><span>${month}</span></div>
    </div>
  `;

  // ===== Gastos BRAD =====
  const gastosOrdenados = Object.entries(bradByCat).sort((a,b)=>b[1]-a[1]);
  gastosEl.innerHTML = `
    <div class="card">
      ${gastosOrdenados.map(([k,v]) => `
        <div class="row"><span>${k}</span><span>${money(v)}</span></div>
      `).join("")}
      <div class="sep"></div>
      <div class="row big"><span>Total gastos</span><span>${money(totalDespesasBrad)}</span></div>
    </div>
  `;

  // ===== Resultado =====
  resEl.innerHTML = `
    <div class="card">
      <div class="row big"><span>Diferença do mês</span><span>${money(resultadoBrad)}</span></div>
    </div>
  `;
}

/* =========================
   CARTÃO — TELA COMPLETA
========================= */

function ymNow() {
  return new Date().toISOString().slice(0, 7);
}

function fmt(n) {
  const v = Number(n || 0);
  return "R$ " + v.toFixed(2);
}

function getCardMonth() {
  const el = document.getElementById("card-month");
  if (!el.value) el.value = ymNow();
  return el.value;
}

function isCard(l) {
  return l.conta === "Cartão";
}

function ensureId(obj) {
  if (!obj.id) obj.id = (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random());
  return obj.id;
}

/* ===== Assinaturas (cadastro) =====
subscription = {
  id, name, value, periodicity: "mensal"|"anual",
  dueMonth: "01".."12" (só se anual),
  active: true/false
}
*/

function addSubscription() {
  const data = loadData();

  const name = prompt("Nome da assinatura (ex.: Amazon Prime):");
  if (!name) return;

  const valueStr = prompt("Valor (ex.: 19.90):");
  const value = Number(valueStr);
  if (!isFinite(value) || value <= 0) return alert("Valor inválido.");

  const periodicity = (prompt("Periodicidade: mensal ou anual?", "mensal") || "mensal").toLowerCase();
  if (periodicity !== "mensal" && periodicity !== "anual") return alert("Use: mensal ou anual.");

  let dueMonth = null;
  if (periodicity === "anual") {
    dueMonth = (prompt("Mês de cobrança (01 a 12):", "01") || "").padStart(2, "0");
    if (!/^(0[1-9]|1[0-2])$/.test(dueMonth)) return alert("Mês inválido.");
  }

  data.subscriptions.push({
    id: ensureId({}),
    name: name.trim(),
    value,
    periodicity,
    dueMonth,
    active: true
  });

  saveData(data);
  renderCartao();
}

function toggleSubscriptionActive(subId) {
  const data = loadData();
  const s = data.subscriptions.find(x => x.id === subId);
  if (!s) return;
  s.active = !s.active;
  saveData(data);
  renderCartao();
}

function editSubscription(subId) {
  const data = loadData();
  const s = data.subscriptions.find(x => x.id === subId);
  if (!s) return;

  const name = prompt("Nome:", s.name) ?? s.name;
  const valueStr = prompt("Valor:", String(s.value)) ?? String(s.value);
  const value = Number(valueStr);

  if (!name.trim() || !isFinite(value) || value <= 0) return alert("Dados inválidos.");

  let periodicity = prompt("Periodicidade: mensal ou anual?", s.periodicity) ?? s.periodicity;
  periodicity = periodicity.toLowerCase();
  if (periodicity !== "mensal" && periodicity !== "anual") return alert("Use: mensal ou anual.");

  let dueMonth = s.dueMonth;
  if (periodicity === "anual") {
    dueMonth = (prompt("Mês de cobrança (01 a 12):", s.dueMonth || "01") || "").padStart(2, "0");
    if (!/^(0[1-9]|1[0-2])$/.test(dueMonth)) return alert("Mês inválido.");
  } else {
    dueMonth = null;
  }

  s.name = name.trim();
  s.value = value;
  s.periodicity = periodicity;
  s.dueMonth = dueMonth;

  saveData(data);
  renderCartao();
}

function deleteSubscription(subId) {
  const ok = confirm("Excluir assinatura? (o histórico do cartão não será apagado)");
  if (!ok) return;

  const data = loadData();
  data.subscriptions = data.subscriptions.filter(x => x.id !== subId);
  saveData(data);
  renderCartao();
}

/* ===== Gerar cobranças do mês (a partir do cadastro) =====
Cria lançamentos em conta=Cartão, tipo=Assinatura, categoria=Cartão, subcategoria=Assinaturas.
Não duplica: usa "metaKey" determinística.
*/
function syncSubscriptionsToMonth() {
  const data = loadData();
  const month = getCardMonth(); // "YYYY-MM"
  const mm = month.slice(5, 7);

  const activeSubs = data.subscriptions.filter(s => s.active);

  activeSubs.forEach(s => {
    const shouldCharge =
      s.periodicity === "mensal" ||
      (s.periodicity === "anual" && s.dueMonth === mm);

    if (!shouldCharge) return;

    const metaKey = `SUB:${s.id}:${month}`;

    const exists = data.lancamentos.some(l =>
      l.competencia === month &&
      l.conta === "Cartão" &&
      l.tipo === "Assinatura" &&
      l.metaKey === metaKey
    );

    if (exists) return;

    data.lancamentos.push({
      id: ensureId({}),
      conta: "Cartão",
      tipo: "Assinatura",
      categoria: "Cartão",
      subcategoria: "Assinaturas",
      valor: Number(s.value),
      data: month + "-01",
      competencia: month,
      descricao: s.name,
      metaKey
    });
  });

  saveData(data);
  renderCartao();
}

/* ===== Compras gerais (atalho na tela do cartão) ===== */
function addCardBuy() {
  const data = loadData();
  const month = getCardMonth();

  const desc = prompt("Descrição (ex.: Amazon, Compra online, etc.):");
  if (!desc) return;

  const valueStr = prompt("Valor (ex.: 120.50):");
  const value = Number(valueStr);
  if (!isFinite(value) || value <= 0) return alert("Valor inválido.");

  data.lancamentos.push({
    id: ensureId({}),
    conta: "Cartão",
    tipo: "Compra geral",
    categoria: "Cartão",
    subcategoria: "Compras",
    valor: value,
    data: month + "-01",
    competencia: month,
    descricao: desc.trim()
  });

  saveData(data);
  renderCartao();
}

function deleteLancamentoById(id) {
  const ok = confirm("Excluir lançamento?");
  if (!ok) return;
  const data = loadData();
  data.lancamentos = data.lancamentos.filter(l => l.id !== id);
  saveData(data);
  renderCartao();
}

function editLancamentoValorDescricao(id) {
  const data = loadData();
  const l = data.lancamentos.find(x => x.id === id);
  if (!l) return;

  const desc = prompt("Descrição:", l.descricao || "") ?? (l.descricao || "");
  const valStr = prompt("Valor:", String(l.valor)) ?? String(l.valor);
  const val = Number(valStr);
  if (!isFinite(val) || val <= 0) return alert("Valor inválido.");

  l.descricao = desc.trim();
  l.valor = val;

  saveData(data);
  renderCartao();
}

/* ===== Render da Tela Cartão ===== */
function renderCartao() {
  const data = loadData();
  const month = getCardMonth();

  const all = (data.lancamentos || []).filter(l => isCard(l) && l.competencia === month);

  const subs = all.filter(l => l.tipo === "Assinatura");
  const buys = all.filter(l => l.tipo !== "Assinatura"); // Compra geral (e qualquer outra)

  const totalSubs = subs.reduce((a,b)=>a+Number(b.valor||0),0);
  const totalBuys = buys.reduce((a,b)=>a+Number(b.valor||0),0);
  const total = totalSubs + totalBuys;

  const totaisEl = document.getElementById("card-totais");
  if (totaisEl) {
    totaisEl.innerHTML = `
      <div class="row"><span>Assinaturas</span><span>${fmt(totalSubs)}</span></div>
      <div class="row"><span>Gastos gerais</span><span>${fmt(totalBuys)}</span></div>
      <div class="sep"></div>
      <div class="row big"><span>Total fatura</span><span>${fmt(total)}</span></div>
    `;
  }

  // Lista de assinaturas (lançamentos do mês)
  const subsListEl = document.getElementById("card-subs-list");
  if (subsListEl) {
    subsListEl.innerHTML = subs.length
      ? subs.map(l => `
          <div class="row">
            <span>${(l.descricao||"Assinatura").slice(0,24)}</span>
            <span>${fmt(l.valor)}</span>
          </div>
          <div style="display:flex;gap:0.5rem;margin:0.3rem 0 0.8rem 0">
            <button style="flex:1;background:#444" onclick="editLancamentoValorDescricao('${l.id}')">Editar</button>
            <button style="flex:1;background:#b91c1c" onclick="deleteLancamentoById('${l.id}')">Excluir</button>
          </div>
        `).join("")
      : `<em>Sem cobranças geradas neste mês.</em>`;
  }

  // Lista de compras gerais
  const buysListEl = document.getElementById("card-buys-list");
  if (buysListEl) {
    buysListEl.innerHTML = buys.length
      ? buys.map(l => `
          <div class="row">
            <span>${(l.descricao||"Compra").slice(0,24)}</span>
            <span>${fmt(l.valor)}</span>
          </div>
          <div style="display:flex;gap:0.5rem;margin:0.3rem 0 0.8rem 0">
            <button style="flex:1;background:#444" onclick="editLancamentoValorDescricao('${l.id}')">Editar</button>
            <button style="flex:1;background:#b91c1c" onclick="deleteLancamentoById('${l.id}')">Excluir</button>
          </div>
        `).join("")
      : `<em>Sem compras gerais neste mês.</em>`;
  }

  // Gráfico (barras) — Assinaturas vs Gerais
  const barras = { "Assinaturas": totalSubs, "Gastos gerais": totalBuys };
  renderBarras("card-barras", barras);
  renderSubscriptionsMaster();
}

/* ===== Inicialização da tela do cartão ===== */
function initCartaoUI() {
  const monthEl = document.getElementById("card-month");
  if (monthEl && !monthEl.value) monthEl.value = ymNow();

  const btnAddSub = document.getElementById("btn-add-sub");
  const btnSync = document.getElementById("btn-sync-subs");
  const btnAddBuy = document.getElementById("btn-add-card-buy");

  if (btnAddSub) btnAddSub.addEventListener("click", addSubscription);
  if (btnSync) btnSync.addEventListener("click", syncSubscriptionsToMonth);
  if (btnAddBuy) btnAddBuy.addEventListener("click", addCardBuy);

  if (monthEl) monthEl.addEventListener("change", renderCartao);
}

/* ===== Cadastro de Assinaturas (lista mestre) ===== */
function renderSubscriptionsMaster() {
  const data = loadData();
  const listEl = document.getElementById("subs-master-list");
  if (!listEl) return;

  if (!data.subscriptions.length) {
    listEl.innerHTML = `<em>Nenhuma assinatura cadastrada.</em>`;
    return;
  }

  listEl.innerHTML = data.subscriptions.map(s => `
    <div class="row">
      <span>
        ${s.active ? "🟢" : "⚪"} ${s.name}
        <small>(${s.periodicity}${s.periodicity === "anual" ? " — mês " + s.dueMonth : ""})</small>
      </span>
      <span>${fmt(s.value)}</span>
    </div>
    <div style="display:flex;gap:0.4rem;margin:0.3rem 0 0.8rem 0">
      <button style="flex:1;background:#444" onclick="toggleSubscriptionActive('${s.id}')">
        ${s.active ? "Desativar" : "Ativar"}
      </button>
      <button style="flex:1;background:#555" onclick="editSubscription('${s.id}')">Editar</button>
      <button style="flex:1;background:#b91c1c" onclick="deleteSubscription('${s.id}')">Excluir</button>
    </div>
  `).join("");
}

/* =========================
   EXPORTAÇÃO EXCEL (.xlsx)
========================= */

function exportExcel() {
  const data = loadData();

  const month =
    document.getElementById("dash-month")?.value ||
    document.getElementById("card-month")?.value ||
    ymNow();

  const L = (data.lancamentos || []).filter(l => l.competencia === month);

  // ===== BRADESCO =====
  const rendaBrad = L.filter(l =>
    l.conta === "Bradesco" &&
    l.tipo === "Receita" &&
    l.categoria === "Renda"
  );

  const rendaPorSub = sumRendaPorSubcategoria(rendaBrad);
  const totalDisponivel =
    rendaPorSub["Saldo anterior"] +
    rendaPorSub["Salário"] +
    rendaPorSub["13º"] +
    rendaPorSub["Férias"] +
    rendaPorSub["Outros"];

  const despesasBradBase = L.filter(l =>
    l.conta === "Bradesco" &&
    (l.tipo === "Despesa" || l.tipo === "Transferência")
  );

  const cardLancs = L.filter(l => l.conta === "Cartão");
  const totalCartao = cardLancs.reduce((a, b) => a + Number(b.valor || 0), 0);

  const bradByCat = sumByCategory(despesasBradBase);
  bradByCat["Cartão"] = totalCartao;

  const totalDespesasBrad =
    despesasBradBase.reduce((a,b)=>a+Number(b.valor||0),0) + totalCartao;

  const resultadoBrad = totalDisponivel - totalDespesasBrad;

  // ===== BANCO DO BRASIL =====
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

  // ===== CARTÃO =====
  const subs = cardLancs.filter(l => l.tipo === "Assinatura");
  const buys = cardLancs.filter(l => l.tipo !== "Assinatura");

  const totalSubs = subs.reduce((a,b)=>a+Number(b.valor||0),0);
  const totalBuys = buys.reduce((a,b)=>a+Number(b.valor||0),0);
  const totalFatura = totalSubs + totalBuys;

  // ===== MONTA A PLANILHA (layout em colunas) =====
  // Colunas: A-B (BRAD) | C separador | D-E (BB) | F separador | G-H (Cartão)
  const aoa = [];
  const r = (arr) => aoa.push(arr);

  r([`Financeiro — ${month}`, "", "", "", "", "", "", ""]);
  r(["", "", "", "", "", "", "", ""]);

  // Cabeçalhos (linha 3)
  r(["BRADESCO", "", "", "BANCO DO BRASIL", "", "", "CARTÃO", ""]);
  r(["", "", "", "", "", "", "", ""]);

  // ===== BRAD: RENDA =====
  r(["RENDA", "", "", "ENTRADAS", "", "", "ASSINATURAS", ""]);
  r(["Saldo anterior", rendaPorSub["Saldo anterior"], "", "Entradas", totalBbEntradas, "", "Assinaturas", totalSubs]);
  r(["Salário",        rendaPorSub["Salário"],        "", "Gastos (BB)", totalBbGastos, "", "Gastos gerais", totalBuys]);
  r(["13º",            rendaPorSub["13º"],            "", "Investimentos", totalBbInvest, "", "Total fatura", totalFatura]);
  r(["Férias",         rendaPorSub["Férias"],         "", "Resultado BB", resultadoBB, "", "", ""]);
  r(["Outros",         rendaPorSub["Outros"],         "", "", "", "", "", ""]);
  r(["TOTAL DISPONÍVEL", totalDisponivel, "", "", "", "", "", ""]);
  r(["", "", "", "", "", "", "", ""]);

  // ===== BRAD: GASTOS =====
  r(["GASTOS (por categoria)", "", "", "", "", "", "", ""]);

  // lista de gastos BRAD ordenada
  const bradCats = Object.entries(bradByCat).sort((a,b)=>b[1]-a[1]);
  bradCats.forEach(([k,v]) => r([k, v, "", "", "", "", "", ""]));

  r(["TOTAL GASTOS", totalDespesasBrad, "", "", "", "", "", ""]);
  r(["DIFERENÇA DO MÊS", resultadoBrad, "", "", "", "", "", ""]);

  // ===== XLSX =====
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(aoa);

  // Larguras de coluna
  ws["!cols"] = [
    { wch: 26 }, // A
    { wch: 14 }, // B
    { wch: 3  }, // C (separador)
    { wch: 22 }, // D
    { wch: 14 }, // E
    { wch: 3  }, // F
    { wch: 18 }, // G
    { wch: 14 }  // H
  ];

  // Mesclagens (merge) para títulos
  ws["!merges"] = [
    // Título grande na linha 1 (A1:H1)
    { s: { r: 0, c: 0 }, e: { r: 0, c: 7 } },

    // Cabeçalhos BRAD/BB/CARTÃO na linha 3
    { s: { r: 2, c: 0 }, e: { r: 2, c: 1 } }, // A3:B3
    { s: { r: 2, c: 3 }, e: { r: 2, c: 4 } }, // D3:E3
    { s: { r: 2, c: 6 }, e: { r: 2, c: 7 } }, // G3:H3

    // Sub-cabeçalhos (RENDA / ENTRADAS / ASSINATURAS) linha 5
    { s: { r: 4, c: 0 }, e: { r: 4, c: 1 } }, // A5:B5
    { s: { r: 4, c: 3 }, e: { r: 4, c: 4 } }, // D5:E5
    { s: { r: 4, c: 6 }, e: { r: 4, c: 7 } }  // G5:H5
  ];

  // Formato moeda nas colunas de valores (B, E, H)
  applyCurrencyFormat(ws, aoa.length, [1, 4, 7]);

  XLSX.utils.book_append_sheet(wb, ws, month);
  XLSX.writeFile(wb, `Financeiro_${month}.xlsx`);
}

/* ===== Helper: aplica formato moeda a colunas específicas ===== */
function applyCurrencyFormat(ws, totalRows, valueCols) {
  // Formato: R$ 1.234,56 (o Excel ajusta conforme localidade)
  const moneyFmt = '"R$" #,##0.00';

  for (let r = 0; r < totalRows; r++) {
    for (const c of valueCols) {
      const addr = XLSX.utils.encode_cell({ r, c });
      const cell = ws[addr];
      if (!cell) continue;

      // Só aplica se for número
      if (typeof cell.v === "number") {
        cell.z = moneyFmt;
      }
    }
  }
}