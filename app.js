/* =========================
   STATE + HELPERS
========================= */

let currentMonth = ymNow();
let currentBank = "Bradesco"; // alterna via pill

function ymNow(){ return new Date().toISOString().slice(0,7); }
function money(n){ const v=Number(n||0); return "R$ "+v.toFixed(2); }
function uid(){ return (crypto.randomUUID ? crypto.randomUUID() : String(Date.now())+Math.random()); }

function sumByCategory(list){
  const out={};
  for(const l of list){
    const k=l.categoria || "Sem categoria";
    out[k]=(out[k]||0)+Number(l.valor||0);
  }
  return out;
}

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

  const curCat = categoriaSelect.value;

  categoriaSelect.innerHTML = "";
  Object.keys(cats).forEach(cat=>{
    const opt=document.createElement("option");
    opt.value=cat; opt.textContent=cat;
    categoriaSelect.appendChild(opt);
  });

  // tenta manter seleção anterior
  if(curCat && cats[curCat]) categoriaSelect.value = curCat;

  subSelect.innerHTML = "";
  const selectedCat = categoriaSelect.value;
  (cats[selectedCat] || ["Outros"]).forEach(sub=>{
    const opt=document.createElement("option");
    opt.value=sub; opt.textContent=sub;
    subSelect.appendChild(opt);
  });
}

function wireCategoryChange(){
  const categoriaSelect = document.getElementById("categoria");
  if(!categoriaSelect) return;
  categoriaSelect.addEventListener("change", ()=> fillCategorySelects());
}

/* ===== Manager simples via prompts (rápido e robusto) ===== */
function openCatsManager(){
  const cats = structuredClone(getCats());

  const action = prompt(
`Categorias:
- Digite: addcat | delcat | renomearcat | addsub | delsub | renomearsub
- Ou: sair`,
"sair"
  );
  if(!action || action==="sair") return;

  if(action==="addcat"){
    const name = prompt("Nome da nova categoria:");
    if(!name) return;
    cats[name]=cats[name]||["Outros"];
  }

  if(action==="delcat"){
    const name = prompt("Qual categoria excluir?");
    if(!name || !cats[name]) return alert("Categoria não existe.");
    delete cats[name];
  }

  if(action==="renomearcat"){
    const oldName = prompt("Categoria atual:");
    if(!oldName || !cats[oldName]) return alert("Categoria não existe.");
    const newName = prompt("Novo nome:");
    if(!newName) return;
    cats[newName]=cats[oldName];
    delete cats[oldName];
  }

  if(action==="addsub"){
    const cat = prompt("Em qual categoria?");
    if(!cat || !cats[cat]) return alert("Categoria não existe.");
    const sub = prompt("Nome da nova subcategoria:");
    if(!sub) return;
    cats[cat].push(sub);
  }

  if(action==="delsub"){
    const cat = prompt("Em qual categoria?");
    if(!cat || !cats[cat]) return alert("Categoria não existe.");
    const sub = prompt("Qual subcategoria excluir?");
    if(!sub) return;
    cats[cat]=cats[cat].filter(s=>s!==sub);
  }

  if(action==="renomearsub"){
    const cat = prompt("Em qual categoria?");
    if(!cat || !cats[cat]) return alert("Categoria não existe.");
    const oldSub = prompt("Subcategoria atual:");
    if(!oldSub) return;
    const newSub = prompt("Novo nome:");
    if(!newSub) return;
    cats[cat]=cats[cat].map(s=>s===oldSub?newSub:s);
  }

  setCats(cats);
  fillCategorySelects();
  renderCatsPreview();
  alert("Categorias atualizadas!");
}

/* =========================
   NAV
========================= */

function setActiveTab(view){
  ["lancar","mes","cartao","invest","mais"].forEach(v=>{
    const b=document.getElementById(`tab-${v}`);
    if(b) b.classList.toggle("active", v===view);
  });
}

