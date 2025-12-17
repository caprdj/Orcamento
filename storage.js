// storage.js
(() => {
  const KEY = "financeiro_v1";

  function safeParse(json, fallback) {
    try { return JSON.parse(json); } catch { return fallback; }
  }

  function defaultData() {
    return {
      lancamentos: [],
      categories: {}
    };
  }

  function load() {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultData();
    const data = safeParse(raw, defaultData());
    if (!data || typeof data !== "object") return defaultData();
    if (!Array.isArray(data.lancamentos)) data.lancamentos = [];
    if (!data.categories || typeof data.categories !== "object") data.categories = {};
    return data;
  }

  function save(data) {
    localStorage.setItem(KEY, JSON.stringify(data || defaultData()));
  }

  window.StorageAPI = { load, save };
})();
