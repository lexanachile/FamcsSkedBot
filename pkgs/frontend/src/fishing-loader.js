// Only this tiny launcher is loaded with the schedule. Scene, CSS and game
// code are requested on the first click, with a retry after a network failure.
export function setupFishingLauncher() {
  const button = document.getElementById('fishing-open');
  if (!button || button.dataset.ready) return;
  button.dataset.ready = 'true';
  const host = document.getElementById('fishing-host');
  const status = document.getElementById('fishing-load-status');
  let game;
  let styleReady;
  function reveal() {
    if (typeof host.animate === 'function' && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      host.animate([{ height: '0px', overflow: 'hidden' }, { height: `${host.scrollHeight}px`, overflow: 'hidden' }], { duration: 550, easing: 'cubic-bezier(.2,.8,.2,1)' });
    }
  }
  function loadStyle() {
    return styleReady ||= new Promise((resolve, reject) => {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = new URL('./fishing/game.css?v=49', import.meta.url).href;
      const timeout = setTimeout(() => failed(), 20000);
      function failed() { clearTimeout(timeout); link.remove(); styleReady = null; reject(new Error('CSS unavailable')); }
      link.onload = () => { clearTimeout(timeout); resolve(); };
      link.onerror = failed;
      document.head.append(link);
    });
  }
  button.addEventListener('click', async () => {
    if (game) {
      host.hidden = !host.hidden;
      button.setAttribute('aria-expanded', String(!host.hidden));
      game.setOpen(!host.hidden);
      if (!host.hidden) reveal();
      return;
    }
    button.disabled = true;
    status.textContent = 'Готовим удочки…';
    try {
      const [module] = await Promise.all([import('./fishing/game.js?v=49'), loadStyle()]);
      host.hidden = false;
      game = module.mountFishing(host);
      reveal();
      button.setAttribute('aria-expanded', 'true');
      status.textContent = '';
    } catch {
      host.hidden = true;
      status.textContent = 'Не удалось открыть озеро. Нажмите ещё раз.';
    } finally { button.disabled = false; }
  });
}
