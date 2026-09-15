import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { createHmac } from 'node:crypto';
import { build } from '../node_modules/esbuild/lib/main.js';
const bundle = await build({ entryPoints: [new URL('../src/index.ts', import.meta.url).pathname.replace(/^\/(\w:)/, '$1')], bundle: true, write: false, format: 'esm', platform: 'browser' });
const { default: app } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const secret = 'test-only-bot-token';
function auth(id = 1) {
  const params = new URLSearchParams({ auth_date: String(Math.floor(Date.now() / 1000)), user: JSON.stringify({ id, username: 'user' + id }) });
  const check = [...params].sort(([a], [b]) => a.localeCompare(b)).map(([k,v]) => k + '=' + v).join('\n');
  const key = createHmac('sha256', 'WebAppData').update(secret).digest();
  params.set('hash', createHmac('sha256', key).update(check).digest('hex'));
  return 'tma ' + params;
}
function fixture() {
  const db = new DatabaseSync(':memory:');
  db.exec(`CREATE TABLE fishing_players (
    telegram_id INTEGER PRIMARY KEY, username TEXT, revision INTEGER NOT NULL DEFAULT 0,
    game_json TEXT NOT NULL DEFAULT '{"schemaVersion":1,"savedAt":0,"wallet":{"smallFish":0},"fish":{}}',
    sync_json TEXT NOT NULL DEFAULT '{}');
    CREATE TABLE miniapp_colors (telegram_id INTEGER PRIMARY KEY, revision INTEGER NOT NULL DEFAULT 0,
    colors_json TEXT NOT NULL DEFAULT '{"schemaVersion":1,"savedAt":0,"colors":{},"recentColors":[]}');`);
  let writes = 0;
  const DB = { prepare(sql) {
    const wrap = args => ({
      bind: (...values) => wrap(values),
      first: async () => db.prepare(sql).get(...args) || null,
      all: async () => ({ results: db.prepare(sql).all(...args) }),
      run: async () => { const result = db.prepare(sql).run(...args); writes += Number(result.changes); return { meta: { changes: Number(result.changes) } }; },
    });
    return wrap([]);
  } };
  const env = { DB, TELEGRAM_BOT_TOKEN: secret, SCHEDULE_KV: new Proxy({}, { get() { throw new Error('Game must not access KV'); } }) };
  const request = (path, body, id = 1, method = body === undefined ? 'GET' : 'POST') => app.request('http://localhost/api/' + path, {
    method, headers: { Authorization: auth(id), 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  }, env);
  return { db, env, request, writes: () => writes };
}
test('authenticated casts use no storage; receipts deduplicate and reject other users', async () => {
  const f = fixture();
  const realNow = Date.now; let now = Math.floor(realNow() / 30000) * 30000 + 10;
  Date.now = () => now;
  try {
    assert.equal((await app.request('http://localhost/api/fishing/profile', {}, f.env)).status, 401);
    assert.equal((await f.request('fishing/profile')).status, 200);
    const before = f.writes();
    const cast = await (await f.request('fishing/cast', { spot: 'deep', location: 'crossing' })).json();
    assert.equal(cast.success, true);
    assert.equal(cast.catch, undefined);
    assert.equal(f.writes(), before);
    assert.equal((await f.request('fishing/reveal', { token: cast.token })).status, 409);
    now += 10000;
    const reveal = await (await f.request('fishing/reveal', { token: cast.token })).json();
    assert.equal(reveal.success, true);
    assert.equal(f.writes(), before);
    assert.equal((await f.request('fishing/sync', { receipts: [reveal.receipt] }, 2)).status, 400);
    assert.equal((await f.request('fishing/sync', { receipts: ['tampered'] })).status, 400);
    const saved = await (await f.request('fishing/sync', { receipts: [reveal.receipt], game: { wallet: { smallFish: 1000000 } } })).json();
    assert.equal(saved.revision, 1);
    const total = saved.game.wallet.smallFish + Object.values(saved.game.fish).reduce((sum, fish) => sum + fish.count, 0);
    assert.equal(total, 1);
    const writes = f.writes();
    const repeated = await (await f.request('fishing/sync', { receipts: [reveal.receipt] })).json();
    assert.equal(repeated.revision, 1);
    assert.equal(f.writes(), writes);
    // A second device retrieves the same draw in the same slot.
    const second = await (await f.request('fishing/cast', { spot: 'deep' })).json();
    now += 10000;
    const otherReceipt = await (await f.request('fishing/reveal', { token: second.token })).json();
    await f.request('fishing/sync', { receipts: [otherReceipt.receipt] });
    assert.equal(f.writes(), writes);
    assert.equal((await f.request('fishing/cast', { spot: 'deep', location: 'main' })).status, 400);
    now += 86400000;
    const expired = await (await f.request('fishing/sync', { receipts: [reveal.receipt] })).json();
    assert.deepEqual(expired.expired, [reveal.slot]);
    assert.equal(f.writes(), writes);
  } finally { Date.now = realNow; f.db.close(); }
});
test('colors reject stale versions and do not modify the game row', async () => {
  const f = fixture();
  const first = await (await f.request('colors')).json();
  assert.equal(first.revision, 0);
  const document = { schemaVersion: 1, colors: { 'analysis::common': '#abcdef' }, recentColors: [] };
  const saved = await (await f.request('colors', { revision: 0, document }, 1, 'PUT')).json();
  assert.equal(saved.revision, 1);
  assert.ok(saved.document.savedAt > 0);
  assert.equal((await f.request('colors', { revision: 0, document }, 1, 'PUT')).status, 409);
  assert.equal((await f.request('colors', { revision: 1, document: { ...document, colors: { a: 'bad' } } }, 1, 'PUT')).status, 400);
  assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM fishing_players').get().n, 0);
  const other = await (await f.request('colors', undefined, 2)).json();
  assert.deepEqual(other.document.colors, {});
  f.db.close();
});
test('concurrent reward batches merge instead of overwriting', async () => {
  const f = fixture(); const realNow = Date.now; let now = realNow(); Date.now = () => now;
  try {
    await f.request('fishing/profile');
    const receipts = [];
    for (let i = 0; i < 2; i++) {
      now += 30000;
      const cast = await (await f.request('fishing/cast', { spot: 'deep' })).json();
      now += 10000;
      receipts.push((await (await f.request('fishing/reveal', { token: cast.token })).json()).receipt);
    }
    await Promise.all(receipts.map(receipt => f.request('fishing/sync', { receipts: [receipt] })));
    const profile = await (await f.request('fishing/profile')).json();
    assert.equal(profile.revision, 2);
    assert.equal(profile.game.wallet.smallFish + Object.values(profile.game.fish).reduce((s, f) => s + f.count, 0), 2);
  } finally { Date.now = realNow; f.db.close(); }
});
test('collection hides unknown teachers and shows tags only below three owners', async () => {
  const f = fixture();
  for (let id = 1; id <= 4; id++) await f.request('fishing/profile', undefined, id);
  for (let id = 1; id <= 3; id++) {
    const fish = { kalinin: { count: 10 } };
    if (id < 3) fish.grekova = { count: 1 };
    f.db.prepare('UPDATE fishing_players SET game_json = ? WHERE telegram_id = ?').run(JSON.stringify({ schemaVersion: 1, savedAt: 0, wallet: { smallFish: 20 }, fish }), id);
  }
  const collection = await (await f.request('fishing/collection', undefined, 4)).json();
  const a = collection.cards.find(f => f.id === 'kalinin'), b = collection.cards.find(f => f.id === 'grekova');
  assert.equal(a.owners, 3); assert.deepEqual(a.usernames, []);
  assert.equal(b.owners, 2); assert.deepEqual(b.usernames, ['user1', 'user2']);
  assert.equal(a.locked, true); assert.equal(a.name, null); assert.equal(a.image, null);
  f.db.close();
});
