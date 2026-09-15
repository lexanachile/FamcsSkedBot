// Pointer input is scored anywhere on the scene on contact, never on release.
// Real controls are excluded so opening an overlay cannot score a strike.
export function bindStrikeInput(button, surface, root, hit, screenActive = () => !button.disabled) {
  surface.addEventListener('pointerdown', event => {
    if (!event.isPrimary || event.button !== 0 || button.disabled || !screenActive()) return;
    if (event.target.closest?.('button:not(.fish-action), select, input, a, .fish-help, .fish-dev-panel')) return;
    event.preventDefault();
    hit();
  });
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
