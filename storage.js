const STORAGE_KEY = "financeiro_v1";

const STORAGE_KEY = "financeiro_v1";

function loadData() {
  const raw = localStorage.getItem(STORAGE_KEY);
  const data = raw ? JSON.parse(raw) : null;

  const base = {
    lancamentos: [],
    subscriptions: [] // <- NOVO: cadastro de assinaturas
  };

  if (!data) return base;

  // Migração suave (se você já tinha dados salvos)
  if (!Array.isArray(data.lancamentos)) data.lancamentos = [];
  if (!Array.isArray(data.subscriptions)) data.subscriptions = [];

  return { ...base, ...data };
}

function saveData(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function saveData(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}