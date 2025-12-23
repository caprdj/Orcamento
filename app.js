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

function money(v){
  return Number(v||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
}

function prevMonth(ym){
  const [y,m]=ym.split("-").map(Number);
  const d=new Date(y,m-1,1);
  d.setMonth(d.getMonth()-1);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
}

/* =========================
   STORAGE
========================= */

function loadData(){ return window.StorageAPI.load(); }
function saveData(d){ window.StorageAPI.save(d); }

/* =========================
   SALDO ANTERIOR (FIX DEFINITIVO)
========================= */

function computeSaldoAnterior(conta, month){
  const data = loadData();
  const pm = prevMonth(month);

  const list = data.lancamentos.filter(l =>
    l.conta === conta &&
    l.competencia === pm &&
    l.conta !== "Cartão" &&
    !(l.tipo==="Receita" && l.categoria==="Renda" && l.subcategoria==="Saldo anterior")
  );

  const receitas = list.filter(l =>
    l.tipo==="Receita" ||
    (l.tipo==="Transferência" && conta==="Banco do Brasil")
  );

  const despesas = list.filter(l =>
    l.tipo==="Despesa" ||
    (l.tipo==="Transferência" && conta==="Bradesco")
  );

  return receitas.reduce((a,b)=>a+Number(b.valor||0),0)
       - despesas.reduce((a,b)=>a+Number(b.valor||0),0);
}

/* =========================
   MÊS
========================= */

let currentMonth = ymNow();
let currentBank = "Bradesco";

function renderMes(){
  const data = loadData();
  const month = currentMonth;
  const conta = currentBank;

  const dash = document.getElementById("dashboard");
  const listEl = document.getElementById("listagem");
  if(!dash || !listEl) return;

  const LM = data.lancamentos.filter(l =>
    l.competencia===month &&
    l.conta===conta &&
    l.conta!=="Cartão"
  );

  const saldoAnteriorLancado = LM
    .filter(l=>l.tipo==="Receita" && l.categoria==="Renda" && l.subcategoria==="Saldo anterior")
    .reduce((a,b)=>a+Number(b.valor||0),0);

  const saldoAnteriorAuto = computeSaldoAnterior(conta, month);

  // REGRA FINAL
  const saldoAnterior = saldoAnteriorLancado>0
    ? saldoAnteriorLancado
    : saldoAnteriorAuto;

  const receitas = LM.filter(l =>
    (
      l.tipo==="Receita" ||
      (l.tipo==="Transferência" && conta==="Banco do Brasil")
    ) &&
    !(l.categoria==="Renda" && l.subcategoria==="Saldo anterior")
  );

  const despesas = LM.filter(l =>
    l.tipo==="Despesa" ||
    (l.tipo==="Transferência" && conta==="Bradesco")
  );

  const totalRec = receitas.reduce((a,b)=>a+Number(b.valor||0),0);
  const totalDes = despesas.reduce((a,b)=>a+Number(b.valor||0),0);
  const totalDisponivel = saldoAnterior + totalRec - totalDes;

  dash.innerHTML = `
    <div class="row big"><span>${conta}</span><span>${month}</span></div>
    <div class="row big"><span>Saldo anterior</span><span>${money(saldoAnterior)}</span></div>
    <div class="row big"><span>Receitas</span><span>${money(totalRec)}</span></div>
    <div class="row big"><span>Despesas</span><span>${money(totalDes)}</span></div>
    <div class="row big"><b>Total disponível</b><b>${money(totalDisponivel)}</b></div>
  `;

  listEl.innerHTML = LM.length
    ? LM.map(l=>`<div class="row"><span>${l.descricao||""}</span><span>${money(l.valor)}</span></div>`).join("")
    : `<div class="muted">Sem lançamentos</div>`;
}

/* =========================
   INIT
========================= */

(function(){
  const comp = document.getElementById("competencia");
  if(comp) comp.value = currentMonth;
  renderMes();
})();