function showView(view){
  ["lancar","mes","cartao","invest","mais"].forEach(v=>{
    const el=document.getElementById(`view-${v}`);
    if(el) el.classList.toggle("active", v===view);
  });
  setActiveTab(view);

  if(view==="mes"){ initMesUI(); renderMes(); }
  if(view==="cartao"){ initCartaoUI(); renderCartao(); renderSubscriptionsMaster(); }
  if(view==="invest"){ renderInvestimentos(); }
  if(view==="mais"){ renderCatsPreview(); }
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
  const descricao = document.getElementById("descricao")?.value || "";

  if(!isFinite(valor) || valor<=0){ alert("Informe um valor válido."); return; }

  data.lancamentos.push({
    id: uid(),
    conta, tipo, categoria, subcategoria,
    valor, competencia,
    descricao
  });

  saveData(data);

  document.getElementById("valor").value="";
  document.getElementById("descricao").value="";

  alert("Salvo!");
}

/* =========================
   MÊS (PÍLULAS + LISTA EDITÁVEL)
========================= */

function initMesUI(){
  const monthEl = document.getElementById("dash-month");
  if(monthEl && !monthEl.value) monthEl.value = ymNow();
  currentMonth = monthEl?.value || ymNow();

  const chip = document.getElementById("chip-month");
  if(chip) chip.textContent = currentMonth;

  if(monthEl){
    monthEl.onchange = ()=>{
      currentMonth = monthEl.value;
      if(chip) chip.textContent = currentMonth;
      renderMes();
    };
  }

  const pillBrad = document.getElementById("pill-brad");
  const pillBB = document.getElementById("pill-bb");
  if(pillBrad && pillBB){
    pillBrad.onclick = ()=>{
      currentBank="Bradesco";
      pillBrad.classList.add("active"); pillBB.classList.remove("active");
      renderMes();
    };
    pillBB.onclick = ()=>{
      currentBank="Banco do Brasil";
      pillBB.classList.add("active"); pillBrad.classList.remove("active");
      renderMes();
    };
  }
}

