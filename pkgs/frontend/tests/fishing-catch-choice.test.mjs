import test from 'node:test';
import assert from 'node:assert/strict';
import { withCatchChoice } from '../src/fishing/catch-choice.js';

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
