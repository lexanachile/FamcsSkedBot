import test from 'node:test';
import assert from 'node:assert/strict';
import { bindCatchChoiceInput, withCatchChoice } from '../src/fishing/catch-choice.js';
import { ownerLine } from '../src/fishing/collection.js';

test('release and eat remain clickable on every subsequent catch', async () => {
  const buttons = [{ disabled: false }, { disabled: false }];
  const choices = [];
  for (const choice of ['release', 'eat', 'release', 'eat']) {
    await withCatchChoice(buttons, async () => {
      assert.ok(buttons.every(button => button.disabled));
      choices.push(choice);
    });
    assert.ok(buttons.every(button => !button.disabled));
  }
  assert.deepEqual(choices, ['release', 'eat', 'release', 'eat']);
});

test('a failed save can be retried and rapid double taps save only once', async () => {
  const buttons = [{ disabled: false }, { disabled: false }];
  await assert.rejects(withCatchChoice(buttons, async () => { throw new Error('offline'); }));
  assert.ok(buttons.every(button => !button.disabled));
  let finish, calls = 0;
  const first = withCatchChoice(buttons, () => { calls++; return new Promise(resolve => { finish = resolve; }); });
  await withCatchChoice(buttons, async () => { calls++; });
  assert.equal(calls, 1);
  finish(); await first;
  assert.ok(buttons.every(button => !button.disabled));
});

test('catch choices fire on touch contact and suppress the duplicate pointer event', () => {
  const handlers = {}, options = {}, choices = []; let clock = 1000;
  const container = { addEventListener(name, handler, value) { handlers[name] = handler; options[name] = value; } };
  const button = { disabled: false, dataset: { catchChoice: 'eat' } };
  const target = { closest: () => button };
  bindCatchChoiceInput(container, choice => choices.push(choice), () => clock);
  handlers.touchstart({ target, touches: [{}], preventDefault() {} });
  clock += 10; handlers.pointerdown({ target, pointerType: 'touch', isPrimary: true, button: 0, preventDefault() {} });
  assert.deepEqual(choices, ['eat']);
  assert.deepEqual(options.touchstart, { capture: true, passive: false });
});

test('owner line shows five sampled tags and the remaining player count', () => {
  assert.equal(ownerLine({ owners: 8, usernames: ['a', 'b', 'c', 'd', 'e'] }), 'Есть у @a, @b, @c, @d, @e + 3 рыбаков');
  assert.equal(ownerLine({ owners: 2, usernames: ['a', null] }), 'Есть у @a, Рыбак без тега');
});