function renderMes(){
  const data = loadData();
  const L = data.lancamentos.filter(l=>l.competencia===currentMonth);

  // Resumo depende do banco selecionado
  const dashEl = document.getElementById("dashboard");
  const listEl = document.getElementById("listagem");
  if(!dashEl || !listEl) return;

  if(currentBank==="Bradesco"){
    // Renda
    const renda = L.filter(l=>l.conta==="Bradesco" && l.tipo==="Receita" && l.categoria==="Renda");
    const rendaPorSub = {
      "Saldo anterior":0,"Salário":0,"13º":0,"Férias":0,"Outros":0
    };
    renda.forEach(l=>{
      const k=l.subcategoria || "Outros";
      rendaPorSub[k]=(rendaPorSub[k]||0)+Number(l.valor||0);
    });
    const totalDisponivel = Object.values(rendaPorSub).reduce((a,b)=>a+b,0);

    const base = L.filter(l=>l.conta==="Bradesco" && (l.tipo==="Despesa"||l.tipo==="Transferência"));
    const card = L.filter(l=>l.conta==="Cartão");
    const totalCartao = card.reduce((a,b)=>a+Number(b.valor||0),0);

    const byCat = sumByCategory(base);
    byCat["Cartão"]=totalCartao;

    const totalGastos = base.reduce((a,b)=>a+Number(b.valor||0),0) + totalCartao;
    const resultado = totalDisponivel - totalGastos;

    const catsSorted = Object.entries(byCat).sort((a,b)=>b[1]-a[1]);

    dashEl.innerHTML = `
      <div class="row"><span class="tag">Bradesco</span><span class="muted">${currentMonth}</span></div>
      <div class="row big"><span>Total disponível</span><span>${money(totalDisponivel)}</span></div>

      <div class="card" style="margin:10px 0;background:var(--pill)">
        ${Object.entries(rendaPorSub).map(([k,v])=>`<div class="row"><span>${k}</span><span>${money(v)}</span></div>`).join("")}
      </div>

      <div class="row big"><span>Total gastos</span><span>${money(totalGastos)}</span></div>
      ${catsSorted.map(([k,v])=>`<div class="row"><span>${k}</span><span>${money(v)}</span></div>`).join("")}
      <hr/>
      <div class="row big"><span>Diferença do mês</span><span>${money(resultado)}</span></div>
    `;

    const list = L
      .filter(l=>l.conta==="Bradesco" || l.conta==="Cartão")
      .sort((a,b)=> (a.descricao||"").localeCompare(b.descricao||""));

    listEl.innerHTML = `<h4 style="margin:0 0 8px 0">Lançamentos (Bradesco + Cartão)</h4>` + renderLancamentosList(list);

  } else {
    // BB
    const entradas = L.filter(l=>l.conta==="Banco do Brasil" && (l.tipo==="Receita"||l.tipo==="Transferência"));
    const saidas = L.filter(l=>l.conta==="Banco do Brasil" && l.tipo==="Despesa");
    const invest = saidas.filter(l=>l.categoria==="Investimentos");
    const gastos = saidas.filter(l=>l.categoria!=="Investimentos");

    const totalEntr = entradas.reduce((a,b)=>a+Number(b.valor||0),0);
    const totalInv = invest.reduce((a,b)=>a+Number(b.valor||0),0);
    const totalGast = gastos.reduce((a,b)=>a+Number(b.valor||0),0);
    const resultado = totalEntr - (totalInv + totalGast);

    const byCat = sumByCategory(gastos);
    const byInv = {};
    invest.forEach(l=>{
      const k=l.subcategoria || "Invest";
      byInv[k]=(byInv[k]||0)+Number(l.valor||0);
    });

    dashEl.innerHTML = `
      <div class="row"><span class="tag">BB</span><span class="muted">${currentMonth}</span></div>
      <div class="row big"><span>Entradas</span><span>${money(totalEntr)}</span></div>
      <div class="row"><span>Gastos</span><span>${money(totalGast)}</span></div>
      <div class="row"><span>Investimentos</span><span>${money(totalInv)}</span></div>
      <hr/>
      <div class="row big"><span>Resultado BB</span><span>${money(resultado)}</span></div>

      <hr/>
      <h4 style="margin:6px 0">Gastos por categoria</h4>
      ${Object.entries(byCat).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`<div class="row"><span>${k}</span><span>${money(v)}</span></div>`).join("") || "<div class='muted'>Sem gastos.</div>"}

      <hr/>
      <h4 style="margin:6px 0">Investimentos por tipo</h4>
      ${Object.entries(byInv).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`<div class="row"><span>${k}</span><span>${money(v)}</span></div>`).join("") || "<div class='muted'>Sem investimentos.</div>"}
    `;

    const list = L
      .filter(l=>l.conta==="Banco do Brasil")
      .sort((a,b)=> (a.descricao||"").localeCompare(b.descricao||""));

    listEl.innerHTML = `<h4 style="margin:0 0 8px 0">Lançamentos (BB)</h4>` + renderLancamentosList(list);
  }
}

function renderLancamentosList(list){
  if(!list.length) return "<div class='muted'>Sem lançamentos neste mês.</div>";

  return list.map(l=>`
    <div class="item">
      <div class="row">
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
          <span class="tag">${l.conta}</span>
          <span class="tag">${l.tipo}</span>
          <span class="muted">${l.categoria} • ${l.subcategoria}</span>
        </div>
        <div class="big">${money(l.valor)}</div>
      </div>
      <div class="muted" style="margin-top:6px">${(l.descricao||"—")}</div>
      <div class="row" style="margin-top:10px;gap:8px">
        <button class="btn small" onclick="editLancamento('${l.id}')">Editar</button>
        <button class="btn small danger" onclick="deleteLancamento('${l.id}')">Excluir</button>
      </div>
    </div>
  `).join("");
}

function editLancamento(id){
  const data = loadData();
  const l = data.lancamentos.find(x=>x.id===id);
  if(!l) return;

  const valor = Number(prompt("Valor:", String(l.valor)) ?? l.valor);
  if(!isFinite(valor) || valor<=0) return alert("Valor inválido.");

  const desc = prompt("Descrição:", l.descricao||"") ?? (l.descricao||"");

  // opcional: editar categoria/sub
  const cats = getCats();
  const cat = prompt("Categoria:", l.categoria) ?? l.categoria;
  if(!cats[cat]) return alert("Categoria não existe. Ajuste em 'Mais' > Gerenciar.");
  const sub = prompt("Subcategoria:", l.subcategoria) ?? l.subcategoria;

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
  data.lancamentos = data.lancamentos.filter(x=>x.id!==id);
  saveData(data);
  renderMes();
  renderCartao();
  renderInvestimentos();
}

