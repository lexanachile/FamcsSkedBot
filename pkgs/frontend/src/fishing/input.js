// Pointer input is scored on contact, never on release. Keyboard/assistive
// clicks still work; the click generated after pointerdown must not score twice.
export function bindStrikeInput(button, root, hit) {
  button.addEventListener('pointerdown', event => {
    if (!event.isPrimary || event.button !== 0 || button.disabled) return;
    event.preventDefault();
    hit();
  });
  button.addEventListener('click', event => {
    if (event.detail === 0 && !button.disabled) hit();
  });
  root.addEventListener('keydown', event => {
    if (event.code !== 'Space' || event.target.closest('select, .fish-fullscreen, .fish-dev-toggle, .fish-help-toggle, .fish-again, .fish-map-return, [data-location], [data-spot]')) return;
    event.preventDefault();
    if (!event.repeat && !button.disabled) hit();
  });
  // Suppress the native Space keyup click after our keydown strike.
  root.addEventListener('keyup', event => {
    if (event.code === 'Space' && event.target === button) event.preventDefault();
  });
}
