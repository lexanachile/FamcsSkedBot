// Lock only while this catch is being saved, never across later catches.
export async function withCatchChoice(buttons, operation) {
  if (buttons.some(button => button.disabled)) return;
  buttons.forEach(button => { button.disabled = true; });
  try { return await operation(); }
  finally { buttons.forEach(button => { button.disabled = false; }); }
}

export function catchChoiceKeyframes(choice, start, end) {
  const dx = end.x - start.x, dy = end.y - start.y;
  const bend = choice === 'eat' ? -34 : 18;
  return [
    { transform: 'translate(0, 0) rotate(0deg) scale(1)', opacity: 1 },
    { offset: .48, transform: `translate(${dx * .5}px, ${dy * .38 + bend}px) rotate(${choice === 'eat' ? 12 : -9}deg) scale(.88)`, opacity: 1 },
    { transform: `translate(${dx}px, ${dy}px) rotate(${choice === 'eat' ? -18 : -28}deg) scale(${choice === 'eat' ? .16 : .52})`, opacity: 0 },
  ];
}

export function bindCatchChoiceInput(container, choose, now = () => Date.now()) {
  let lastContactAt = -Infinity;
  function activate(event) {
    const button = event.target.closest?.('[data-catch-choice]');
    if (!button || button.disabled) return;
    const at = now();
    if (at - lastContactAt < 500) return;
    lastContactAt = at;
    event.preventDefault?.(); choose(button.dataset.catchChoice);
  }
  container.addEventListener('pointerdown', event => {
    if (event.isPrimary === false || (event.pointerType === 'mouse' && event.button !== 0)) return;
    activate(event);
  }, { capture: true });
  container.addEventListener('touchstart', event => {
    if (event.touches && event.touches.length !== 1) return;
    activate(event);
  }, { capture: true, passive: false });
  container.addEventListener('click', activate);
}