/* =========================
   CARTÃO
========================= */

function initCartaoUI(){
  const el=document.getElementById("card-month");
  if(el && !el.value) el.value = ymNow();
  if(el) el.onchange = ()=>renderCartao();

  const btnAdd=document.getElementById("btn-add-sub");
  const btnSync=document.getElementById("btn-sync-subs");
  if(btnAdd) btnAdd.onclick = addSubscription;
  if(btnSync) btnSync.onclick = syncSubscriptionsToMonth;
}

function addSubscription(){
  const data=loadData();
  const name=prompt("Nome da assinatura:");
  if(!name) return;

  const value=Number(prompt("Valor (ex.: 19.90):"));
  if(!isFinite(value)||value<=0) return alert("Valor inválido.");

  let periodicity=(prompt("Periodicidade: mensal ou anual?","mensal")||"mensal").toLowerCase();
  if(!["mensal","anual"].includes(periodicity)) return alert("Use mensal ou anual.");

  let dueMonth=null;
  if(periodicity==="anual"){
    dueMonth=(prompt("Mês de cobrança (01 a 12):","01")||"").padStart(2,"0");
    if(!/^(0[1-9]|1[0-2])$/.test(dueMonth)) return alert("Mês inválido.");
  }

  data.subscriptions.push({id:uid(),name:name.trim(),value,periodicity,dueMonth,active:true});
  saveData(data);
  renderSubscriptionsMaster();
}

function toggleSubscriptionActive(id){
  const data=loadData();
  const s=data.subscriptions.find(x=>x.id===id);
  if(!s) return;
  s.active=!s.active;
  saveData(data);
  renderSubscriptionsMaster();
}

function editSubscription(id){
  const data=loadData();
  const s=data.subscriptions.find(x=>x.id===id);
  if(!s) return;

  const name=prompt("Nome:",s.name) ?? s.name;
  const value=Number(prompt("Valor:",String(s.value)) ?? s.value);
  if(!name.trim()||!isFinite(value)||value<=0) return alert("Dados inválidos.");

  let periodicity=(prompt("Periodicidade: mensal ou anual?",s.periodicity) ?? s.periodicity).toLowerCase();
  if(!["mensal","anual"].includes(periodicity)) return alert("Use mensal ou anual.");

  let dueMonth=null;
  if(periodicity==="anual"){
    dueMonth=(prompt("Mês de cobrança (01 a 12):",s.dueMonth||"01")||"").padStart(2,"0");
    if(!/^(0[1-9]|1[0-2])$/.test(dueMonth)) return alert("Mês inválido.");
  }

  s.name=name.trim();
  s.value=value;
  s.periodicity=periodicity;
  s.dueMonth=dueMonth;

  saveData(data);
  renderSubscriptionsMaster();
}

function deleteSubscription(id){
  if(!confirm("Excluir assinatura?")) return;
  const data=loadData();
  data.subscriptions=data.subscriptions.filter(x=>x.id!==id);
  saveData(data);
  renderSubscriptionsMaster();
}

function renderSubscriptionsMaster(){
  const data=loadData();
  const el=document.getElementById("subs-master-list");
  if(!el) return;

  if(!data.subscriptions.length){
    el.innerHTML="<div class='muted'>Nenhuma assinatura cadastrada.</div>";
    return;
  }

  el.innerHTML=data.subscriptions.map(s=>`
    <div class="item">
      <div class="row">
        <div>
          <div class="big">${s.active?"🟢":"⚪"} ${s.name}</div>
          <div class="muted">${s.periodicity}${s.periodicity==="anual" ? " • mês "+s.dueMonth : ""}</div>
        </div>
        <div class="big">${money(s.value)}</div>
      </div>
      <div class="row" style="gap:8px;margin-top:10px">
        <button class="btn small ghost" onclick="toggleSubscriptionActive('${s.id}')">${s.active?"Desativar":"Ativar"}</button>
        <button class="btn small" onclick="editSubscription('${s.id}')">Editar</button>
        <button class="btn small danger" onclick="deleteSubscription('${s.id}')">Excluir</button>
      </div>
    </div>
  `).join("");
}

