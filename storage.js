/* storage.js — camada simples de persistência (localStorage)
   - Não depende de servidor.
   - Mantém compatibilidade: tenta localizar automaticamente um "banco" existente no localStorage.
   - Não sobrescreve dados; apenas garante defaults e merges em categorias.
*/
(function(){
  const BK_PREFIX = "__FINBK__"; // usado pelo backup/export do app
  const FALLBACK_KEY = "FIN_DATA_V1";

  const DEFAULT_CATEGORIES = {
    "Renda": ["Salário", "13°", "Férias", "Outros"],
    "Habitação": ["Aluguel/Condomínio", "Luz", "Água", "Gás", "Internet", "IPTU", "Manutenção"],
    "Alimentação": ["Mercado", "Restaurante", "Lanches", "Delivery", "Café"],
    "Saúde": ["Farmácia", "Consultas", "Exames", "Plano", "Terapias"],
    "Transporte": ["Combustível", "Uber/Taxi", "Ônibus/Metrô", "Estacionamento", "Manutenção"],
    "Cartão": ["Fatura", "Parcela", "Anuidade", "Outros"],
    "Lazer": ["Viagens", "Cinema/Shows", "Restaurantes", "Assinaturas", "Outros"],
    "Pessoal": ["Beleza", "Roupas", "Presentes", "Pets", "Outros"],
    "Cursos": ["Cursos", "Livros", "Materiais"],
    "Outros gastos": ["Diversos"],
    // INVEST — aqui entram "ativos" (poupanças, FIIs e ações)
    "Investimentos": [
      // Poupanças / metas
      "Viagem", "Reforma", "Carro", "IPTU",
      // FIIs
      "BCRO11","FGAA11","KNCA11","KNCR11","LVBI11","MAXR11","MCCI11","PVBI11","RBRF11","RBRR11","RBVA11","RZTR11","XPLM11","KAFOF11","XPSF11",
      // Ações
      "NTCO3","BBAS3F","BBDC4F","PETR3F","VALE3F"
    ]
  };

  function safeParseJSON(s){
    try { return JSON.parse(s); } catch(e){ return null; }
  }

  function looksLikeFinanceData(obj){
    if(!obj || typeof obj !== "object") return false;
    if(Array.isArray(obj.lancamentos)) return true;
    // compatíveis
    if(Array.isArray(obj.launches)) return true;
    if(Array.isArray(obj.movimentos)) return true;
    return false;
  }

  function unifyKeys(obj){
    // converte chaves legadas para as atuais, sem perder dados
    if(!obj || typeof obj !== "object") obj = {};
    if(!Array.isArray(obj.lancamentos)){
      if(Array.isArray(obj.launches)) obj.lancamentos = obj.launches;
      else if(Array.isArray(obj.movimentos)) obj.lancamentos = obj.movimentos;
      else obj.lancamentos = [];
    }
    if(!obj.categories){
      if(obj.categorias) obj.categories = obj.categorias;
      else obj.categories = {};
    }
    if(!Array.isArray(obj.subscriptions)){
      if(Array.isArray(obj.assinaturas)) obj.subscriptions = obj.assinaturas;
      else obj.subscriptions = [];
    }
    if(!obj.cardClosing) obj.cardClosing = obj.cardClosingInfo || {};
    if(!obj.meta) obj.meta = {};
    return obj;
  }

  function uniq(arr){
    const out = [];
    const seen = new Set();
    (arr||[]).forEach(v=>{
      const s = String(v||"").trim();
      if(!s) return;
      const key = s.toLowerCase();
      if(seen.has(key)) return;
      seen.add(key);
      out.push(s);
    });
    return out;
  }

  function mergeDefaults(data){
    data = unifyKeys(data);
    const cats = data.categories || {};
    Object.entries(DEFAULT_CATEGORIES).forEach(([cat, subs])=>{
      if(!cats[cat]) cats[cat] = subs.slice();
      else cats[cat] = uniq([...(cats[cat]||[]), ...subs]);
    });
    data.categories = cats;
    return data;
  }

  function findExistingKey(){
    const keys = [];
    for(let i=0;i<localStorage.length;i++){
      const k = localStorage.key(i);
      if(!k) continue;
      if(k.startsWith(BK_PREFIX)) continue;
      keys.push(k);
    }

    // 1) tenta chaves "óbvias"
    const preferred = [
      "FIN_DATA_V1","FIN_DATA","FINANCEIRO_DATA","financeiro_data",
      "orcamento_data","ORCAMENTO_DATA","__FIN__DATA__",
      ...keys
    ];

    for(const k of preferred){
      if(!k) continue;
      const raw = localStorage.getItem(k);
      if(!raw) continue;
      const obj = safeParseJSON(raw);
      if(looksLikeFinanceData(obj)) return k;
    }
    return null;
  }

  let KEY = findExistingKey() || FALLBACK_KEY;

  function load(){
    const raw = localStorage.getItem(KEY);
    const obj = safeParseJSON(raw) || {};
    const data = mergeDefaults(obj);
    // se estava vazio e existe outra chave melhor, tenta migrar mantendo a KEY
    data.meta.updatedAt = new Date().toISOString();
    if(!data.meta.createdAt) data.meta.createdAt = data.meta.updatedAt;
    return data;
  }

  function save(data){
    const normalized = mergeDefaults(data || {});
    normalized.meta.updatedAt = new Date().toISOString();
    if(!normalized.meta.createdAt) normalized.meta.createdAt = normalized.meta.updatedAt;
    localStorage.setItem(KEY, JSON.stringify(normalized));
  }

  window.StorageAPI = {
    load, save,
    getKey: ()=>KEY,
    setKey: (k)=>{ if(k && typeof k==="string"){ KEY=k; } }
  };
})();
