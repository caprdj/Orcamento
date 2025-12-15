const STORAGE_KEY = "financeiro_v2";

const DEFAULT_CATS = {
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

function loadData() {
  const raw = localStorage.getItem(STORAGE_KEY);
  const base = {
    lancamentos: [],
    subscriptions: [],
    categories: DEFAULT_CATS
  };

  if (!raw) return base;

  const data = JSON.parse(raw);

  if (!Array.isArray(data.lancamentos)) data.lancamentos = [];
  if (!Array.isArray(data.subscriptions)) data.subscriptions = [];
  if (!data.categories || typeof data.categories !== "object") data.categories = DEFAULT_CATS;

  return { ...base, ...data };
}

function saveData(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}