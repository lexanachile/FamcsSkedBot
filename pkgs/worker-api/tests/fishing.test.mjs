import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { createHmac } from 'node:crypto';
import { smallFishAmount } from '../src/fishing/rewards.ts';
import { build } from '../node_modules/esbuild/lib/main.js';
const bundle = await build({ entryPoints: [new URL('../src/index.ts', import.meta.url).pathname.replace(/^\/(\w:)/, '$1')], bundle: true, write: false, format: 'esm', platform: 'browser' });
const { default: app } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const secret = 'test-only-bot-token';
test('small fish reward follows the configured 55/30/10/4/1 percent bands', () => {
  assert.deepEqual([0, .5499, .55, .8499, .85, .9499, .95, .9899, .99, .9999].map(smallFishAmount), [1, 1, 2, 2, 3, 3, 4, 4, 5, 5]);
});
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
test('authenticated casts reserve one slot; receipts deduplicate and reject other users', async () => {
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
    assert.ok(['quick', 'fight'].includes(cast.traits.challenge));
    assert.equal(f.writes(), before + 1);
    const afterCast = f.writes();
    assert.equal((await f.request('fishing/reveal', { token: cast.token })).status, 409);
    now += cast.traits.challenge === 'quick' ? 3000 : 10000;
    const reveal = await (await f.request('fishing/reveal', { token: cast.token })).json();
    assert.equal(reveal.success, true);
    assert.equal(f.writes(), afterCast + 1);
    assert.equal((await f.request('fishing/sync', { receipts: [reveal.receipt] }, 2)).status, 400);
    assert.equal((await f.request('fishing/sync', { receipts: ['tampered'] })).status, 400);
    const saved = await (await f.request('fishing/sync', { receipts: [reveal.receipt], game: { wallet: { smallFish: 1000000 } } })).json();
    assert.equal(saved.revision, 2);
    const total = saved.game.wallet.smallFish + Object.values(saved.game.fish).reduce((sum, fish) => sum + fish.count, 0);
    assert.equal(total, reveal.catch.kind === 'small' ? reveal.catch.amount : 1);
    const writes = f.writes();
    const repeated = await (await f.request('fishing/sync', { receipts: [reveal.receipt] })).json();
    assert.equal(repeated.revision, 2);
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
test('a completed animation is never held behind the old thirty-second cast window', async () => {
  const f = fixture(); const realNow = Date.now; let now = Math.floor(realNow() / 4000) * 4000 + 1; Date.now = () => now;
  try {
    await f.request('fishing/profile');
    const first = await (await f.request('fishing/cast', { spot: 'deep' })).json();
    now += 3998;
    const retry = await (await f.request('fishing/cast', { spot: 'deep' })).json();
    assert.equal(retry.slot, first.slot);
    now += 2;
    const next = await (await f.request('fishing/cast', { spot: 'deep' })).json();
    assert.equal(next.slot, first.slot + 1);
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
    const receipts = []; let expectedReward = 0;
    for (let i = 0; i < 2; i++) {
      now += 30000;
      const cast = await (await f.request('fishing/cast', { spot: 'deep' })).json();
      now += 10000;
      const revealed = await (await f.request('fishing/reveal', { token: cast.token })).json();
      receipts.push(revealed.receipt); expectedReward += revealed.catch.kind === 'small' ? revealed.catch.amount : 1;
    }
    await Promise.all(receipts.map(receipt => f.request('fishing/sync', { receipts: [receipt] })));
    const profile = await (await f.request('fishing/profile')).json();
    assert.equal(profile.revision, 4);
    assert.equal(profile.game.wallet.smallFish + Object.values(profile.game.fish).reduce((s, f) => s + f.count, 0), expectedReward);
  } finally { Date.now = realNow; f.db.close(); }
});
test('shop purchase, equipment and bait consumption are atomic', async () => {
  const f = fixture(); const realNow = Date.now; let now = Math.floor(realNow() / 30000) * 30000 + 10; Date.now = () => now;
  try {
    await f.request('fishing/profile');
    f.db.prepare('UPDATE fishing_players SET game_json = ? WHERE telegram_id = 1').run(JSON.stringify({ schemaVersion: 1, savedAt: 0, wallet: { smallFish: 100 }, fish: {} }));
    const shop = await (await f.request('fishing/shop')).json();
    assert.equal(shop.catalog.rods.some(item => item.id === 'auto' && item.price === 500), true);
    assert.equal(shop.catalog.baits.find(item => item.id === 'crumbs').effects.rarePercent, 2);
    const rod = await (await f.request('fishing/shop/buy', { itemId: 'reed' })).json();
    assert.equal(rod.game.wallet.smallFish, 75);
    assert.equal(rod.game.inventory.rods.includes('reed'), true);
    assert.equal((await f.request('fishing/shop/buy', { itemId: 'reed' })).status, 409);
    const equipped = await (await f.request('fishing/loadout', { kind: 'rod', itemId: 'reed' })).json();
    assert.equal(equipped.game.equipped.rod, 'reed');
    const bait = await (await f.request('fishing/shop/buy', { itemId: 'crumbs' })).json();
    assert.equal(bait.game.wallet.smallFish, 67);
    assert.equal(bait.game.inventory.baits.crumbs, 1);
    await f.request('fishing/loadout', { kind: 'bait', itemId: 'crumbs' });
    const cast = await (await f.request('fishing/cast', { spot: 'deep' })).json();
    assert.equal(cast.usedBait, 'crumbs');
    assert.equal(cast.rod, 'reed');
    assert.equal(cast.game.inventory.baits.crumbs, 0);
    assert.equal(cast.game.equipped.bait, null);
    assert.equal(cast.traits.waitScale, .85);
    const writes = f.writes();
    const retry = await (await f.request('fishing/cast', { spot: 'deep' })).json();
    assert.equal(retry.usedBait, 'crumbs');
    assert.equal(f.writes(), writes);
    assert.equal((await f.request('fishing/shop/buy', { itemId: 'auto' })).status, 409);
    f.env.TEST_TELEGRAM_USER_ID = '1'; now += 30000;
    const dev = await (await f.request('fishing/cast', { spot: 'deep', devCatch: 'small', devRod: 'auto', devBait: 'glow' })).json();
    assert.equal(dev.rod, 'auto');
    assert.equal(dev.usedBait, 'glow');
    assert.equal(dev.game.inventory.baits.glow || 0, 0);
    assert.equal(dev.traits.challenge, 'auto');
    now += 30000;
    const rare = await (await f.request('fishing/cast', { spot: 'deep', devCatch: 'rare', devRod: 'auto' })).json();
    assert.equal(rare.traits.challenge, 'fight');
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
  assert.equal(b.phrases.every(phrase => phrase.locked && phrase.text === null), true);
  f.db.close();
});

test('a full collection still randomly draws teachers and accepts successive release/eat choices', async () => {
  const f = fixture(); f.env.TEST_TELEGRAM_USER_ID = '1';
  const realNow = Date.now; let now = realNow(); Date.now = () => now;
  try {
    await f.request('fishing/profile');
    f.db.prepare('UPDATE fishing_players SET game_json = ? WHERE telegram_id = 1').run(JSON.stringify({ wallet: { smallFish: 0 }, fish: {
      kalinin: { count: 1, firstCaughtAt: now, phrases: [0] },
      grekova: { count: 1, firstCaughtAt: now, phrases: [0, 1] },
    } }));
    const drawn = new Set();
    for (let i = 0; i < 40; i++) {
      now += 12000;
      const cast = await (await f.request('fishing/cast', { spot: 'deep', devCatch: 'rare' })).json();
      now += 10000;
      const revealed = await (await f.request('fishing/reveal', { token: cast.token })).json();
      assert.equal(revealed.duplicate, true); drawn.add(revealed.catch.id);
      const response = await f.request('fishing/resolve', { receipt: revealed.receipt, choice: i % 2 ? 'eat' : 'release' });
      assert.equal(response.status, 200);
      const saved = await response.json();
      assert.equal(saved.game.wallet.smallFish, Math.floor((i + 1) / 2));
      assert.deepEqual(saved.game.fish.grekova.phrases.sort(), [0, 1]);
    }
    assert.deepEqual([...drawn].sort(), ['grekova', 'kalinin']);
  } finally { Date.now = realNow; f.db.close(); }
});

test('teacher phrases unlock separately and repeated catches require one permanent choice', async () => {
  const f = fixture(); f.env.TEST_TELEGRAM_USER_ID = '1';
  const realNow = Date.now; let now = Math.floor(realNow() / 30000) * 30000 + 10; Date.now = () => now;
  try {
    await f.request('fishing/profile');
    async function catchRare() {
      now += 30000;
      const cast = await (await f.request('fishing/cast', { spot: 'deep', devCatch: 'rare' })).json();
      now += 10000;
      return (await (await f.request('fishing/reveal', { token: cast.token })).json());
    }
    let first;
    for (let i = 0; i < 40 && !first; i++) {
      const result = await catchRare();
      if (result.catch.id === 'grekova') first = result;
    }
    assert.ok(first); assert.equal(first.duplicate, false);
    assert.equal((await f.request('fishing/resolve', { receipt: first.receipt, choice: 'eat' })).status, 409);
    let collection = await (await f.request('fishing/collection')).json();
    let grekova = collection.cards.find(card => card.id === 'grekova');
    assert.equal(grekova.phrases.filter(phrase => !phrase.locked).length, 1);
    assert.equal(grekova.phrases.filter(phrase => phrase.locked).every(phrase => phrase.text === null), true);

    let released;
    for (let i = 0; i < 40 && !released; i++) {
      const result = await catchRare();
      if (result.catch.id !== 'grekova') continue;
      assert.equal(result.duplicate, true);
      const before = result.game.wallet.smallFish;
      const response = await (await f.request('fishing/resolve', { receipt: result.receipt, choice: 'release' })).json();
      assert.equal(response.game.wallet.smallFish, before);
      assert.ok(response.game.fish.grekova.count >= 2);
      assert.equal((await f.request('fishing/resolve', { receipt: result.receipt, choice: 'eat' })).status, 409);
      released = result;
    }
    assert.ok(released);

    for (let i = 0; i < 80; i++) {
      collection = await (await f.request('fishing/collection')).json();
      grekova = collection.cards.find(card => card.id === 'grekova');
      if (grekova.phrases.every(phrase => !phrase.locked)) break;
      const result = await catchRare();
      if (result.catch.id === 'grekova') await f.request('fishing/resolve', { receipt: result.receipt, choice: 'release' });
    }

    let eaten;
    for (let i = 0; i < 40 && !eaten; i++) {
      const result = await catchRare();
      if (result.catch.id !== 'grekova') continue;
      const before = result.game.wallet.smallFish;
      const firstChoice = await (await f.request('fishing/resolve', { receipt: result.receipt, choice: 'eat' })).json();
      const repeatedChoice = await (await f.request('fishing/resolve', { receipt: result.receipt, choice: 'eat' })).json();
      assert.equal(firstChoice.game.wallet.smallFish, before + 1);
      assert.equal(repeatedChoice.game.wallet.smallFish, before + 1);
      eaten = result;
    }
    assert.ok(eaten);
    collection = await (await f.request('fishing/collection')).json();
    grekova = collection.cards.find(card => card.id === 'grekova');
    assert.ok(grekova.phrases.some(phrase => phrase.text === 'Глазками'));
    assert.ok(grekova.phrases.some(phrase => phrase.text === 'Мальчик думает бабушка не видит.'));
  } finally { Date.now = realNow; f.db.close(); }
});
