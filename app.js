/* app.js (patch seguro) — conserta a aba Invest sem mexer no resto
   Use este arquivo se o seu index.html já tem o código principal inline.

   O que ele faz:
   1) Garante que exista UMA função global para renderizar a aba Invest:
      - renderInvest() (preferencial)
      - se só existir renderInvestimentos(), cria alias
      - se só existir renderInvest(), cria alias renderInvestimentos()
   2) Garante que ao abrir a aba Invest (via showView), o render rode.
*/

(function(){
  'use strict';

  function ensureInvestAlias(){
    // Alias bidirecional
    if (typeof window.renderInvest !== 'function' && typeof window.renderInvestimentos === 'function') {
      window.renderInvest = function(){ return window.renderInvestimentos(); };
    }
    if (typeof window.renderInvestimentos !== 'function' && typeof window.renderInvest === 'function') {
      window.renderInvestimentos = function(){ return window.renderInvest(); };
    }
  }

  function safeRenderInvest(){
    try{
      ensureInvestAlias();
      if (typeof window.renderInvest === 'function') return window.renderInvest();
      if (typeof window.renderInvestimentos === 'function') return window.renderInvestimentos();
      // Se não existir nada, mostra um aviso no próprio painel
      const host = document.getElementById('invest-view');
      if (host) {
        host.innerHTML = '<div class="muted" style="font-weight:800">Aba Invest: função de renderização não encontrada (renderInvest / renderInvestimentos).</div>';
      }
    }catch(err){
      const host = document.getElementById('invest-view');
      if (host) {
        host.innerHTML = '<div class="muted" style="font-weight:800">Erro ao renderizar Invest.</div>';
      }
      console.error(err);
    }
  }

  function patchShowView(){
    // Se já existe showView, embrulha.
    if (typeof window.showView === 'function' && !window.showView.__patched_invest) {
      const original = window.showView;
      const wrapped = function(view){
        const r = original.apply(this, arguments);
        if (view === 'invest') safeRenderInvest();
        return r;
      };
      wrapped.__patched_invest = true;
      window.showView = wrapped;
      return;
    }

    // Se showView ainda não existe, cria um listener para patch assim que aparecer.
    const maxWaitMs = 4000;
    const start = Date.now();
    (function waitForShowView(){
      if (typeof window.showView === 'function') {
        patchShowView();
        return;
      }
      if (Date.now() - start > maxWaitMs) return;
      setTimeout(waitForShowView, 50);
    })();
  }

  // Roda após o DOM (garante que IDs existam)
  function init(){
    ensureInvestAlias();
    patchShowView();

    // Se a aba atual já é Invest (ex: recarregou nela), tenta renderizar.
    const investView = document.getElementById('view-invest');
    if (investView && investView.classList.contains('active')) {
      safeRenderInvest();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
