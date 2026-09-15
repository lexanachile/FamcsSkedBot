// Lock only while this catch is being saved, never across later catches.
export async function withCatchChoice(buttons, operation) {
  if (buttons.some(button => button.disabled)) return;
  buttons.forEach(button => { button.disabled = true; });
  try { return await operation(); }
  finally { buttons.forEach(button => { button.disabled = false; }); }
}

export function bindCatchChoiceInput(container, choose, now = () => Date.now()) {
  let lastSource = '', lastContactAt = -Infinity;
  function activate(event, source) {
    const button = event.target.closest?.('[data-catch-choice]');
    if (!button || button.disabled) return;
    const at = now();
    if (source !== lastSource && at - lastContactAt < 80) return;
    lastSource = source; lastContactAt = at;
    event.preventDefault?.(); choose(button.dataset.catchChoice);
  }
  container.addEventListener('pointerdown', event => {
    if (event.isPrimary === false || (event.pointerType === 'mouse' && event.button !== 0)) return;
    activate(event, 'pointer');
  }, { capture: true });
  container.addEventListener('touchstart', event => {
    if (event.touches && event.touches.length !== 1) return;
    activate(event, 'touch');
  }, { capture: true, passive: false });
  container.addEventListener('click', event => { if (event.detail === 0) activate(event, 'keyboard'); });
}
