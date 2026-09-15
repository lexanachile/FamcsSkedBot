// Lock only while this catch is being saved, never across later catches.
export async function withCatchChoice(buttons, operation) {
  if (buttons.some(button => button.disabled)) return;
  buttons.forEach(button => { button.disabled = true; });
  try { return await operation(); }
  finally { buttons.forEach(button => { button.disabled = false; }); }
}
