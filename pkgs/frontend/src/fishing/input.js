// Pointer input is scored anywhere on the scene on contact, never on release.
// Real controls are excluded so opening an overlay cannot score a strike.
export function bindStrikeInput(button, surface, root, hit, screenActive = () => !button.disabled, now = () => Date.now()) {
  const controls = 'button:not(.fish-action), select, input, a, .fish-help, .fish-dev-panel';
  let lastSource = '', lastContactAt = -Infinity;
  function contact(event, source) {
    if (button.disabled || !screenActive() || event.target.closest?.(controls)) return;
    const at = now();
    // Some iOS WebViews emit touchstart and pointerdown for one finger. Keep
    // rapid real taps, but collapse only the duplicate from the other API.
    if (source !== lastSource && at - lastContactAt < 80) return;
    lastSource = source; lastContactAt = at;
    if (event.cancelable !== false) event.preventDefault?.();
    hit();
  }
  surface.addEventListener('pointerdown', event => {
    if (event.isPrimary === false || (event.pointerType === 'mouse' && event.button !== 0)) return;
    contact(event, 'pointer');
  }, { capture: true });
  surface.addEventListener('touchstart', event => {
    if (event.touches && event.touches.length !== 1) return;
    contact(event, 'touch');
  }, { capture: true, passive: false });
  button.addEventListener('click', event => {
    if (event.detail === 0 && !button.disabled) hit();
  });
  root.addEventListener('keydown', event => {
    if (event.code !== 'Space' || event.target.closest('select, .fish-dev-toggle, .fish-help-toggle, .fish-help-close, .fish-again, .fish-map-return, [data-location], [data-spot]')) return;
    event.preventDefault();
    if (!event.repeat && !button.disabled) hit();
  });
  // Suppress the native Space keyup click after our keydown strike.
  root.addEventListener('keyup', event => {
    if (event.code === 'Space' && event.target === button) event.preventDefault();
  });
}
