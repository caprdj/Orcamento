/* Financeiro — app.js (versão completa e defensiva)
   - Evita travamentos por erro de JS (fallback de StorageAPI)
   - Corrige cálculo de saldo anterior (mês anterior) + evita “vazar” saldo manual
   - Mantém Invest / Cartão / Transferências com espelhos
*/
"use strict";

/* =========================
   STORAGE (fallback)
========================= */
(function ensureStorageAPI(){
  if(window.StorageAPI && typeof window.StorageAPI.load === "function" && typeof window.StorageAPI.save === "function") return;

  const KEY = "FINANCEIRO_DATA_V1";
  window.StorageAPI = {
    load(){
      try{
        const raw = localStorage.getItem(KEY);
        const data = raw ? JSON.parse(raw) : null;
        return (data && typeof data === "object") ? data : { lancamentos: [], categories: {}, subscriptions: {}, cardClosings: {} };
      }catch(e){
        return { lancamentos: [], categories: {}, subscriptions: {}, cardClosings: {} };
      }
    },
    save(data){
      try{
        localStorage.setItem(KEY, JSON.stringify(data || {}));
      }catch(e){}
    }
  };
})();

function loadData(){ return window.StorageAPI.load(); }
function saveData(data){
  window.StorageAPI.save(data);
  try{ computeSaldoAnterior._cache = {}; }catch(e){}
}

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
  const n = Number(v||0);
  return n.toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
}
function prevMonth(ym){
  const [y,m] = String(ym||"").split("-").map(Number);
  if(!y || !m) return null; // <— era ymNow()
  const d = new Date(y, m-1, 1);
  d.setMonth(d.getMonth()-1);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
}
function nextMonth(ym){
  const [y,m] = String(ym||"").split("-").map(Number);
  if(!y || !m) return ymNow();
  const d = new Date(y, m-1, 1);
  d.setMonth(d.getMonth()+1);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
}
function fmtDate(iso){
  if(!iso) return "";
  const s = String(iso).trim();
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
  if(!v) return ""; // keep existing
  if(/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  if(/^\d{2}\/\d{2}\/\d{4}$/.test(v)){
    const [d,m,y]=v.split("/");
    return `${y}-${m}-${d}`;
  }
  return "__INVALID__";
}
function accountTagClass(conta){
  if(conta === "Bradesco") return "brad";
  if(conta === "Banco do Brasil") return "bb";
  if(conta === "Cartão") return "tipo";
  return "";
}
function escapeHTML(str){
  return String(str ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

/* =========================
   INVEST HELPERS
========================= */
function normInvestMovValue(l){
  const mvRaw = String(l.investMov||"").trim().toLowerCase();
  const desc = String(l.descricao||"").toLowerCase();

  if(mvRaw === "aplic") return "aplic";
  if(mvRaw === "rend") return "rend";
  if(mvRaw === "retir") return "retir";
  if(mvRaw === "ajuste+") return "ajuste+";
  if(mvRaw === "ajuste-") return "ajuste-";

  // compat: antigos
  if(mvRaw === "saida") return "aplic";
  if(mvRaw === "entrada"){
    if(desc.includes("resgat") || desc.includes("venda") || desc.includes("retir") || desc.includes("saque")) return "retir";
    return "rend";
  }

  if(String(l.tipo||"").toLowerCase() === "despesa") return "aplic";
  if(desc.includes("resgat") || desc.includes("venda") || desc.includes("retir") || desc.includes("saque")) return "retir";
  return "rend";
}
function investKindFromAsset(name){
  const x = String(name||"").trim().toUpperCase();
  if(!x) return "—";
  if(/11$/.test(x)) return "FII";
  if(x.startsWith("POUP") || x.startsWith("PREV") ||
     x.includes("VIAGEM") || x.includes("REFORMA") || x.includes("CARRO") || x.includes("IPTU")) return "Poupança";
  return "Ação";
}
function renderInvestAssetTable(rows){
  if(!rows || !rows.length) return `<div class="muted">Sem dados.</div>`;
  const hdr = `
    <tr>
      <th style="text-align:left;padding:8px 6px;border-bottom:1px solid #e5e7eb">Ativo</th>
      <th style="text-align:left;padding:8px 6px;border-bottom:1px solid #e5e7eb">Tipo</th>
      <th style="text-align:right;padding:8px 6px;border-bottom:1px solid #e5e7eb">APLIC</th>
      <th style="text-align:right;padding:8px 6px;border-bottom:1px solid #e5e7eb">REND</th>
      <th style="text-align:right;padding:8px 6px;border-bottom:1px solid #e5e7eb">RETIR</th>
      <th style="text-align:right;padding:8px 6px;border-bottom:1px solid #e5e7eb">TOTAL*</th>
    </tr>`;
  const body = rows.map(r=>`
    <tr>
      <td style="padding:8px 6px;border-bottom:1px solid #f1f5f9;white-space:nowrap">${escapeHTML(r.asset)}</td>
      <td style="padding:8px 6px;border-bottom:1px solid #f1f5f9">${escapeHTML(r.kind)}</td>
      <td style="padding:8px 6px;border-bottom:1px solid #f1f5f9;text-align:right">${money(r.aplic)}</td>
      <td style="padding:8px 6px;border-bottom:1px solid #f1f5f9;text-align:right">${money(r.rend)}</td>
      <td style="padding:8px 6px;border-bottom:1px solid #f1f5f9;text-align:right">${money(r.retir)}</td>
      <td style="padding:8px 6px;border-bottom:1px solid #f1f5f9;text-align:right;font-weight:900">${money(r.total)}</td>
    </tr>`).join("");
  return `<div style="overflow:auto">
    <table style="width:100%;border-collapse:collapse;font-size:0.95rem">
      <thead>${hdr}</thead>
      <tbody>${body}</tbody>
    </table>
  </div>
  <div class="hint">*TOTAL = APLIC + REND − RETIR (saldo teórico do ativo no ano).</div>`;
}
function ensureInvestDefaults(){
  const cats = getCats();
  const cur = Array.isArray(cats["Investimentos"]) ? cats["Investimentos"] : [];
  if(cur && cur.length) return;

  const defaults = [
    "Viagem","Reforma","Carro","IPTU",
    "BCRO11","FGAA11","KNCA11","KNCR11","LVBI11","MAXR11","MCCI11","PVBI11","RBRF11","RBRR11","RBVA11","RZTR11","XPLM11","KAFOF11","XPSF11",
    "NTCO3","BBAS3F","BBDC4F","PETR3F","VALE3F"
  ];
  cats["Investimentos"] = defaults;
  setCats(cats);
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
  data.categories = newCats || {};
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

  if(wrap) wrap.style.display = isInvest ? "block" : "none";

  if(tipoSel){
    if(isInvest){
      tipoSel.disabled = true;
      const mv = (mov?.value || "aplic").toLowerCase();
      if(mv === "rend" || mv === "retir" || mv === "ajuste+") tipoSel.value = "Receita";
      else tipoSel.value = "Despesa";
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
  }else if(view==="cartao"){
    const cm=document.getElementById("card-month");
    if(cm && !cm.value) cm.value = currentMonth || ymNow();
    if(cm) cm.onchange = ()=> renderCartao();
    renderCartao();
  }else if(view==="invest"){
    const inv=document.getElementById("invest-month");
    if(inv && !inv.value) inv.value = (currentMonth || ymNow());
    if(inv) inv.onchange = ()=> renderInvestimentos();
    renderInvestimentos();
  }else if(view==="mais"){
    renderCatsPreview();
  }
}
function wireTabs(){
  const map = { "tab-lancar":"lancar", "tab-mes":"mes", "tab-cartao":"cartao", "tab-invest":"invest", "tab-mais":"mais" };
  Object.keys(map).forEach(id=>{
    const btn = document.getElementById(id);
    if(btn) btn.addEventListener("click", ()=> showView(map[id]));
  });
}

/* =========================
   LANÇAMENTO
========================= */
function salvarLancamento(){
  const data = loadData();
  data.lancamentos = Array.isArray(data.lancamentos) ? data.lancamentos : [];

  const conta = document.getElementById("conta")?.value || "Bradesco";
  const tipo = document.getElementById("tipo")?.value || "Despesa";
  const categoria = document.getElementById("categoria")?.value || "Outros gastos";
  const subcategoria = document.getElementById("subcategoria")?.value || "Diversos";
  const valor = Number(document.getElementById("valor")?.value || 0);
  const competencia = document.getElementById("competencia")?.value || ymNow();
  const dataLanc = document.getElementById("data")?.value || todayISO();
  const descricao = document.getElementById("descricao")?.value || "";
  const destinoTrf = document.getElementById("destinoTrf")?.value || "";

  let investMov = "";
  let finalTipo = tipo;

  if(conta === "Banco do Brasil" && categoria === "Investimentos"){
    const mvRaw = (document.getElementById("invest-mov")?.value || "aplic").trim().toLowerCase();
    investMov = mvRaw;
    if(investMov === "rend" || investMov === "retir" || investMov === "ajuste+") finalTipo = "Receita";
    else finalTipo = "Despesa";
  }

  if(!isFinite(valor) || valor <= 0){
    alert("Informe um valor válido.");
    return;
  }

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

  // Espelho automático: Bradesco -> BB (entra como Transferência no BB, mas NÃO vira Invest)
  if (tipo === "Transferência" && conta === "Bradesco" && destinoTrf === "BB") {
    data.lancamentos.push({
      id: uid(),
      conta: "Banco do Brasil",
      tipo: "Transferência",
      categoria: "Outros gastos",
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
    data.lancamentos.push({
      id: uid(),
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

  const vEl = document.getElementById("valor");
  const dEl = document.getElementById("descricao");
  if(vEl) vEl.value = "";
  if(dEl) dEl.value = "";

  try{ renderMes(); }catch(e){}
  try{ renderCartao(); }catch(e){}
  try{ renderInvestimentos(); }catch(e){}
  alert("Salvo!");
}
window.salvarLancamento = salvarLancamento;

/* =========================
   MÊS
========================= */
let currentMonth = ymNow();
let currentBank = "Bradesco";

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
  if(!entries || !entries.length) return `<div class="muted">Sem dados.</div>`;
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
              <div class="bar-label">${escapeHTML(label)}</div>
              <div class="bar-value">${money(val)}</div>
            </div>
            <div class="bar-track center">
              <div class="bar-fill ${isIn?"in":"out"}"
                style="width:${pct}%; margin-left:${isIn?50:50-pct}%;"></div>
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
          <span class="tag ${accountTagClass(l.conta)}">${escapeHTML(l.conta)}</span>
          <span class="tag ${
            l.tipo==="Receita" ? "in" :
            (l.tipo==="Despesa" || l.tipo==="Assinatura") ? "out" : "trf"
          }">${escapeHTML(l.tipo)}</span>
          <span class="muted" style="font-weight:800">
            ${escapeHTML(l.categoria)} • ${escapeHTML(l.subcategoria)}${l.data ? ` • ${fmtDate(l.data)}` : ""}
          </span>
          <span style="margin-left:auto;font-weight:900">${money(l.valor)}</span>
        </div>
        <div class="muted" style="margin-top:8px">${escapeHTML(l.descricao||"—")}</div>
        <div style="display:flex;justify-content:space-between;margin-top:10px;gap:8px">
          <button class="btn small" onclick="editLancamento('${l.id}')">Editar</button>
          <button class="btn small danger" onclick="deleteLancamento('${l.id}')">Excluir</button>
        </div>
      </div>
    `).join("");
}

function computeSaldoAnterior(conta, month){
  const data = loadData();
  data.lancamentos = Array.isArray(data.lancamentos) ? data.lancamentos : [];

  const cache = computeSaldoAnterior._cache || (computeSaldoAnterior._cache = {});
  const key = (c,m)=> `${c}__${m}`;

  // mês mais antigo que existe para esta conta (YYYY-MM)
  const months = data.lancamentos
    .filter(l => l.showInSaldo !== false) // não usado, mas não atrapalha
    .filter(l => l.conta === conta && l.conta !== "Cartão" && /^\d{4}-\d{2}$/.test(String(l.competencia||"")))
    .map(l => l.competencia);

  const minMonth = months.length ? months.reduce((a,b)=> a < b ? a : b) : null;

  const hasAny = (c,m)=> data.lancamentos.some(l =>
    l.conta === c && l.conta !== "Cartão" && l.competencia === m
  );

  function stepBackToMonthWithData(c, startMonth){
    let pm = prevMonth(startMonth);
    // hard limit: no máximo 120 passos (~10 anos) para evitar travar celular
    let guard = 0;

    while(pm){
      if(minMonth && pm < minMonth) return null;   // passou do mais antigo existente
      if(hasAny(c, pm)) return pm;                 // achou mês com dados
      pm = prevMonth(pm);
      guard++;
      if(guard > 120) return null;                 // segurança anti-freeze
    }
    return null;
  }

  function calcTotalDisponivel(c, m){
    const k = key(c,m);
    if(cache[k] != null) return cache[k];

    const Lm = data.lancamentos.filter(l => l.competencia === m && l.conta === c && l.conta !== "Cartão");

    const saldoAnteriorLancado = Lm
      .filter(l => l.tipo === "Receita" && l.categoria === "Renda" && l.subcategoria === "Saldo anterior")
      .reduce((a,b)=>a+Number(b.valor||0),0);

    const pm = stepBackToMonthWithData(c, m);
    const saldoAnteriorAuto = pm ? calcTotalDisponivel(c, pm) : 0;

    const saldoAnteriorFinal = saldoAnteriorAuto + saldoAnteriorLancado;

    const receitas = Lm.filter(l =>
      (l.tipo === "Receita" || (l.tipo === "Transferência" && c === "Banco do Brasil")) &&
      !(l.categoria === "Renda" && l.subcategoria === "Saldo anterior")
    );
    const totalRec = receitas.reduce((a,b)=>a+Number(b.valor||0),0);

    const despesas = Lm.filter(l =>
      l.tipo === "Despesa" || (l.tipo === "Transferência" && c === "Bradesco")
    );
    const totalDes = despesas.reduce((a,b)=>a+Number(b.valor||0),0);

    const totalDisponivel = saldoAnteriorFinal + totalRec - totalDes;
    cache[k] = totalDisponivel;
    return totalDisponivel;
  }

  // saldo anterior do mês atual = total disponível do último mês anterior que tem dados
  const pm = stepBackToMonthWithData(conta, month);
  return pm ? calcTotalDisponivel(conta, pm) : 0;
}

function renderMes(){
  const data = loadData();
  data.lancamentos = Array.isArray(data.lancamentos) ? data.lancamentos : [];

  const month = currentMonth;
  const conta = currentBank;

  const dash=document.getElementById("dashboard");
  const listEl=document.getElementById("listagem");
  if(!dash || !listEl) return;

  const L = data.lancamentos.filter(l=>l.competencia===month);
  const LM = L.filter(l => l.conta === conta && l.conta !== "Cartão");

  // saldo anterior manual (APENAS no mês atual) — não deve “vazar” no automático
  const saldoAnteriorLancado = LM
    .filter(l => l.tipo === "Receita" && l.categoria === "Renda" && l.subcategoria === "Saldo anterior")
    .reduce((a,b)=>a+Number(b.valor||0),0);

  const saldoAnteriorAuto = computeSaldoAnterior(conta, month);
  const saldoAnterior = saldoAnteriorAuto + saldoAnteriorLancado;

  const receitas = LM.filter(l =>
    l.tipo === "Receita" &&
    !(l.categoria === "Renda" && l.subcategoria === "Saldo anterior")
  );
  const despesas = LM.filter(l => l.tipo === "Despesa");

  const totalRec = receitas.reduce((a,b)=>a+Number(b.valor||0),0);
  const totalDes = despesas.reduce((a,b)=>a+Number(b.valor||0),0);

  const totalDisponivel = saldoAnterior + totalRec - totalDes;

  const byCat = sumByCategory(despesas);
  const bars = Object.entries(byCat).sort((a,b)=>b[1]-a[1]);

  const bankClass = conta==="Bradesco" ? "bank-brad" : "bank-bb";
  const bankLabelClass = conta==="Bradesco" ? "brad-text" : "bb-text";

  // transferências líquido (para mostrar no resumo, mas NÃO mexe no total disponível)
  const trfOut = LM.filter(l=> l.tipo==="Transferência" && l.conta===conta).reduce((s,l)=>s+Number(l.valor||0),0);

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
        `}

        <div class="row"><span>Transferências (líquido)</span><span>${money(-trfOut)}</span></div>
      </div>

      <div class="row big" style="margin-top:10px"><span>Total gastos</span><span>${money(totalDes)}</span></div>

      ${renderBars("Gastos por categoria (barra)", bars)}
    </div>
  `;

  listEl.innerHTML = `
    <h3 style="margin:0 0 8px 0">Lançamentos (${conta==="Bradesco"?"Bradesco":"BB"})</h3>
    ${LM.length ? renderLancList(LM) : `<div class="muted">Sem lançamentos para este banco/mês.</div>`}
  `;
}

/* =========================
   INVEST
========================= */
function renderInvestimentos(){
  const data = loadData();
  data.lancamentos = Array.isArray(data.lancamentos) ? data.lancamentos : [];

  const month = document.getElementById("invest-month")?.value || ymNow();
  const year = String(month).slice(0,4);

  const listMonth = data.lancamentos.filter(l =>
    l.conta === "Banco do Brasil" &&
    l.categoria === "Investimentos" &&
    l.competencia === month
  );

  let aplicMes = 0, rendMes = 0, retirMes = 0;
  listMonth.forEach(l=>{
    const mv = normInvestMovValue(l);
    const v = Number(l.valor||0);
    if(mv === "aplic" || mv === "ajuste-") aplicMes += v;
    else if(mv === "retir") retirMes += v;
    else rendMes += v;
  });

  // saldo anterior = saldo final do mês anterior (por investMov)
  const prev = prevMonth(month);
  const prevList = data.lancamentos.filter(l =>
    l.conta === "Banco do Brasil" &&
    l.categoria === "Investimentos" &&
    l.competencia === prev
  );

  let saldoAnterior = 0;
  prevList.forEach(l=>{
    const mv = normInvestMovValue(l);
    const v = Number(l.valor||0);
    if(mv === "aplic" || mv === "ajuste-") saldoAnterior -= v;
    else saldoAnterior += v; // rend, retir, ajuste+
  });

  let saldoMovMes = 0;
  listMonth.forEach(l=>{
    const mv = normInvestMovValue(l);
    const v = Number(l.valor||0);
    if(mv === "aplic" || mv === "ajuste-") saldoMovMes -= v;
    else saldoMovMes += v;
  });

  const saldoFinal = saldoAnterior + saldoMovMes;

  // Por ativo no mês (delta)
  const porAtivoMes = {};
  listMonth.forEach(l=>{
    const ativo = l.subcategoria || "Diversos";
    const mv = normInvestMovValue(l);
    const v = Number(l.valor||0);
    const delta = (mv === "aplic" || mv === "ajuste-") ? -v : v;
    porAtivoMes[ativo] = (porAtivoMes[ativo] || 0) + delta;
  });
  const entriesMes = Object.entries(porAtivoMes)
    .filter(([,v]) => Math.abs(v) > 0.00001)
    .sort((a,b)=>Math.abs(b[1])-Math.abs(a[1]));

  // Ano (acumulado) — por ativo
  const listYear = data.lancamentos.filter(l =>
    l.conta === "Banco do Brasil" &&
    l.categoria === "Investimentos" &&
    String(l.competencia||"").startsWith(year + "-")
  );

  const cats = getCats();
  const assetsFromCats = Array.isArray(cats["Investimentos"]) ? cats["Investimentos"] : [];
  const assetsFromData = Array.from(new Set(listYear.map(l=> l.subcategoria || "Diversos")));
  const assets = Array.from(new Set([...assetsFromCats, ...assetsFromData])).filter(Boolean);

  const rows = assets.map(asset=>{
    let aplic=0, rend=0, retir=0;
    listYear.forEach(l=>{
      const a = l.subcategoria || "Diversos";
      if(a !== asset) return;
      const mv = normInvestMovValue(l);
      const v = Number(l.valor||0);
      if(mv === "aplic" || mv === "ajuste-") aplic += v;
      else if(mv === "retir") retir += v;
      else rend += v;
    });
    const total = aplic + rend - retir;
    return { asset, kind: investKindFromAsset(asset), aplic, rend, retir, total };
  }).sort((a,b)=> (b.rend - a.rend) || (b.total - a.total) || a.asset.localeCompare(b.asset));

  const sumKind = (kind, field) => rows.filter(r=>r.kind===kind).reduce((s,r)=>s+Number(r[field]||0),0);
  const sumAll = (field) => rows.reduce((s,r)=>s+Number(r[field]||0),0);

  const investEl = document.getElementById("invest-view");
  if(!investEl) return;

  investEl.innerHTML = `
    <div class="row big"><span>Saldo anterior</span><span>${money(saldoAnterior)}</span></div>
    <div class="row big"><span>Saldo final (mês)</span><span>${money(saldoFinal)}</span></div>

    <hr/>

    <div class="row"><span><b>Totais do mês (Invest)</b></span><span></span></div>
    <div class="row"><span>APLIC (saídas)</span><span>${money(aplicMes)}</span></div>
    <div class="row"><span>REND (dividendos/juros)</span><span>${money(rendMes)}</span></div>
    <div class="row"><span>RETIR (resgates/vendas)</span><span>${money(retirMes)}</span></div>

    ${entriesMes.length ? renderBars("Por ativo (mês)", entriesMes) : `<div class="hint">Sem movimento por ativo neste mês.</div>`}

    <hr/>

    <div class="row"><span><b>Proventos acumulados no ano (${year})</b></span><span>${money(sumAll("rend"))}</span></div>
    <div class="row"><span>Poupanças</span><span>${money(sumKind("Poupança","rend"))}</span></div>
    <div class="row"><span>FIIs</span><span>${money(sumKind("FII","rend"))}</span></div>
    <div class="row"><span>Ações</span><span>${money(sumKind("Ação","rend"))}</span></div>

    <details style="margin-top:10px" open>
      <summary style="cursor:pointer;font-weight:900">Tabela por ativo (ano)</summary>
      ${renderInvestAssetTable(rows)}
    </details>
  `;
}

/* =========================
   CARTÃO — FECHAMENTO + ASSINATURAS (mantém suas IDs/estruturas)
   (Versão “safe”: não quebra se não existirem elementos)
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

/* ---- assinatura helpers (mínimo necessário) ---- */
function normLower(s){ return String(s||"").trim().toLowerCase(); }
function subChargeKey(subId, month){ return `sub:${subId}:${month}`; }
function shouldChargeSubscription(sub, month){
  const start = sub.startMonth || "0000-00";
  if(month < start) return false;
  const freq = (sub.frequency || "mensal").toLowerCase();
  if(freq === "anual") return month.slice(5,7) === start.slice(5,7);
  return true;
}
function getSubNameSet(sub){
  const names = new Set();
  if(sub?.name) names.add(normLower(sub.name));
  if(Array.isArray(sub?.aliases)){
    for(const a of sub.aliases){
      const n = normLower(a);
      if(n) names.add(n);
    }
  }
  return names;
}
function getSubValueSet(sub){
  const vals = new Set();
  if(isFinite(Number(sub?.valor))) vals.add(Number(sub.valor));
  if(Array.isArray(sub?.valuesHistory)){
    for(const v of sub.valuesHistory){
      const n = Number(v);
      if(isFinite(n)) vals.add(n);
    }
  }
  return vals;
}
function subscriptionChargeExists(data, sub, month){
  const key = subChargeKey(sub.id, month);
  const names = getSubNameSet(sub);
  const values = getSubValueSet(sub);
  return (data.lancamentos||[]).some(l =>
    l.conta === "Cartão" &&
    l.competencia === month &&
    (
      l.subscriptionKey === key ||
      (l.tipo === "Assinatura" && l.subscriptionId === sub.id) ||
      (l.tipo === "Assinatura" && !l.subscriptionId && names.has(normLower(l.descricao)) && values.has(Number(l.valor)))
    )
  );
}
function createSubscriptionCharge(data, sub, month){
  const key = subChargeKey(sub.id, month);
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
    subscriptionId: sub.id,
    subscriptionKey: key
  });
}
function ensureSubscriptionsForMonth(month){
  const data = loadData();
  if(getCardClosingInfo(data, month)) return false;

  data.lancamentos = Array.isArray(data.lancamentos) ? data.lancamentos : [];
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
  data.lancamentos = Array.isArray(data.lancamentos) ? data.lancamentos : [];

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
window.salvarCartaoGasto = salvarCartaoGasto;

function closeCardStatement(){
  const month = document.getElementById("card-month")?.value || ymNow();
  const data0 = loadData();
  if(getCardClosingInfo(data0, month)){
    alert("Essa fatura já está fechada. Use 'Reabrir fatura' para alterar.");
    return;
  }
  ensureSubscriptionsForMonth(month);

  const data = loadData();
  const items = (data.lancamentos||[]).filter(l=>l.conta==="Cartão" && l.competencia===month);
  const total = items.reduce((a,b)=>a+Number(b.valor||0),0);

  if(total <= 0 && !confirm("Não há lançamentos no cartão neste mês. Fechar mesmo assim?")) return;

  const payAccount = document.getElementById("card-pay-account")?.value || "Bradesco";
  const payMonth = document.getElementById("card-pay-month")?.value || nextMonth(month);
  const payDate = document.getElementById("card-pay-date")?.value || isoFromYMDay(payMonth, 1);

  const paymentId = uid();

  data.lancamentos = Array.isArray(data.lancamentos) ? data.lancamentos : [];
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

  const clos = getCardClosings(data);
  clos[month] = { month, closedAt: new Date().toISOString(), payAccount, payMonth, payDate, total, paymentId };

  saveData(data);

  alert("Fatura fechada e pagamento lançado!");
  renderCartao();
  renderMes();
}
window.closeCardStatement = closeCardStatement;

function reopenCardStatement(){
  const month = document.getElementById("card-month")?.value || ymNow();
  const data = loadData();
  const info = getCardClosingInfo(data, month);
  if(!info){ alert("Essa fatura não está fechada."); return; }

  if(!confirm("Reabrir a fatura deste mês? (O lançamento de pagamento será removido.)")) return;

  if(info.paymentId){
    data.lancamentos = (data.lancamentos||[]).filter(l=>l.id !== info.paymentId);
  }else{
    data.lancamentos = (data.lancamentos||[]).filter(l=>!(l.cardPaymentFor === month && l.categoria==="Cartão" && l.subcategoria==="Fatura"));
  }

  const clos = getCardClosings(data);
  delete clos[month];

  saveData(data);

  alert("Fatura reaberta.");
  renderCartao();
  renderMes();
}
window.reopenCardStatement = reopenCardStatement;

function renderCartao(){
  const month = document.getElementById("card-month")?.value || ymNow();

  fillCategorySelectsFor("card-categoria","card-subcategoria","Cartão","Compras");
  const cd = document.getElementById("card-date");
  if(cd && !cd.value) cd.value = todayISO();

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
  }
  if(payDateEl && !payDateEl.value){
    const pm = payMonthEl?.value || nextMonth(month);
    payDateEl.value = isoFromYMDay(pm, 1);
  }

  const pre = loadData();
  if(!getCardClosingInfo(pre, month)) ensureSubscriptionsForMonth(month);

  const data = loadData();
  data.lancamentos = Array.isArray(data.lancamentos) ? data.lancamentos : [];
  const closing = getCardClosingInfo(data, month);

  const statusEl = document.getElementById("card-close-status");
  const btnClose = document.getElementById("btnCloseCard");
  const btnReopen = document.getElementById("btnReopenCard");

  if(statusEl){
    if(closing){
      let dtLabel = "—";
      try{ if(closing.closedAt) dtLabel = new Date(closing.closedAt).toLocaleString("pt-BR"); }catch(e){}
      statusEl.innerHTML = `✅ Fatura fechada em <b>${dtLabel}</b><br>` +
        `Pagamento: <b>${closing.payMonth || "—"}</b> • ${closing.payAccount || "—"} • ${money(closing.total || 0)}`;
    }else{
      statusEl.innerHTML = `Fatura aberta. Ao fechar, o app cria um lançamento de pagamento no mês escolhido.`;
    }
  }
  if(btnClose) btnClose.style.display = closing ? "none" : "";
  if(btnReopen) btnReopen.style.display = closing ? "" : "none";

  [payAccountEl, payMonthEl, payDateEl].forEach(el=>{ if(el) el.disabled = !!closing; });

  const items = data.lancamentos.filter(l=>l.conta==="Cartão" && l.competencia===month);
  const subs = items.filter(l=>l.tipo==="Assinatura");
  const geral = items.filter(l=>l.tipo!=="Assinatura");

  const totalSubs = subs.reduce((a,b)=>a+Number(b.valor||0),0);
  const totalGeral = geral.reduce((a,b)=>a+Number(b.valor||0),0);

  const el = document.getElementById("card-list");
  if(el){
    el.innerHTML = `
      <div class="row big"><span>Assinaturas</span><span>${money(totalSubs)}</span></div>
      <div class="row big"><span>Gastos gerais</span><span>${money(totalGeral)}</span></div>
      <div class="row big"><span>Total do cartão</span><span>${money(totalSubs+totalGeral)}</span></div>
      <hr/>
      <h4 style="margin:10px 0 6px 0">Extrato do cartão (mês)</h4>
      ${items.length ? renderLancList(items) : `<div class="muted">Sem lançamentos de cartão neste mês.</div>`}
    `;
  }
}

/* =========================
   EDIT / DELETE
========================= */
function editLancamento(id){
  const data = loadData();
  data.lancamentos = Array.isArray(data.lancamentos) ? data.lancamentos : [];
  const l = data.lancamentos.find(x=>x.id===id);
  if(!l) return;

  if(l.conta === "Cartão" && isCardMonthClosed(l.competencia)){
    alert("Esta fatura já está fechada. Use 'Reabrir fatura' para editar lançamentos do cartão.");
    return;
  }

  const dtRaw = prompt("Data (AAAA-MM-DD ou DD/MM/AAAA):", l.data || "");
  const dt = normalizeDateInput(dtRaw);
  if(dt === null) return;
  if(dt === "__INVALID__") return alert("Data inválida. Use AAAA-MM-DD ou DD/MM/AAAA.");
  if(dt) l.data = dt;

  const valor = Number(prompt("Valor:", String(l.valor)) ?? l.valor);
  if(!isFinite(valor) || valor<=0) return alert("Valor inválido.");

  const desc = prompt("Descrição:", l.descricao||"") ?? (l.descricao||"");

  const cats = getCats();

  let cat = l.categoria;
  let sub = l.subcategoria;

  if (l.categoria !== "Investimentos") {
    cat = prompt("Categoria:", l.categoria) ?? l.categoria;
    if (!cats[cat]) return alert("Categoria não existe. Ajuste em 'Mais' > Gerenciar.");

    sub = prompt("Subcategoria:", l.subcategoria) ?? l.subcategoria;
  }

  l.valor = valor;
  l.descricao = String(desc||"").trim();
  l.categoria = cat;
  l.subcategoria = sub;

  saveData(data);
  renderMes();
  renderCartao();
  renderInvestimentos();
}
window.editLancamento = editLancamento;

function deleteLancamento(id){
  if(!confirm("Excluir lançamento?")) return;
  const data = loadData();
  data.lancamentos = Array.isArray(data.lancamentos) ? data.lancamentos : [];
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
window.deleteLancamento = deleteLancamento;

/* =========================
   EXPORT + CATS
========================= */
function exportExcel(){
  if(!window.XLSX){
    alert("Exportação indisponível: biblioteca XLSX não carregou.");
    return;
  }
  const data = loadData();
  const month = currentMonth || ymNow();
  const rows = (data.lancamentos||[])
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
window.exportExcel = exportExcel;

function openCats(){
  const cats = getCats();
  const text = prompt("Edite como JSON (categoria: [sub1, sub2...])", JSON.stringify(cats, null, 2));
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
window.openCats = openCats;

/* =========================
   INIT
========================= */
function ensureDefaultCats(){
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
  }else{
    // garante "Saldo anterior" sempre presente em Renda
    const cats = getCats();
    if(!cats["Renda"]) cats["Renda"] = ["Salário","13°","Férias","Outros"];
    if(!cats["Renda"].includes("Saldo anterior")){
      cats["Renda"].unshift("Saldo anterior");
      setCats(cats);
    }
  }
}

function safeInit(){
  ensureDefaultCats();
  ensureInvestDefaults();

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
  wireTabs();
  updateLaunchUI();
  renderCatsPreview();

  // começa em "lancar" (como seu app), mas deixa a aba Mes pronta quando clicar
  showView("lancar");
}

if(document.readyState === "loading"){
  document.addEventListener("DOMContentLoaded", ()=>{
    try{ safeInit(); }catch(e){ console.error(e); alert("Erro ao iniciar o app. Abra o Console para detalhes."); }
  });
}else{
  try{ safeInit(); }catch(e){ console.error(e); alert("Erro ao iniciar o app. Abra o Console para detalhes."); }
}
