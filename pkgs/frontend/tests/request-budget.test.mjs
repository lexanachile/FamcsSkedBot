import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
const tick = () => new Promise(resolve => setImmediate(resolve));
const source = file => readFileSync(new URL(file, import.meta.url), 'utf8')
  .replace(/^import .*;\r?\n/gm, '').replace(/export /g, '');
function browser() {
  let now = 1000000;
  const window = new EventTarget(), document = new EventTarget(), values = new Map(), timers = new Map(), intervals = [];
  document.hidden = false;
  return { window, document, timers, intervals, advance: ms => { now += ms; },
    Date: class extends Date { static now() { return now; } },
    localStorage: { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) },
    setTimeout(fn, ms) { const id = {}; timers.set(id, { fn, ms }); return id; }, clearTimeout(id) { timers.delete(id); },
    setInterval(fn, ms) { intervals.push({ fn, ms }); return intervals.length; }, clearInterval() {}, console,
  };
}
test('colors have no periodic reads during fishing; edits still upload and retry backs off', async () => {
  const env = browser(), calls = []; let fail = false;
  const context = vm.createContext({ ...env, accountHint: () => '1', accountRequest: async (path, body) => {
    calls.push({ path, body }); if (fail) throw new Error('offline');
    return { userId: 1, revision: 1, document: { colors: {}, recentColors: [] } };
  } });
  vm.runInContext(source('../src/cloud-colors.js') + '\nglobalThis.colors = setupCloudColors();', context);
  await tick(); assert.equal(calls.length, 1); assert.equal(env.intervals[0].ms, 600000);
  const visibility = new Event('fishing-visibility'); visibility.detail = true; env.window.dispatchEvent(visibility);
  env.advance(3600000); env.intervals[0].fn(); await tick(); assert.equal(calls.length, 1);
  context.colors.edit('lesson', '#123456');
  [...env.timers.values()].find(timer => timer.ms === 3000).fn(); await tick();
  assert.equal(calls.length, 3); assert.equal(calls[2].body.document.colors.lesson, '#123456');
  fail = true; context.colors.edit('lesson', '#abcdef');
  [...env.timers.values()].find(timer => timer.ms === 3000).fn(); await tick();
  assert.ok([...env.timers.values()].some(timer => timer.ms >= 20000));
  context.colors.stop();
});
test('game caches screens, deduplicates focus refreshes and skips periodic empty saves', async () => {
  const env = browser(), calls = [];
  const game = { wallet: { smallFish: 0 }, fish: {}, inventory: { rods: ['twig'], baits: {} }, equipped: { rod: 'twig', bait: null } };
  const request = async path => { calls.push(path); return { userId: 1, revision: 1, game, catalog: {}, cards: [], leaders: [] }; };
  const db = { transaction() {
    const tx = { objectStore: () => ({ getAll: () => ({ result: [] }) }) };
    queueMicrotask(() => tx.oncomplete()); return tx;
  } };
  const context = vm.createContext({ ...env, httpRequest: request, accountHint: () => '1', API_ROOT: 'http://localhost/api',
    createGameTransport: () => ({ request, close() {}, closeWhenIdle() {} }),
    indexedDB: { open() { const result = { result: db }; queueMicrotask(() => result.onsuccess()); return result; } },
  });
  vm.runInContext(source('../src/fishing/progress.js') + '\nglobalThis.progress = createProgress();', context);
  await context.progress.init();
  await Promise.all([context.progress.shop(), context.progress.shop()]);
  await context.progress.collection(); await context.progress.collection();
  await context.progress.leaderboard(); await context.progress.leaderboard();
  assert.deepEqual(calls, ['fishing/profile', 'fishing/shop', 'fishing/collection', 'fishing/leaderboard']);
  env.intervals[0].fn(); await tick(); assert.equal(calls.length, 4);
  env.advance(60001); env.window.dispatchEvent(new Event('focus')); env.document.dispatchEvent(new Event('visibilitychange'));
  await tick(); assert.equal(calls.filter(path => path === 'fishing/profile').length, 2);
  context.progress.setActive(false); env.advance(60001); env.window.dispatchEvent(new Event('focus'));
  await tick(); assert.equal(calls.filter(path => path === 'fishing/profile').length, 2);
});