function syncSubscriptionsToMonth(){
  const data=loadData();
  const month=document.getElementById("card-month")?.value || ymNow();
  const mm=month.slice(5,7);

  data.subscriptions.filter(s=>s.active).forEach(s=>{
    const shouldCharge = s.periodicity==="mensal" || (s.periodicity==="anual" && s.dueMonth===mm);
    if(!shouldCharge) return;

    const metaKey=`SUB:${s.id}:${month}`;
    const exists=data.lancamentos.some(l=>l.metaKey===metaKey);
    if(exists) return;

    data.lancamentos.push({
      id:uid(),
      conta:"Cartão",
      tipo:"Assinatura",
      categoria:"Cartão",
      subcategoria:"Assinaturas",
      valor:Number(s.value),
      competencia:month,
      descricao:s.name,
      metaKey
    });
  });

  saveData(data);
  renderCartao();
}

function renderCartao(){
  const data=loadData();
  const month=document.getElementById("card-month")?.value || ymNow();

  const items=data.lancamentos.filter(l=>l.conta==="Cartão" && l.competencia===month);
  const subs=items.filter(l=>l.tipo==="Assinatura");
  const geral=items.filter(l=>l.tipo!=="Assinatura");
  const totalSubs=subs.reduce((a,b)=>a+Number(b.valor||0),0);
  const totalGeral=geral.reduce((a,b)=>a+Number(b.valor||0),0);

  const el=document.getElementById("card-list");
  if(!el) return;

  el.innerHTML=`
    <div class="row big"><span>Assinaturas</span><span>${money(totalSubs)}</span></div>
    <div class="row big"><span>Gastos gerais</span><span>${money(totalGeral)}</span></div>
    <hr/>
    <div class="row big"><span>Total fatura</span><span>${money(totalSubs+totalGeral)}</span></div>
    <hr/>
    ${items.map(l=>`
      <div class="item">
        <div class="row">
          <div>
            <div class="big">${l.descricao || l.subcategoria}</div>
            <div class="muted">${l.subcategoria}</div>
          </div>
          <div class="big">${money(l.valor)}</div>
        </div>
        <div class="row" style="gap:8px;margin-top:10px">
          <button class="btn small" onclick="editLancamento('${l.id}')">Editar</button>
          <button class="btn small danger" onclick="deleteLancamento('${l.id}')">Excluir</button>
        </div>
      </div>
    `).join("") || "<div class='muted'>Sem itens.</div>"}
  `;
}

/* =========================
   INVEST
========================= */

function renderInvestimentos(){
  const data=loadData();
  const month=currentMonth || ymNow();
  const list=data.lancamentos.filter(l=>
    l.conta==="Banco do Brasil" &&
    l.tipo==="Despesa" &&
    l.categoria==="Investimentos" &&
    l.competencia===month
  );

  const bySub={};
  list.forEach(l=>{
    const k=l.subcategoria||"Investimentos";
    bySub[k]=(bySub[k]||0)+Number(l.valor||0);
  });

  const total=list.reduce((a,b)=>a+Number(b.valor||0),0);

  const el=document.getElementById("invest-view");
  if(!el) return;

  el.innerHTML=`
    <div class="row big"><span>Total investido (mês)</span><span>${money(total)}</span></div>
    <hr/>
    ${Object.entries(bySub).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`<div class="row"><span>${k}</span><span>${money(v)}</span></div>`).join("") || "<div class='muted'>Sem investimentos.</div>"}
  `;
}

/* =========================
   EXPORT EXCEL
========================= */

