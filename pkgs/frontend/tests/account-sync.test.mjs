import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeColors, acknowledgeEdits } from '../src/cloud-colors.js';
import { projectedGame } from '../src/fishing/progress.js';
test('remote colors merge with pending edits and explicit deletions', () => {
  assert.deepEqual(mergeColors({ a: '#111111', b: '#222222', c: '#333333' }, {
    a: { value: '#abcdef', seq: 1 }, b: { value: null, seq: 2 },
  }), { a: '#abcdef', c: '#333333' });
});
test('late save acknowledgement cannot clear newer local edits', () => {
  const pending = { a: { value: '#111111', seq: 2 }, b: { value: null, seq: 1 } };
  acknowledgeEdits(pending, { a: { value: '#000000', seq: 1 }, b: { value: null, seq: 1 } });
  assert.deepEqual(pending, { a: { value: '#111111', seq: 2 } });
});
test('ordinary fish add currency; teachers replace them without adding currency', () => {
  const base = { wallet: { smallFish: 5 }, fish: {} };
  const result = projectedGame(base, [
    { catch: { kind: 'small' } }, { catch: { kind: 'teacher', id: 'kalinin' }, caughtAt: 10 },
  ]);
  assert.equal(result.wallet.smallFish, 6);
  assert.deepEqual(result.fish.kalinin, { count: 1, firstCaughtAt: 10 });
  assert.deepEqual(base, { wallet: { smallFish: 5 }, fish: {} });
});
