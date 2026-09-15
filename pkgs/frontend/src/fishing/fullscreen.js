export function setupFullscreen(root) {
  const button = root.querySelector('.fish-fullscreen');
  let placeholder;
  function close() {
    root.classList.remove('fish-expanded');
    if (placeholder) { placeholder.replaceWith(root); placeholder = null; }
    button.setAttribute('aria-pressed', 'false');
    button.setAttribute('aria-label', 'На весь экран');
  }
  button.addEventListener('click', async () => {
    if (placeholder) {
      if (document.fullscreenElement === root) await document.exitFullscreen().catch(() => {});
      close(); return;
    }
    placeholder = document.createElement('div');
    placeholder.style.height = `${root.offsetHeight}px`;
    root.replaceWith(placeholder); document.body.append(root);
    root.classList.add('fish-expanded');
    button.setAttribute('aria-pressed', 'true'); button.setAttribute('aria-label', 'Выйти из полного экрана');
    // Fixed viewport fallback also works in iPhone/Telegram without Fullscreen API.
    try { await root.requestFullscreen?.(); } catch { /* fixed viewport fallback */ }
  });
  document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement && placeholder) close(); });
  root.addEventListener('keydown', e => { if (e.key === 'Escape' && !document.fullscreenElement) close(); });
}
