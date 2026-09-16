import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeColors, acknowledgeEdits, buildColorDocument, stageLegacyColors } from '../src/cloud-colors.js';
import { projectedGame, requestRevealWithRetry } from '../src/fishing/progress.js';
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
test('legacy device colors and recent choices are included in the upload JSON', () => {
  const local = { document: { schemaVersion: 1, savedAt: 0, colors: {}, recentColors: [] }, pending: {}, seq: 0, recent: null };
  stageLegacyColors(local, { lesson: '#ABCDEF', broken: 'red' }, ['#123456', 'bad']);
  assert.deepEqual(buildColorDocument(local.document, local.pending, local.recent), {
    schemaVersion: 1, savedAt: 0, colors: { lesson: '#abcdef' }, recentColors: ['#123456'],
  });
});
test('legacy migration can be staged again after a server read without losing local colors', () => {
  const local = { document: { schemaVersion: 1, savedAt: 10, colors: { local: '#111111' }, recentColors: [] }, pending: {}, seq: 0, recent: null };
  stageLegacyColors(local, { local: '#111111' }, []);
  assert.deepEqual(local.pending, {});
  local.document = { schemaVersion: 1, savedAt: 0, colors: {}, recentColors: [] };
  stageLegacyColors(local, { local: '#111111' }, []);
  assert.equal(local.pending.local.value, '#111111');
});
test('ordinary fish add currency and a rare catch grants thirty common fish', () => {
  const base = { wallet: { smallFish: 5 }, fish: {} };
  const result = projectedGame(base, [
    { catch: { kind: 'small' } }, { catch: { kind: 'teacher', id: 'kalinin' }, caughtAt: 10 },
  ]);
  assert.equal(result.wallet.smallFish, 36);
  assert.equal(result.stats.totalCaught, 37);
  assert.deepEqual(result.fish.kalinin, { count: 1, firstCaughtAt: 10, phrases: [] });
  assert.deepEqual(base, { wallet: { smallFish: 5 }, fish: {} });
});
test('offline projection keeps a multi-fish catch amount', () => {
  const result = projectedGame({ wallet: { smallFish: 4 }, fish: {} }, [{ catch: { kind: 'small', amount: 5 } }]);
  assert.equal(result.wallet.smallFish, 9);
  assert.equal(result.stats.totalCaught, 9);
});

test('reveal retries temporary failures but not an invalid catch token', async () => {
  const waits = []; let calls = 0;
  const result = await requestRevealWithRetry(async () => {
    calls++;
    if (calls === 1) throw Object.assign(new Error('loot failed'), { status: 503 });
    if (calls === 2) throw Object.assign(new Error('not ready'), { status: 409 });
    return { success: true };
  }, async delay => { waits.push(delay); });
  assert.deepEqual(result, { success: true });
  assert.equal(calls, 3);
  assert.deepEqual(waits, [250, 500]);

  await assert.rejects(requestRevealWithRetry(async () => {
    throw Object.assign(new Error('invalid'), { status: 400 });
  }, async () => assert.fail('invalid tokens must not be retried')), /invalid/);
});
