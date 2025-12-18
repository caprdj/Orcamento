/* =========================
   HELPERS
========================= */

function uid(){
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

function ymNow(){
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,"0");
  return `${y}-${m}`;
}



function todayISO(){
  return new Date().toISOString().slice(0,10);
}

function fmtDate(iso){
  if(!iso) return "";
  const s = String(iso).trim();
  // aceita YYYY-MM-DD ou DD/MM/YYYY
  if(/^\d{4}-\d{2}-\d{2}$/.test(s)){
    const [y,m,d] = s.split("-");
    return `${d}/${m}/${y}`;
  }
  if(/^\d{2}\/\d{2}\/\d{4}$/.test(s)) return s;
  return s;
}

function normalizeDateInput(s){
  if(s==null) return null; // cancel
  const v = String(s).trim();
  if(!v) return ""; // allow blank to keep existing
  if(/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  if(/^\d{2}\/\d{2}\/\d{4}$/.test(v)){
    const [d,m,y]=v.split("/");
    return `${y}-${m}-${d}`;
  }
  return "__INVALID__";
}

function money(v){
  const n = Number(v||0);
  return n.toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
}


function accountTagClass(conta){
  if(conta === "Bradesco") return "brad";
  if(conta === "Banco do Brasil") return "bb";
  if(conta === "Cartão") return "tipo";
  return "";
}

function prevMonth(ym){
  const [y,m] = ym.split("-").map(Number);
  const d = new Date(y, m-1, 1);
  d.setMonth(d.getMonth()-1);
  const yy = d.getFullYear();
  const mm = String(d.getMonth()+1).padStart(2,"0");
  return `${yy}-${mm}`;
}

function nextMonth(ym){
  const [y,m] = ym.split("-").map(Number);
  const d = new Date(y, m-1, 1);
  d.setMonth(d.getMonth()+1);
  const yy = d.getFullYear();
  const mm = String(d.getMonth()+1).padStart(2,"0");
  return `${yy}-${mm}`;
}


/* =========================
   INVEST — helpers (proventos / tipo de ativo)
========================= */

function inferInvestMov(l){
  // investMov salva a intenção explícita do lançamento
  if(l && typeof l.investMov === "string" && l.investMov.trim()){
    const mv = l.investMov.trim();
    // compatibilidade com versões antigas
    if(mv === "saida") return "aplic";
    if(mv === "entrada"){
      const desc = String(l?.descricao||"").toLowerCase();
      if(/resgat|retir|saque|venda|liquid|retorno/.test(desc)) return "retir";
      return "rend";
    }
    return mv;
  }
  // Legado: tenta inferir pelo tipo/descrição
  if(l && l.tipo === "Despesa") return "aplic";
  const desc = String(l?.descricao||"").toLowerCase();
  if(/resgat|retir|saque|venda|liquid|retorno/.test(desc)) return "retir";
  return "rend";
}

function classifyInvestAsset(assetName){
  const a = String(assetName||"").trim().toUpperCase();
  if(!a) return "Outros";

  // Poupanças / metas (ex.: "81-Viagem", "Reforma", "Carro", "IPTU")
  if(/VIAGEM|REFORMA|CARRO|IPTU|POUP|POUPAN/.test(a) || /^\d{1,3}-/.test(a)) return "Poupança";

  // FIIs no Brasil normalmente terminam em 11 (BCRO11 etc)
  if(/11$/.test(a)) return "FII";

  // Demais: ações (NTCO3, BBAS3F, etc)
  return "Ação";
}

/* =========================
   CARTÃO — FECHAMENTO DE FATURA
========================= */

function getCardClosings(data){
  if(!data.cardClosings || typeof data.cardClosings !== "object") data.cardClosings = {};
  return data.cardClosings;
}

function getCardClosingInfo(data, month){
  const clos = getCardClosings(data);
  return clos[month] || null;
}

function isCardMonthClosed(month){
  const data = loadData();
  return !!getCardClosingInfo(data, month);
}

function closeCardStatement(){
  const month = document.getElementById("card-month")?.value || ymNow();

  // se já fechou, não duplica
  const data0 = loadData();
  if(getCardClosingInfo(data0, month)){
    alert("Essa fatura já está fechada. Use 'Reabrir fatura' para alterar.");
    return;
  }

  // garante assinaturas do mês ANTES de fechar (sem duplicar)
  ensureSubscriptionsForMonth(month);

  const data = loadData(); // recarrega (pode ter mudado por assinaturas)
  const items = data.lancamentos.filter(l=>l.conta==="Cartão" && l.competencia===month);
  const total = items.reduce((a,b)=>a+Number(b.valor||0),0);

  if(total <= 0){
    const ok = confirm("Não há lançamentos no cartão neste mês. Fechar mesmo assim?");
    if(!ok) return;
  }

  const payAccount = document.getElementById("card-pay-account")?.value || "Bradesco";
  const payMonth = document.getElementById("card-pay-month")?.value || nextMonth(month);
  const payDate = document.getElementById("card-pay-date")?.value || isoFromYMDay(payMonth, 1);

  const paymentId = uid();

  // lançamento do pagamento no banco escolhido (contabiliza como despesa do mês de pagamento)
  data.lancamentos.push({
    id: paymentId,
    conta: payAccount,
    tipo: "Despesa",
    categoria: "Cartão",
    subcategoria: "Fatura",
    investMov: "",
    valor: total,
    competencia: payMonth,
    data: payDate,
    descricao: `Pagamento fatura do cartão (${month})`,
    cardPaymentFor: month
  });

  // registra fechamento (congela o mês do cartão)
  const clos = getCardClosings(data);
  clos[month] = {
    month,
    closedAt: new Date().toISOString(),
    payAccount,
    payMonth,
    payDate,
    total,
    paymentId
  };

  saveData(data);

  alert("Fatura fechada e pagamento lançado!");
  renderCartao();
  renderMes();
}

function reopenCardStatement(){
  const month = document.getElementById("card-month")?.value || ymNow();
  const data = loadData();
  const info = getCardClosingInfo(data, month);

  if(!info){
    alert("Essa fatura não está fechada.");
    return;
  }

  const ok = confirm("Reabrir a fatura deste mês? (O lançamento de pagamento será removido.)");
  if(!ok) return;

  if(info.paymentId){
    data.lancamentos = data.lancamentos.filter(l=>l.id !== info.paymentId);
  }else{
    // fallback: remove qualquer pagamento linkado
    data.lancamentos = data.lancamentos.filter(l=>!(l.cardPaymentFor === month && l.categoria==="Cartão" && l.subcategoria==="Fatura"));
  }

  const clos = getCardClosings(data);
  delete clos[month];

  saveData(data);

  alert("Fatura reaberta.");
  renderCartao();
  renderMes();
}


/* =========================
   STORAGE WRAPPER (storage.js)
========================= */

function loadData(){ return window.StorageAPI.load(); }
function saveData(data){ window.StorageAPI.save(data); }

/* =========================
   CATEGORIES (EDITÁVEIS)
========================= */

function getCats(){
  const data = loadData();
  return data.categories || {};
}
function setCats(newCats){
  const data = loadData();
  data.categories = newCats;
  saveData(data);
}

function renderCatsPreview(){
  const el = document.getElementById("cats-preview");
  if(!el) return;
  const cats = getCats();
  const names = Object.keys(cats);
  el.textContent = names.length ? `Categorias: ${names.join(", ")}` : "Sem categorias.";
}

function fillCategorySelects(){
  const cats = getCats();
  const categoriaSelect = document.getElementById("categoria");
  const subSelect = document.getElementById("subcategoria");
  if(!categoriaSelect || !subSelect) return;

  const currentCat = categoriaSelect.value;
  categoriaSelect.innerHTML = Object.keys(cats).map(c=>`<option>${c}</option>`).join("");
  if(currentCat && cats[currentCat]) categoriaSelect.value = currentCat;

  const cat = categoriaSelect.value;
  const subs = (cats[cat] || []);
  const currentSub = subSelect.value;
  subSelect.innerHTML = subs.map(s=>`<option>${s}</option>`).join("") || `<option>Diversos</option>`;
  if(currentSub && subs.includes(currentSub)) subSelect.value = currentSub;
}

function wireCategoryChange(){
  const categoriaSelect = document.getElementById("categoria");
  const contaSelect = document.getElementById("conta");
  const investMov = document.getElementById("invest-mov");
  if(categoriaSelect){
    categoriaSelect.addEventListener("change", ()=>{
      fillCategorySelects();
      updateLaunchUI();
    });
  }
  if(contaSelect){
    contaSelect.addEventListener("change", ()=>{
      fillCategorySelects();
      updateLaunchUI();
    });
  }
  if(investMov){
    investMov.addEventListener("change", updateLaunchUI);
  }
}

function updateLaunchUI(){
  const conta = document.getElementById("conta")?.value || "";
  const categoria = document.getElementById("categoria")?.value || "";
  const tipoSel = document.getElementById("tipo");
  const wrap = document.getElementById("invest-move-wrap");
  const mov = document.getElementById("invest-mov");

  const isInvest = (conta === "Banco do Brasil" && categoria === "Investimentos");

  if(wrap){
    wrap.style.display = isInvest ? "block" : "none";
  }

  // Em investimentos (modo fluxo), o "Tipo" é derivado do movimento.
  if(tipoSel){
    if(isInvest){
      tipoSel.disabled = true;
      const mv = mov?.value || "aplic";
      if(mv === "rend" || mv === "retir" || mv === "ajuste+") tipoSel.value = "Receita";
      else if(mv === "aplic" || mv === "ajuste-") tipoSel.value = "Despesa";
    }else{
      tipoSel.disabled = false;
    }
  }
}

/* =========================
   UI TABS
========================= */

function setActiveTab(view){
  ["lancar","mes","cartao","invest","mais"].forEach(v=>{
    const btn=document.getElementById(`tab-${v}`);
    if(btn) btn.classList.toggle("active", v===view);
  });
}

function showView(view){
  ["lancar","mes","cartao","invest","mais"].forEach(v=>{
    const el=document.getElementById(`view-${v}`);
    if(el) el.classList.toggle("active", v===view);
  });

  setActiveTab(view);

  if(view==="mes"){
    initMesUI();
    renderMes();
  }

  if(view==="cartao"){
    const cm=document.getElementById("card-month");
    if(cm && !cm.value) cm.value = currentMonth || ymNow();
    if(cm) cm.onchange = ()=> renderCartao();
    renderCartao();
  }

  if(view==="invest"){
    const inv=document.getElementById("invest-month");
    if(inv && !inv.value) inv.value = (currentMonth || ymNow());
    if(inv){
      inv.onchange = ()=> renderInvestimentos();
    }
    renderInvestimentos();
  }

  if(view==="mais"){
    renderCatsPreview();
  }
}

/* =========================
   LANÇAMENTO
========================= */

function salvarLancamento(){
  const data = loadData();

  const conta = document.getElementById("conta")?.value || "Bradesco";
  const tipo = document.getElementById("tipo")?.value || "Despesa";
  const categoria = document.getElementById("categoria")?.value || "Outros gastos";
  const subcategoria = document.getElementById("subcategoria")?.value || "Diversos";
  const valor = Number(document.getElementById("valor")?.value || 0);
  const competencia = document.getElementById("competencia")?.value || ymNow();
  const dataLanc = document.getElementById("data")?.value || todayISO();
  const descricao = document.getElementById("descricao")?.value || "";
  const destinoTrf = document.getElementById("destinoTrf")?.value || "";

  // Investimentos (modo fluxo): deriva o Tipo (Receita/Despesa) a partir do movimento.
  let investMov = "";
  let finalTipo = tipo;

  if(conta === "Banco do Brasil" && categoria === "Investimentos"){
    investMov = document.getElementById("invest-mov")?.value || "aplic";
    // aplic = saída; rend/retir = entrada; ajuste+/- para correções
    if(investMov === "rend" || investMov === "retir" || investMov === "ajuste+") finalTipo = "Receita";
    else finalTipo = "Despesa";
  }

  if(!isFinite(valor) || valor <= 0){
    alert("Informe um valor válido.");
    return;
  }

  // id do lançamento original (para linkar espelhos)
  const originalId = uid();

  data.lancamentos.push({
    id: originalId,
    conta,
    tipo: finalTipo,
    categoria,
    subcategoria,
    investMov,
    valor,
    competencia,
    data: dataLanc,
    descricao
  });

  // Espelho automático: Bradesco -> BB
  if (tipo === "Transferência" && conta === "Bradesco" && destinoTrf === "BB") {
    const espelhoId = uid();
    data.lancamentos.push({
      id: espelhoId,
      conta: "Banco do Brasil",
      tipo: "Transferência",
      categoria: "Outros gastos",   // ✅ não entra em Invest
      subcategoria: "Diversos",
      investMov: "",
      valor,
      competencia,
      data: dataLanc,
      descricao: "Transferência Bradesco → BB",
      linkedId: originalId
    });
  }

  // Espelho automático: BB -> Bradesco
  if (tipo === "Transferência" && conta === "Banco do Brasil" && destinoTrf === "BRAD") {
    const espelhoId = uid();
    data.lancamentos.push({
      id: espelhoId,
      conta: "Bradesco",
      tipo: "Transferência",
      categoria: "Outros gastos",
      subcategoria: "Diversos",
      investMov: "",
      valor,
      competencia,
      data: dataLanc,
      descricao: "Transferência BB → Bradesco",
      linkedId: originalId
    });
  }

  saveData(data);

  document.getElementById("valor").value = "";
  document.getElementById("descricao").value = "";

  renderMes();
  renderCartao();
  renderInvestimentos();
  alert("Salvo!");
}


/* =========================
   MÊS
========================= */

let currentMonth = ymNow();
let currentBank = "Bradesco";
let investYearPref = null; // usado no Invest: "Rendimentos no ano"

function initMesUI(){
  const monthEl = document.getElementById("month");
  if(!monthEl) return;

  const now = new Date();
  const y = now.getFullYear();
  const opts = [];
  for(let yy=y-1; yy<=y+1; yy++){
    for(let mm=1; mm<=12; mm++){
      const v = `${yy}-${String(mm).padStart(2,"0")}`;
      const label = new Date(yy, mm-1, 1).toLocaleDateString("pt-BR",{month:"long",year:"numeric"});
      opts.push({v,label});
    }
  }
  monthEl.innerHTML = opts.map(o=>`<option value="${o.v}">${o.label}</option>`).join("");
  monthEl.value = currentMonth;

  const chip = document.getElementById("chip-month");
  if(chip) chip.textContent = currentMonth;

  monthEl.onchange = ()=>{
    currentMonth = monthEl.value;
    if(chip) chip.textContent = currentMonth;
    renderMes();
  };

  const pillBrad = document.getElementById("pill-brad");
  const pillBB = document.getElementById("pill-bb");

  if(pillBrad){
    pillBrad.onclick = ()=>{
      currentBank = "Bradesco";
      pillBrad.classList.add("active");
      pillBB?.classList.remove("active");
      renderMes();
    };
  }
  if(pillBB){
    pillBB.onclick = ()=>{
      currentBank = "Banco do Brasil";
      pillBB.classList.add("active");
      pillBrad?.classList.remove("active");
      renderMes();
    };
  }
}

function sumByCategory(list){
  const by = {};
  for(const l of list){
    const k = l.categoria || "Outros gastos";
    by[k] = (by[k]||0) + Number(l.valor||0);
  }
  return by;
}

function renderBars(title, entries){
  if(!entries || !entries.length)
    return `<div class="muted">Sem dados.</div>`;

  const max = Math.max(...entries.map(([,v])=>Math.abs(v)), 1);

  return `
    <h4 style="margin:10px 0 6px 0">${title}</h4>
    <div class="bars">
      ${entries.map(([label,val])=>{
        const pct = Math.round((Math.abs(val) / max) * 50);
        const isIn = val >= 0;
        return `
          <div class="bar-row">
            <div class="bar-head">
              <div class="bar-label">${label}</div>
              <div class="bar-value">${money(val)}</div>
            </div>
            <div class="bar-track center">
              <div class="bar-fill ${isIn?"in":"out"}"
                style="
                  width:${pct}%;
                  margin-left:${isIn?50:50-pct}%;
                ">
              </div>
            </div>
          </div>
        `;
      }).join("")}
    </div>
  `;
}


function renderLancList(list){
  return list
    .slice()
    .sort((a,b)=> (a.descricao||"").localeCompare(b.descricao||""))
    .map(l=>`
    <div class="card" style="margin:10px 0; box-shadow:none">
      <div class="tags">
  <span class="tag ${accountTagClass(l.conta)}">${l.conta}</span>
  <span class="tag ${
    l.tipo==="Receita" ? "in" :
    (l.tipo==="Despesa" || l.tipo==="Assinatura") ? "out" : "trf"
  }">${l.tipo}</span>
  <span class="muted" style="font-weight:800">
    ${l.categoria} • ${l.subcategoria}${l.data ? ` • ${fmtDate(l.data)}` : ""}
  </span>
  <span style="margin-left:auto;font-weight:900">
    ${money(l.valor)}
  </span>
</div>

      <div class="muted" style="margin-top:8px">${(l.descricao||"—")}</div>
      <div style="display:flex;justify-content:space-between;margin-top:10px;gap:8px">
        <button class="btn small" onclick="editLancamento('${l.id}')">Editar</button>
        <button class="btn small danger" onclick="deleteLancamento('${l.id}')">Excluir</button>
      </div>
    </div>
  `).join("");
}

function computeSaldoAnterior(conta, month){
  const data = loadData();
  const pm = prevMonth(month);

  const receitas = data.lancamentos.filter(l =>
  l.conta === conta &&
  l.competencia === pm &&
  (l.tipo === "Receita" || (l.tipo === "Transferência" && conta === "Banco do Brasil"))
);

const despesas = data.lancamentos.filter(l =>
  l.conta === conta &&
  l.competencia === pm &&
  (l.tipo === "Despesa" || (l.tipo === "Transferência" && conta === "Bradesco"))
);


  // Cartão não entra aqui; já está isolado na aba Cartão.
  const totalRec = receitas.reduce((a,b)=>a+Number(b.valor||0),0);
  const totalDes = despesas.reduce((a,b)=>a+Number(b.valor||0),0);

  return totalRec - totalDes;
}

function renderMes(){
  const data = loadData();
  const month = currentMonth;

  const dash=document.getElementById("dashboard");
  const listEl=document.getElementById("listagem");
  if(!dash || !listEl) return;

  const conta = currentBank;

  const L = data.lancamentos.filter(l => l.competencia===month);

  // Importante: cartão não mistura com mês
  const LM = L.filter(l => l.conta === conta && l.conta !== "Cartão");

  // Auto saldo anterior (fluxo do mês anterior)
  const saldoAnterior = computeSaldoAnterior(conta, month);

  // Receitas do mês (exceto saldo anterior)
  const receitas = LM.filter(l =>
  l.tipo === "Receita" ||
  (l.tipo === "Transferência" && conta === "Banco do Brasil") // ✅ entra no BB
);
  const totalRec = receitas.reduce((a,b)=>a+Number(b.valor||0),0);

  // Despesas do mês (Despesa/Transferência)
  const despesas = LM.filter(l =>
  l.tipo === "Despesa" ||
  (l.tipo === "Transferência" && conta === "Bradesco") // ✅ sai do Bradesco
);
  const totalDes = despesas.reduce((a,b)=>a+Number(b.valor||0),0);

  const totalDisponivel = saldoAnterior + totalRec - totalDes;

  const byCat = sumByCategory(despesas);
  const bars = Object.entries(byCat).sort((a,b)=>b[1]-a[1]);

  const bankClass = conta==="Bradesco" ? "bank-brad" : "bank-bb";
  const bankLabelClass = conta==="Bradesco" ? "brad-text" : "bb-text";
  const tagClass = conta==="Bradesco" ? "brad" : "bb";

  dash.innerHTML = `
    <div class="bankcard ${bankClass}">
      <div class="row big">
        <span class="${bankLabelClass}">${conta==="Bradesco"?"Bradesco":"BB"}</span>
        <span class="muted">${month}</span>
      </div>

      <div class="row big"><span>Total disponível</span><span>${money(totalDisponivel)}</span></div>

      <div class="bankcard ${bankClass}" style="box-shadow:none;margin-top:10px">
        <div class="row"><span>Saldo anterior</span><span>${money(saldoAnterior)}</span></div>
        ${conta==="Bradesco" ? `
          <div class="row"><span>Salário</span><span>${money(receitas.filter(x=>x.categoria==="Renda" && x.subcategoria==="Salário").reduce((a,b)=>a+Number(b.valor||0),0))}</span></div>
          <div class="row"><span>13°</span><span>${money(receitas.filter(x=>x.categoria==="Renda" && x.subcategoria==="13°").reduce((a,b)=>a+Number(b.valor||0),0))}</span></div>
          <div class="row"><span>Férias</span><span>${money(receitas.filter(x=>x.categoria==="Renda" && x.subcategoria==="Férias").reduce((a,b)=>a+Number(b.valor||0),0))}</span></div>
          <div class="row"><span>Outros</span><span>${money(receitas.filter(x=>!(x.categoria==="Renda" && ["Salário","13°","Férias"].includes(x.subcategoria))).reduce((a,b)=>a+Number(b.valor||0),0))}</span></div>
        ` : `
          <div class="row"><span>Outros</span><span>${money(totalRec)}</span></div>
          <div class="row"><span>Ações</span><span>${money(receitas.filter(x=>x.subcategoria==="Ações").reduce((a,b)=>a+Number(b.valor||0),0))}</span></div>
          <div class="row"><span>FII</span><span>${money(receitas.filter(x=>x.subcategoria==="FII").reduce((a,b)=>a+Number(b.valor||0),0))}</span></div>
          <div class="row"><span>Poupança</span><span>${money(receitas.filter(x=>x.subcategoria==="Poupança").reduce((a,b)=>a+Number(b.valor||0),0))}</span></div>
          <div class="row"><span>Previdência</span><span>${money(receitas.filter(x=>x.subcategoria==="Previdência").reduce((a,b)=>a+Number(b.valor||0),0))}</span></div>
        `}
      </div>

      <div class="row big" style="margin-top:10px"><span>Total gastos</span><span>${money(totalDes)}</span></div>

      <h4 style="margin:10px 0 6px 0">Gastos por categoria (barra)</h4>
      ${renderBars("", bars).replace("<h4", "<div style='display:none'><h4")}
    </div>
  `;

  listEl.innerHTML = `
    <h3 style="margin:0 0 8px 0">Lançamentos (${conta==="Bradesco"?"Bradesco":"BB"})</h3>
    ${LM.length ? renderLancList(LM) : `<div class="muted">Sem lançamentos para este banco/mês.</div>`}
  `;
}

function getInvestSaldoAnterior(month){
  const prev = prevMonth(month);
  if(!prev) return 0;

  const data = StorageAPI.load();
  const list = data.lancamentos.filter(l =>
    l.conta === "Banco do Brasil" &&
    l.categoria === "Investimentos" &&
    l.competencia === prev
  );

  let saldo = 0;
  list.forEach(l=>{
    if(l.tipo === "Despesa") saldo -= Number(l.valor||0);
    else saldo += Number(l.valor||0);
  });

  return saldo;
}


function renderInvestimentos(){
  const data = StorageAPI.load();
  const monthInput = document.getElementById("invest-month");
  const month = monthInput?.value || currentMonth;

  // Filtra somente Investimentos do BB
  const list = data.lancamentos.filter(l =>
    l.conta === "Banco do Brasil" &&
    l.categoria === "Investimentos" &&
    l.competencia === month
  );

  // Entradas e saídas (fluxo)
  const entradas = list.filter(l =>
    l.tipo === "Receita" || l.tipo === "Transferência"
  );
  const saidas = list.filter(l => l.tipo === "Despesa");

  const totalEntradas = entradas.reduce((s,l)=>s+Number(l.valor||0),0);
  const totalSaidas   = saidas.reduce((s,l)=>s+Number(l.valor||0),0);

  // Saldo anterior (Invest)
  const saldoAnterior = getInvestSaldoAnterior(month);
  const saldoFinal = saldoAnterior + totalEntradas - totalSaidas;

  // Agrupar por subcategoria
  const porSub = {};
  list.forEach(l=>{
    const sub = l.subcategoria || "Outros";
    if(!porSub[sub]) porSub[sub] = 0;
    if(l.tipo === "Despesa") porSub[sub] -= Number(l.valor||0);
    else porSub[sub] += Number(l.valor||0);
  });

  const bars = Object.entries(porSub)
    .sort((a,b)=>Math.abs(b[1]) - Math.abs(a[1]));

  // ===== Rendimentos por ativo (ano) =====
  const allInv = data.lancamentos.filter(l =>
    l.conta === "Banco do Brasil" && l.categoria === "Investimentos"
  );
  const yearsSet = new Set();
  allInv.forEach(l=>{
    const y = String(l.competencia||"").slice(0,4);
    if(/^\d{4}$/.test(y)) yearsSet.add(y);
  });
  const years = Array.from(yearsSet).sort((a,b)=>Number(b)-Number(a));
  let selectedYear = investYearPref && years.includes(investYearPref) ? investYearPref : String(month).slice(0,4);
  if(!years.includes(selectedYear) && years.length) selectedYear = years[0];
  const yearOptions = (years.length ? years : [selectedYear]).map(y=>
    `<option value="${y}" ${y===selectedYear?"selected":""}>${y}</option>`
  ).join("");

  const invYear = allInv.filter(l => String(l.competencia||"").startsWith(selectedYear));
  const rendByAsset = {};
  invYear.forEach(l=>{
    const mov = inferInvestMov(l);
    if(mov !== "rend") return;
    const asset = (l.subcategoria || "Outros").trim() || "Outros";
    rendByAsset[asset] = (rendByAsset[asset]||0) + Number(l.valor||0);
  });
  const rendEntries = Object.entries(rendByAsset)
    .filter(([,v])=>Number(v) !== 0)
    .sort((a,b)=>Number(b[1]) - Number(a[1]));

  const totalsByType = { "Poupança":0, "FII":0, "Ação":0, "Outros":0 };
  rendEntries.forEach(([asset,val])=>{
    const t = classifyInvestAsset(asset);
    totalsByType[t] = (totalsByType[t]||0) + Number(val||0);
  });
  const totalRendAno = Object.values(totalsByType).reduce((s,v)=>s+Number(v||0),0);
  const tagsRendAno = Object.entries(totalsByType)
    .filter(([,v])=>Math.abs(Number(v||0)) > 0.00001)
    .map(([t,v])=>`<span class="tag tipo">${t}: ${money(v)}</span>`)
    .join("");


  const el = document.getElementById("invest-view");
  if(!el) return;

  el.innerHTML = `
    <div class="row big"><span>Saldo anterior</span><span>${money(saldoAnterior)}</span></div>
    <div class="row big"><span>Entradas</span><span>${money(totalEntradas)}</span></div>
    <div class="row big"><span>Saídas</span><span>${money(totalSaidas)}</span></div>
    <div class="row big"><span>Saldo final</span><span>${money(saldoFinal)}</span></div>
    <hr/>
    ${renderBars("Movimento por tipo", bars)}
    <hr/>
    <h4 style="margin:10px 0 6px 0">Lançamentos</h4>
    ${list.length
  ? renderLancList(
      list.slice().sort((a,b)=>Number(b.id)-Number(a.id))
    )
  : `<div class="muted">Sem lançamentos de investimento neste mês.</div>`
}

  `;

  const yearSel = document.getElementById("invest-year");
  if(yearSel){
    yearSel.addEventListener("change", ()=>{
      investYearPref = yearSel.value;
      renderInvestimentos();
    });
  }

}


/* =========================
   CARTÃO (gastos + assinaturas)
========================= */

function fillCategorySelectsFor(catId, subId, defaultCat, defaultSub){
  const cats = getCats();
  const catEl = document.getElementById(catId);
  const subEl = document.getElementById(subId);
  if(!catEl || !subEl) return;

  const catNames = Object.keys(cats);
  if(!catNames.length){
    catEl.innerHTML = `<option>Outros gastos</option>`;
    subEl.innerHTML = `<option>Diversos</option>`;
    return;
  }

  const prevCat = catEl.value;
  catEl.innerHTML = catNames.map(c=>`<option>${c}</option>`).join("");

  const pickedCat =
    (prevCat && cats[prevCat]) ? prevCat :
    (defaultCat && cats[defaultCat]) ? defaultCat :
    catNames[0];

  catEl.value = pickedCat;

  const subs = cats[pickedCat] || [];
  const prevSub = subEl.value;
  subEl.innerHTML = subs.map(s=>`<option>${s}</option>`).join("") || `<option>Diversos</option>`;

  if(prevSub && subs.includes(prevSub)) subEl.value = prevSub;
  else if(defaultSub && subs.includes(defaultSub)) subEl.value = defaultSub;
}

function wireCardCategoryChange(){
  const catEl = document.getElementById("card-categoria");
  if(catEl){
    catEl.addEventListener("change", ()=>{
      fillCategorySelectsFor("card-categoria","card-subcategoria","Cartão","Compras");
    });
  }
}

function salvarCartaoGasto(){
  const data = loadData();

  const month = document.getElementById("card-month")?.value || ymNow();
  if(isCardMonthClosed(month)){
    alert("Esta fatura já está fechada. Use 'Reabrir fatura' para adicionar/alterar lançamentos.");
    return;
  }
  const valor = Number(document.getElementById("card-valor")?.value || 0);
  if(!isFinite(valor) || valor<=0){
    alert("Informe um valor válido.");
    return;
  }

  const categoria = document.getElementById("card-categoria")?.value || "Cartão";
  const subcategoria = document.getElementById("card-subcategoria")?.value || "Compras";
  const dataLanc = document.getElementById("card-date")?.value || todayISO();
  const descricao = document.getElementById("card-descricao")?.value || "";

  data.lancamentos.push({
    id: uid(),
    conta: "Cartão",
    tipo: "Despesa",
    categoria,
    subcategoria,
    investMov: "",
    valor,
    competencia: month,
    data: dataLanc,
    descricao
  });

  saveData(data);

  const v = document.getElementById("card-valor");
  const d = document.getElementById("card-descricao");
  if(v) v.value = "";
  if(d) d.value = "";

  renderCartao();
  alert("Gasto do cartão salvo!");
}

function daysInMonthYM(ym){
  const [y,m] = ym.split("-").map(Number);
  return new Date(y, m, 0).getDate();
}

function isoFromYMDay(ym, day){
  const [y,m] = ym.split("-");
  const max = daysInMonthYM(ym);
  const d = Math.min(Math.max(1, Number(day||1)), max);
  return `${y}-${m}-${String(d).padStart(2,"0")}`;
}

function shouldChargeSubscription(sub, month){
  const start = sub.startMonth || "0000-00";
  if(month < start) return false;

  const freq = (sub.frequency || "mensal").toLowerCase();
  if(freq === "anual"){
    // cobra todo ano no mesmo mês do startMonth
    return month.slice(5,7) === start.slice(5,7);
  }
  return true; // mensal
}

function subscriptionChargeExists(data, sub, month){
  return data.lancamentos.some(l =>
    l.conta === "Cartão" &&
    l.tipo === "Assinatura" &&
    l.competencia === month &&
    (
      l.subscriptionId === sub.id ||
      (!l.subscriptionId &&
        String(l.descricao||"").trim().toLowerCase() === String(sub.name||"").trim().toLowerCase() &&
        Number(l.valor||0) === Number(sub.valor||0)
      )
    )
  );
}

function createSubscriptionCharge(data, sub, month){
  data.lancamentos.push({
    id: uid(),
    conta: "Cartão",
    tipo: "Assinatura",
    categoria: sub.categoria || "Cartão",
    subcategoria: sub.subcategoria || "Assinaturas",
    investMov: "",
    valor: Number(sub.valor||0),
    competencia: month,
    data: isoFromYMDay(month, sub.dueDay || 1),
    descricao: sub.name || "Assinatura",
    subscriptionId: sub.id
  });
}

function ensureSubscriptionsForMonth(month){
  const data = loadData();
  // Se a fatura já está fechada, não lança assinaturas automaticamente.
  if(getCardClosingInfo(data, month)) return false;
  data.subscriptions = Array.isArray(data.subscriptions) ? data.subscriptions : [];

  let changed = false;

  for(const sub of data.subscriptions){
    if(!sub || !sub.id) continue;
    if(sub.active === false) continue;
    if(!shouldChargeSubscription(sub, month)) continue;

    if(subscriptionChargeExists(data, sub, month)) continue;

    createSubscriptionCharge(data, sub, month);
    changed = true;
  }

  if(changed) saveData(data);
  return changed;
}

function addSubscription(){
  const data = loadData();
  data.subscriptions = Array.isArray(data.subscriptions) ? data.subscriptions : [];

  const name = prompt("Nome da assinatura (ex.: Netflix):", "");
  if(!name) return;

  const valor = Number(prompt("Valor (R$):", "0") || 0);
  if(!isFinite(valor) || valor <= 0){
    alert("Valor inválido.");
    return;
  }

  let frequency = prompt("Frequência: mensal ou anual?", "mensal");
  if(frequency === null) return;
  frequency = String(frequency).trim().toLowerCase();
  if(!["mensal","anual"].includes(frequency)){
    alert("Use 'mensal' ou 'anual'.");
    return;
  }

  const defaultStart = document.getElementById("card-month")?.value || ymNow();
  const startMonth = prompt("Mês de início (YYYY-MM):", defaultStart);
  if(startMonth === null) return;
  if(!/^\d{4}-\d{2}$/.test(String(startMonth).trim())){
    alert("Mês inválido. Use YYYY-MM.");
    return;
  }

  const dueDayRaw = prompt("Dia de cobrança (1 a 31):", "1");
  if(dueDayRaw === null) return;
  const dueDay = Math.min(Math.max(1, Number(dueDayRaw||1)), 31);

  data.subscriptions.push({
    id: uid(),
    name: name.trim(),
    valor,
    frequency,
    startMonth: String(startMonth).trim(),
    dueDay,
    active: true,
    categoria: "Cartão",
    subcategoria: "Assinaturas"
  });

  saveData(data);

  // lança no mês atual (se fizer sentido)
  const month = document.getElementById("card-month")?.value || ymNow();
  ensureSubscriptionsForMonth(month);

  renderCartao();
}

function toggleSubscription(id){
  const data = loadData();
  data.subscriptions = Array.isArray(data.subscriptions) ? data.subscriptions : [];
  const sub = data.subscriptions.find(s=>s.id===id);
  if(!sub) return;

  const isActive = (sub.active !== false);
  sub.active = !isActive;

  saveData(data);
  renderCartao();
}

function editSubscription(id){
  const data = loadData();
  data.subscriptions = Array.isArray(data.subscriptions) ? data.subscriptions : [];
  const sub = data.subscriptions.find(s=>s.id===id);
  if(!sub) return;

  const name = prompt("Nome:", sub.name || "");
  if(name === null) return;
  if(!String(name).trim()){
    alert("Nome não pode ficar vazio.");
    return;
  }

  const valor = Number(prompt("Valor (R$):", String(sub.valor||0)) ?? sub.valor);
  if(!isFinite(valor) || valor <= 0){
    alert("Valor inválido.");
    return;
  }

  let frequency = prompt("Frequência: mensal ou anual?", sub.frequency || "mensal");
  if(frequency === null) return;
  frequency = String(frequency).trim().toLowerCase();
  if(!["mensal","anual"].includes(frequency)){
    alert("Use 'mensal' ou 'anual'.");
    return;
  }

  const startMonth = prompt("Mês de início (YYYY-MM):", sub.startMonth || ymNow());
  if(startMonth === null) return;
  if(!/^\d{4}-\d{2}$/.test(String(startMonth).trim())){
    alert("Mês inválido. Use YYYY-MM.");
    return;
  }

  const dueDayRaw = prompt("Dia de cobrança (1 a 31):", String(sub.dueDay || 1));
  if(dueDayRaw === null) return;
  const dueDay = Math.min(Math.max(1, Number(dueDayRaw||1)), 31);

  sub.name = String(name).trim();
  sub.valor = valor;
  sub.frequency = frequency;
  sub.startMonth = String(startMonth).trim();
  sub.dueDay = dueDay;

  saveData(data);

  // garante o lançamento do mês atual (sem duplicar)
  const month = document.getElementById("card-month")?.value || ymNow();
  ensureSubscriptionsForMonth(month);

  renderCartao();
}

function deleteSubscription(id){
  if(!confirm("Excluir cadastro desta assinatura? (Os lançamentos já feitos continuarão no extrato.)")) return;

  const data = loadData();
  data.subscriptions = Array.isArray(data.subscriptions) ? data.subscriptions : [];
  data.subscriptions = data.subscriptions.filter(s=>s.id!==id);
  saveData(data);

  renderCartao();
}

function forceLaunchSubscription(id){
  const month = document.getElementById("card-month")?.value || ymNow();
  if(isCardMonthClosed(month)){
    alert("Esta fatura já está fechada. Reabra a fatura para lançar novas assinaturas.");
    return;
  }
  const data = loadData();
  data.subscriptions = Array.isArray(data.subscriptions) ? data.subscriptions : [];

  const sub = data.subscriptions.find(s=>s.id===id);
  if(!sub) return;

  if(subscriptionChargeExists(data, sub, month)){
    alert("Essa assinatura já está lançada neste mês.");
    return;
  }

  if(!shouldChargeSubscription(sub, month)){
    const ok = confirm("Esta assinatura não está programada para este mês (freq/anual). Lançar mesmo assim?");
    if(!ok) return;
  }

  createSubscriptionCharge(data, sub, month);
  saveData(data);

  renderCartao();
}

function renderSubscriptions(month){
  const data = loadData();
  const el = document.getElementById("subs-list");
  if(!el) return;

  const subs = Array.isArray(data.subscriptions) ? data.subscriptions : [];
  if(!subs.length){
    el.innerHTML = `<div class="muted">Nenhuma assinatura cadastrada ainda. Use <b>+ Cadastrar assinatura</b>.</div>`;
    return;
  }

  const cards = subs
    .slice()
    .sort((a,b)=> String(a.name||"").localeCompare(String(b.name||"")))
    .map(sub=>{
      const active = sub.active !== false;
      const freq = (sub.frequency||"mensal").toLowerCase();
      const freqLabel = freq === "anual" ? "Anual" : "Mensal";
      const hasCharge = subscriptionChargeExists(data, sub, month);

      return `
        <div class="card" style="margin:10px 0; box-shadow:none">
          <div class="tags">
            <span class="tag ${active ? "tipo" : ""}">${active ? "Ativa" : "Pausada"}</span>
            <span class="tag">${freqLabel}</span>
            <span class="muted" style="font-weight:800">${sub.startMonth || "—"} • dia ${sub.dueDay || 1}</span>
            <span style="margin-left:auto;font-weight:900">${money(sub.valor||0)}</span>
          </div>

          <div class="muted" style="margin-top:8px">${sub.name || "—"}</div>
          <div class="muted" style="margin-top:6px">${hasCharge ? "✅ Lançada neste mês" : "⚠️ Ainda não lançada"}</div>

          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">
            <button class="btn small" type="button" onclick="editSubscription('${sub.id}')">Editar</button>
            <button class="btn small" type="button" onclick="toggleSubscription('${sub.id}')">${active ? "Desativar" : "Ativar"}</button>
            <button class="btn small" type="button" onclick="forceLaunchSubscription('${sub.id}')">Lançar neste mês</button>
            <button class="btn small danger" type="button" onclick="deleteSubscription('${sub.id}')">Excluir</button>
          </div>
        </div>
      `;
    }).join("");

  el.innerHTML = cards;
}

function renderCartao(){
  const month = document.getElementById("card-month")?.value || ymNow();

  // prepara selects/inputs do formulário (se existirem)
  fillCategorySelectsFor("card-categoria","card-subcategoria","Cartão","Compras");
  const cd = document.getElementById("card-date");
  if(cd && !cd.value) cd.value = todayISO();

  // defaults do fechamento
  const payAccountEl = document.getElementById("card-pay-account");
  const payMonthEl   = document.getElementById("card-pay-month");
  const payDateEl    = document.getElementById("card-pay-date");

  if(payAccountEl && !payAccountEl.value) payAccountEl.value = "Bradesco";

  if(payMonthEl){
    const desired = nextMonth(month);
    if(!payMonthEl.value || payMonthEl.dataset.base !== month){
      payMonthEl.value = desired;
      payMonthEl.dataset.base = month;
    }
    if(!payMonthEl.dataset.wired){
      payMonthEl.addEventListener("change", ()=>{
        if(payDateEl && !payDateEl.value && payMonthEl.value){
          payDateEl.value = isoFromYMDay(payMonthEl.value, 1);
        }
      });
      payMonthEl.dataset.wired = "1";
    }
  }

  if(payDateEl && !payDateEl.value){
    const pm = payMonthEl?.value || nextMonth(month);
    payDateEl.value = isoFromYMDay(pm, 1);
  }

  // lança assinaturas do mês (sem duplicar) SOMENTE se a fatura estiver aberta
  const pre = loadData();
  const preClosing = getCardClosingInfo(pre, month);
  if(!preClosing){
    ensureSubscriptionsForMonth(month);
  }

  const data = loadData();
  const closing = getCardClosingInfo(data, month);

  // UI do fechamento
  const statusEl = document.getElementById("card-close-status");
  const btnClose = document.getElementById("btnCloseCard");
  const btnReopen = document.getElementById("btnReopenCard");

  if(statusEl){
    if(closing){
      let dtLabel = "—";
      try{
        if(closing.closedAt) dtLabel = new Date(closing.closedAt).toLocaleString("pt-BR");
      }catch(e){}
      statusEl.innerHTML =
        `✅ Fatura fechada em <b>${dtLabel}</b><br>` +
        `Pagamento: <b>${closing.payMonth || "—"}</b> • ${closing.payAccount || "—"} • ${money(closing.total || 0)}`;
    }else{
      statusEl.innerHTML =
        `Fatura aberta. Ao fechar, o app cria um lançamento de pagamento no mês escolhido.`;
    }
  }

  if(btnClose) btnClose.style.display = closing ? "none" : "";
  if(btnReopen) btnReopen.style.display = closing ? "" : "none";

  // desabilita inputs do fechamento quando fechado
  [payAccountEl, payMonthEl, payDateEl].forEach(el=>{
    if(el) el.disabled = !!closing;
  });

  // congela adição/edição de lançamentos do cartão quando fechado
  const disableCardEntry = !!closing;
  ["card-date","card-categoria","card-subcategoria","card-valor","card-descricao"].forEach(id=>{
    const el = document.getElementById(id);
    if(el) el.disabled = disableCardEntry;
  });
  const btnSaveCard = document.getElementById("btn-card-save");
  if(btnSaveCard) btnSaveCard.disabled = disableCardEntry;

  const btnAddSub = document.getElementById("btn-add-sub");
  if(btnAddSub) btnAddSub.disabled = disableCardEntry;

  // renderiza painel de assinaturas
  renderSubscriptions(month);

  const items = data.lancamentos.filter(l=>l.conta==="Cartão" && l.competencia===month);
  const subs = items.filter(l=>l.tipo==="Assinatura");
  const geral = items.filter(l=>l.tipo!=="Assinatura");

  const totalSubs = subs.reduce((a,b)=>a+Number(b.valor||0),0);
  const totalGeral = geral.reduce((a,b)=>a+Number(b.valor||0),0);

  const el = document.getElementById("card-list");
  if(!el) return;

  el.innerHTML = `
    <div class="row big"><span>Assinaturas</span><span>${money(totalSubs)}</span></div>
    <div class="row big"><span>Gastos gerais</span><span>${money(totalGeral)}</span></div>
    <div class="row big"><span>Total do cartão</span><span>${money(totalSubs+totalGeral)}</span></div>
    <hr/>
    <h4 style="margin:10px 0 6px 0">Extrato do cartão (mês)</h4>
    ${items.length ? renderLancList(items) : `<div class="muted">Sem lançamentos de cartão neste mês.</div>`}
  `;
}



/* =========================
   EDIT / DELETE
========================= */

function editLancamento(id){
  const data = loadData();
  const l = data.lancamentos.find(x=>x.id===id);
  if(!l) return;

  // congela lançamentos do cartão quando a fatura do mês estiver fechada
  if(l.conta === "Cartão" && isCardMonthClosed(l.competencia)){
    alert("Esta fatura já está fechada. Use 'Reabrir fatura' para editar lançamentos do cartão.");
    return;
  }


  const dtRaw = prompt("Data (AAAA-MM-DD ou DD/MM/AAAA):", l.data || "");
  const dt = normalizeDateInput(dtRaw);
  if(dt === null) return; // cancel
  if(dt === "__INVALID__") return alert("Data inválida. Use AAAA-MM-DD ou DD/MM/AAAA.");
  if(dt) l.data = dt;

  const valor = Number(prompt("Valor:", String(l.valor)) ?? l.valor);
  if(!isFinite(valor) || valor<=0) return alert("Valor inválido.");

  const desc = prompt("Descrição:", l.descricao||"") ?? (l.descricao||"");

    const cats = getCats();

  // trava conta/categoria quando for Investimentos
  let cat = l.categoria;
  let sub = l.subcategoria;

  if (l.categoria !== "Investimentos") {
    cat = prompt("Categoria:", l.categoria) ?? l.categoria;
    if (!cats[cat]) return alert("Categoria não existe. Ajuste em 'Mais' > Gerenciar.");

    sub = prompt("Subcategoria:", l.subcategoria) ?? l.subcategoria;
  }

  l.valor = valor;
  l.descricao = desc.trim();
  l.categoria = cat;
  l.subcategoria = sub;

  // Se for investimento (BB + categoria Investimentos), permite ajustar o "Movimento"
  if(l.conta === "Banco do Brasil" && l.categoria === "Investimentos"){
    const currentMov = inferInvestMov(l);
    const mvInput = prompt(
      'Movimento (aplic=r$ sai, rend=provento, retir=resgate/venda, ajuste+/ajuste-):',
      currentMov
    );
    if(mvInput !== null && String(mvInput).trim() !== ""){
      let mv = String(mvInput).trim().toLowerCase();
      if(mv === "entrada") mv = "rend";
      if(mv === "saida") mv = "aplic";
      // aceita apenas valores conhecidos; senão mantém o atual
      if(["aplic","rend","retir","ajuste+","ajuste-"].includes(mv)){
        l.investMov = mv;
      }
    }
    // Mantém o tipo coerente com o movimento
    const mvFinal = inferInvestMov(l);
    l.tipo = (mvFinal === "aplic" || mvFinal === "ajuste-") ? "Despesa" : "Receita";
  }


  l.valor = valor;
  l.descricao = desc.trim();
  l.categoria = cat;
  l.subcategoria = sub;

  saveData(data);
  renderMes();
  renderCartao();
  renderInvestimentos();
}

function deleteLancamento(id){
  if(!confirm("Excluir lançamento?")) return;
  const data = loadData();
  const l = data.lancamentos.find(x=>x.id===id);
  if(l && l.conta === "Cartão" && isCardMonthClosed(l.competencia)){
    alert("Esta fatura já está fechada. Use 'Reabrir fatura' para excluir lançamentos do cartão.");
    return;
  }
  data.lancamentos = data.lancamentos.filter(x=>x.id!==id);
  saveData(data);
  renderMes();
  renderCartao();
  renderInvestimentos();
}

/* =========================
   EXPORT (XLSX)
========================= */

function exportExcel(){
  if(!window.XLSX){
    alert("Exportação indisponível: biblioteca XLSX não carregou. (Cache do Pages?)");
    return;
  }
  const data = loadData();
  const month = currentMonth || ymNow();
  const rows = data.lancamentos
    .filter(l=>l.competencia===month)
    .map(l=>({
      conta:l.conta,
      tipo:l.tipo,
      categoria:l.categoria,
      subcategoria:l.subcategoria,
      valor:l.valor,
      competencia:l.competencia,
      data:l.data||"",
      descricao:l.descricao||""
    }));

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Lancamentos");
  XLSX.writeFile(wb, `financeiro_${month}.xlsx`);
}

/* =========================
   CATS MANAGER (simple)
========================= */

function openCats(){
  const cats = getCats();
  const text = prompt(
    "Edite como JSON (categoria: [sub1, sub2...])",
    JSON.stringify(cats, null, 2)
  );
  if(!text) return;
  try{
    const obj = JSON.parse(text);
    setCats(obj);
    fillCategorySelects();
    renderCatsPreview();
    alert("Categorias atualizadas!");
  }catch(e){
    alert("JSON inválido.");
  }
}

/* =========================
   INIT
========================= */

(function(){
  const data = loadData();
  if(!data.categories || !Object.keys(data.categories).length){
    setCats({
      "Renda":["Saldo anterior","Salário","13°","Férias","Outros"],
      "Habitação":["Condomínio","Prestação","Diária/Diária","IPTU","Luz","Gás","Manutenção","Decor/Eletro","Outros"],
      "Saúde":["Plano","Farmácia","Consulta","Exames/Labs","Outros"],
      "Alimentação":["Mercado","Restaurantes","Cafeterias","Outros"],
      "Transporte":["Uber/Taxi","Passagem/Transfer","RioCard","Outros"],
      "Cursos":["Cursos","Outros"],
      "Pessoal":["Vestuário","Procedimento","Salão","Outros"],
      "Lazer":["Viagem","Cinema/Teatro","Livros","Passeios","Outros"],
      "Cartão":["Assinaturas","Compras","Outros"],
      "Outros gastos":["Diversos"],
      "Investimentos":["Ações","FII","Poupança","Previdência","Outros"]
    });
  }

  // Defaults
  currentMonth = ymNow();
  const comp = document.getElementById("competencia");
  if(comp && !comp.value) comp.value = currentMonth;

  const dateEl = document.getElementById("data");
  if(dateEl && !dateEl.value) dateEl.value = todayISO();

  const chip=document.getElementById("chip-month");
  if(chip) chip.textContent=currentMonth;

  fillCategorySelects();
  wireCategoryChange();
  wireCardCategoryChange();
  updateLaunchUI();
  renderCatsPreview();
})();