function exportExcel(){
  if(typeof XLSX==="undefined"){
    alert("Exportação indisponível: biblioteca XLSX não carregou. (Cache do Pages?)");
    return;
  }

  const data=loadData();
  const month=currentMonth || ymNow();
  const L=data.lancamentos.filter(l=>l.competencia===month);

  const wb=XLSX.utils.book_new();

  // Aba Resumo
  const resumo=[];
  resumo.push([`Financeiro — ${month}`]);
  resumo.push([]);

  // BRAD
  const renda = L.filter(l=>l.conta==="Bradesco" && l.tipo==="Receita" && l.categoria==="Renda");
  const rendaPorSub={"Saldo anterior":0,"Salário":0,"13º":0,"Férias":0,"Outros":0};
  renda.forEach(l=>{
    const k=l.subcategoria||"Outros";
    rendaPorSub[k]=(rendaPorSub[k]||0)+Number(l.valor||0);
  });
  const totalDisponivel=Object.values(rendaPorSub).reduce((a,b)=>a+b,0);

  const base=L.filter(l=>l.conta==="Bradesco" && (l.tipo==="Despesa"||l.tipo==="Transferência"));
  const card=L.filter(l=>l.conta==="Cartão");
  const totalCartao=card.reduce((a,b)=>a+Number(b.valor||0),0);
  const byCat=sumByCategory(base);
  byCat["Cartão"]=totalCartao;
  const totalGastos=base.reduce((a,b)=>a+Number(b.valor||0),0)+totalCartao;
  const resultado=totalDisponivel-totalGastos;

  resumo.push(["BRADESCO"]);
  Object.entries(rendaPorSub).forEach(([k,v])=>resumo.push([k,v]));
  resumo.push(["Total disponível", totalDisponivel]);
  resumo.push([]);
  resumo.push(["Gastos por categoria"]);
  Object.entries(byCat).forEach(([k,v])=>resumo.push([k,v]));
  resumo.push(["Total gastos", totalGastos]);
  resumo.push(["Diferença do mês", resultado]);
  resumo.push([]);

  // BB
  const entradas=L.filter(l=>l.conta==="Banco do Brasil" && (l.tipo==="Receita"||l.tipo==="Transferência"));
  const saidas=L.filter(l=>l.conta==="Banco do Brasil" && l.tipo==="Despesa");
  const invest=saidas.filter(l=>l.categoria==="Investimentos");
  const gastos=saidas.filter(l=>l.categoria!=="Investimentos");
  const totalEntr=entradas.reduce((a,b)=>a+Number(b.valor||0),0);
  const totalInv=invest.reduce((a,b)=>a+Number(b.valor||0),0);
  const totalGa=gastos.reduce((a,b)=>a+Number(b.valor||0),0);
  const resBB=totalEntr-(totalInv+totalGa);

  resumo.push(["BANCO DO BRASIL"]);
  resumo.push(["Entradas", totalEntr]);
  resumo.push(["Gastos", totalGa]);
  resumo.push(["Investimentos", totalInv]);
  resumo.push(["Resultado BB", resBB]);
  resumo.push([]);

  // CARTÃO
  const subs=card.filter(l=>l.tipo==="Assinatura");
  const geral=card.filter(l=>l.tipo!=="Assinatura");
  const totalSubs=subs.reduce((a,b)=>a+Number(b.valor||0),0);
  const totalGer=geral.reduce((a,b)=>a+Number(b.valor||0),0);

  resumo.push(["CARTÃO"]);
  resumo.push(["Assinaturas", totalSubs]);
  resumo.push(["Gastos gerais", totalGer]);
  resumo.push(["Total fatura", totalSubs+totalGer]);

  const wsResumo=XLSX.utils.aoa_to_sheet(resumo);
  XLSX.utils.book_append_sheet(wb, wsResumo, `Resumo ${month}`);

  // Aba Eventos (para auditoria)
  const eventos=[["id","conta","tipo","categoria","subcategoria","valor","competencia","descricao"]];
  L.forEach(l=>{
    eventos.push([l.id,l.conta,l.tipo,l.categoria,l.subcategoria,Number(l.valor||0),l.competencia,l.descricao||""]);
  });
  const wsEv=XLSX.utils.aoa_to_sheet(eventos);
  XLSX.utils.book_append_sheet(wb, wsEv, `Eventos ${month}`);

  XLSX.writeFile(wb, `Financeiro_${month}.xlsx`);
}

/* =========================
   BOOT
========================= */

(function boot(){
  // defaults
  const comp=document.getElementById("competencia");
  if(comp && !comp.value) comp.value=ymNow();

  const dash=document.getElementById("dash-month");
  if(dash && !dash.value) dash.value=ymNow();
  currentMonth = dash?.value || ymNow();

  const chip=document.getElementById("chip-month");
  if(chip) chip.textContent=currentMonth;

  fillCategorySelects();
  wireCategoryChange();
  renderCatsPreview();
})();