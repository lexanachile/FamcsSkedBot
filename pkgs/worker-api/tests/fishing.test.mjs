import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { createHmac } from 'node:crypto';
import { rareCatchChance, smallFishAmount } from '../src/fishing/rewards.ts';
import { fishingCatalog, pickFishingCandidate } from '../src/fishing/catalog.ts';
import { build } from '../node_modules/esbuild/lib/main.js';
const bundle = await build({ entryPoints: [new URL('../src/index.ts', import.meta.url).pathname.replace(/^\/(\w:)/, '$1')], bundle: true, write: false, format: 'esm', platform: 'browser' });
const { default: app } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const secret = 'test-only-bot-token';

test('socket rejects ordinary HTTP and untrusted origins before upgrade', async () => {
  assert.equal((await app.request('http://localhost/api/fishing/socket')).status, 426);
  assert.equal((await app.request('http://localhost/api/fishing/socket', {
    headers: { Upgrade: 'websocket', Origin: 'https://evil.example' },
  })).status, 403);
});
test('small fish reward follows the configured 55/30/10/4/1 percent bands', () => {
  assert.deepEqual([0, .5499, .55, .8499, .85, .9499, .95, .9899, .99, .9999].map(smallFishAmount), [1, 1, 2, 2, 3, 3, 4, 4, 5, 5]);
});
test('rare chance gains one percentage point per common catch and stays capped', () => {
  assert.equal(rareCatchChance(.12, 0, 0), .12);
  assert.ok(Math.abs(rareCatchChance(.12, .05, 3) - .20) < 1e-12);
  assert.equal(rareCatchChance(.12, .10, 83), .95);
});
test('Vaskovsky is the rarest and hardest teacher fish', () => {
  const byId = Object.fromEntries(fishingCatalog.map(fish => [fish.id, fish]));
  assert.deepEqual(fishingCatalog.map(fish => fish.id), ['kalinin', 'grekova', 'kastrica', 'orlovich', 'vaskovsky']);
  assert.equal(byId.vaskovsky.name, 'Васьковский М.М.');
  assert.deepEqual(byId.vaskovsky.phrases, ['Неочевидно', 'ИСУ жил, жив и будет жить.']);
  assert.deepEqual(byId.kastrica.phrases, ['Вы опустились до уровня ваших штанов']);
  assert.equal(byId.orlovich.name, 'Орлович Ю.Л.');
  assert.deepEqual(byId.orlovich.phrases, ['Граф.']);
  assert.ok(byId.vaskovsky.rarityWeight < Math.min(...fishingCatalog.filter(fish => fish.id !== 'vaskovsky').map(fish => fish.rarityWeight)));
  assert.ok(byId.vaskovsky.fightPassScale < Math.min(...fishingCatalog.filter(fish => fish.id !== 'vaskovsky').map(fish => fish.fightPassScale)));
  assert.ok(byId.vaskovsky.fightZoneScale < Math.min(...fishingCatalog.filter(fish => fish.id !== 'vaskovsky').map(fish => fish.fightZoneScale)));
  assert.ok(byId.vaskovsky.drift > Math.max(...fishingCatalog.filter(fish => fish.id !== 'vaskovsky').map(fish => fish.drift)));
  assert.equal(pickFishingCandidate(fishingCatalog, 0)?.id, 'kalinin');
  assert.equal(pickFishingCandidate(fishingCatalog, 1)?.id, 'vaskovsky');
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
  let writes = 0, aggregateQueries = 0;
  const DB = { prepare(sql) {
    const wrap = args => ({
      bind: (...values) => wrap(values),
      first: async () => db.prepare(sql).get(...args) || null,
      all: async () => { aggregateQueries++; return { results: db.prepare(sql).all(...args) }; },
      run: async () => { const result = db.prepare(sql).run(...args); writes += Number(result.changes); return { meta: { changes: Number(result.changes) } }; },
    });
    return wrap([]);
  } };
  const env = { DB, TELEGRAM_BOT_TOKEN: secret, SCHEDULE_KV: new Proxy({}, { get() { throw new Error('Game must not access KV'); } }) };
  const request = (path, body, id = 1, method = body === undefined ? 'GET' : 'POST', origin = 'http://localhost') => app.request(origin + '/api/' + path, {
    method, headers: { Authorization: auth(id), 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  }, env);
  return { db, env, request, writes: () => writes, aggregateQueries: () => aggregateQueries };
}

test('collection aggregates share one SQL query; personal unlocks never share cache', async () => {
  const f = fixture();
  try {
    for (let id = 1; id <= 7; id++) {
      const game = { wallet: { smallFish: id }, fish: { kalinin: { count: 1, phrases: [0, 0] } } };
      f.db.prepare('INSERT INTO fishing_players (telegram_id, username, game_json) VALUES (?, ?, ?)').run(id, 'user' + id, JSON.stringify(game));
    }
    const first = await (await f.request('fishing/collection')).json();
    const phrase = first.cards.find(card => card.id === 'kalinin').phrases[0];
    assert.equal(phrase.owners, 7); assert.equal(phrase.usernames.length, 5);
    assert.equal(new Set(phrase.usernames).size, 5);
    const stranger = await (await f.request('fishing/collection', undefined, 8)).json();
    assert.equal(stranger.cards.find(card => card.id === 'kalinin').phrases[0].text, null);
    assert.equal(f.aggregateQueries(), 1);
    const rank1 = await (await f.request('fishing/leaderboard')).json();
    const rank2 = await (await f.request('fishing/leaderboard', undefined, 2)).json();
    assert.equal(rank1.me.username, 'user1'); assert.equal(rank2.me.username, 'user2');
    assert.equal(f.aggregateQueries(), 2);
  } finally { f.db.close(); }
});
test('dev options work locally and stay restricted on the deployed host', async () => {
  const f = fixture();
  const localProfile = await (await f.request('fishing/profile')).json();
  assert.equal(localProfile.devEnabled, true);

  const productionOrigin = 'https://schedule.example';
  const productionProfile = await (await f.request('fishing/profile', undefined, 1, 'GET', productionOrigin)).json();
  assert.equal(productionProfile.devEnabled, false);
  const ignored = await (await f.request('fishing/cast', { spot: 'deep', devCatch: 'small', devRod: 'auto', devBait: 'glow' }, 1, 'POST', productionOrigin)).json();
  assert.equal(ignored.rod, 'twig');
  assert.equal(ignored.usedBait, null);

  f.env.TEST_TELEGRAM_USER_ID = '1';
  const enabled = await (await f.request('fishing/cast', { spot: 'deep', devCatch: 'small', devRod: 'auto', devBait: 'glow' }, 1, 'POST', productionOrigin)).json();
  assert.equal(enabled.rod, 'auto');
  assert.equal(enabled.usedBait, 'glow');
  f.db.close();
});
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
    assert.equal(total, reveal.catch.kind === 'small' ? reveal.catch.amount : 31);
    assert.equal(saved.game.stats.totalCaught, total);
    const writes = f.writes();
    const repeated = await (await f.request('fishing/sync', { receipts: [reveal.receipt] })).json();
    assert.equal(repeated.revision, 2);
    assert.equal(repeated.game.stats.totalCaught, total);
    assert.equal(f.writes(), writes);
    // A later cycle may be a new slot; reveal saves it and legacy sync must not save it twice.
    const second = await (await f.request('fishing/cast', { spot: 'deep' })).json();
    now += 10000;
    const otherReceipt = await (await f.request('fishing/reveal', { token: second.token })).json();
    const afterSecondReveal = f.writes();
    await f.request('fishing/sync', { receipts: [otherReceipt.receipt] });
    assert.equal(f.writes(), afterSecondReveal);
    assert.equal((await f.request('fishing/cast', { spot: 'deep', location: 'main' })).status, 400);
    now += 86400000;
    const expired = await (await f.request('fishing/sync', { receipts: [reveal.receipt] })).json();
    assert.deepEqual(expired.expired, [reveal.slot]);
    assert.equal(f.writes(), afterSecondReveal);
  } finally { Date.now = realNow; f.db.close(); }
});
test('caught common fish build the rare streak and a caught rare fish resets it', async () => {
  const f = fixture(); f.env.TEST_TELEGRAM_USER_ID = '1';
  const realNow = Date.now; let now = Math.floor(realNow() / 4000) * 4000; Date.now = () => now;
  const stored = () => JSON.parse(f.db.prepare('SELECT game_json FROM fishing_players WHERE telegram_id = 1').get().game_json);
  try {
    await f.request('fishing/profile');
    for (let expected = 1; expected <= 2; expected++) {
      now += 5000;
      const cast = await (await f.request('fishing/cast', { spot: 'deep', devCatch: 'small' })).json();
      now += 3000;
      await f.request('fishing/reveal', { token: cast.token });
      assert.equal(stored()._commonCatchStreak, expected);
    }
    const walletBeforeRare = stored().wallet.smallFish;
    const totalBeforeRare = stored().stats.totalCaught;
    now += 5000;
    const rare = await (await f.request('fishing/cast', { spot: 'deep', devCatch: 'rare' })).json();
    now += 10000;
    await f.request('fishing/reveal', { token: rare.token });
    assert.equal(stored()._commonCatchStreak, 0);
    assert.equal(stored().wallet.smallFish, walletBeforeRare + 30);
    assert.equal(stored().stats.totalCaught, totalBeforeRare + 31);
    const profile = await (await f.request('fishing/profile')).json();
    assert.equal('_commonCatchStreak' in profile.game, false);
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
test('leaderboard ranks spendable fish balances instead of lifetime catch totals', async () => {
  const f = fixture();
  for (let id = 1; id <= 3; id++) await f.request('fishing/profile', undefined, id);
  f.db.prepare('UPDATE fishing_players SET game_json = ? WHERE telegram_id = 1').run(JSON.stringify({ wallet: { smallFish: 3 }, fish: { kalinin: { count: 2, phrases: [0] } } }));
  f.db.prepare('UPDATE fishing_players SET game_json = ? WHERE telegram_id = 2').run(JSON.stringify({ wallet: { smallFish: 0 }, stats: { totalCaught: 12 }, fish: {} }));
  f.db.prepare('UPDATE fishing_players SET game_json = ? WHERE telegram_id = 3').run(JSON.stringify({ wallet: { smallFish: 1 }, stats: { totalCaught: 7 }, fish: {} }));
  const result = await (await f.request('fishing/leaderboard', undefined, 1)).json();
  assert.deepEqual(result.leaders.map(row => [row.position, row.username, row.totalCaught]), [[1, 'user1', 3], [2, 'user3', 1]]);
  assert.deepEqual(result.me, { position: 1, username: 'user1', totalCaught: 3 });
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
      receipts.push(revealed.receipt); expectedReward += revealed.catch.kind === 'small' ? revealed.catch.amount : 31;
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
    assert.equal(rod.game.stats.totalCaught, 100);
    assert.equal(rod.game.inventory.rods.includes('reed'), true);
    assert.equal((await f.request('fishing/shop/buy', { itemId: 'reed' })).status, 409);
    const equipped = await (await f.request('fishing/loadout', { kind: 'rod', itemId: 'reed' })).json();
    assert.equal(equipped.game.equipped.rod, 'reed');
    const bait = await (await f.request('fishing/shop/buy', { itemId: 'crumbs' })).json();
    assert.equal(bait.game.wallet.smallFish, 67);
    assert.equal(bait.game.stats.totalCaught, 100);
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
    const changed = await (await f.request('fishing/cast', { spot: 'deep', devCatch: 'small', devRod: 'auto' })).json();
    assert.equal(changed.slot, rare.slot);
    assert.equal(changed.traits.challenge, 'auto');
  } finally { Date.now = realNow; f.db.close(); }
});
test('collection counts owners and samples tags separately for every phrase', async () => {
  const f = fixture();
  for (let id = 1; id <= 8; id++) await f.request('fishing/profile', undefined, id);
  for (let id = 1; id <= 7; id++) {
    const fish = { kalinin: id === 7 ? { count: 10 } : { count: 10, phrases: [0] } };
    if (id <= 6) fish.grekova = { count: 1, phrases: id <= 2 ? [0, 1] : [0] };
    f.db.prepare('UPDATE fishing_players SET game_json = ? WHERE telegram_id = ?').run(JSON.stringify({ schemaVersion: 1, savedAt: 0, wallet: { smallFish: 20 }, fish }), id);
  }
  const collection = await (await f.request('fishing/collection', undefined, 1)).json();
  const a = collection.cards.find(f => f.id === 'kalinin'), b = collection.cards.find(f => f.id === 'grekova');
  assert.equal('owners' in a, false); assert.equal('usernames' in a, false);
  assert.equal(a.phrases[0].owners, 7); assert.equal(a.phrases[0].usernames.length, 5);
  assert.equal(a.phrases[0].usernames.every(name => /^user[1-7]$/.test(name)), true);
  assert.equal(b.phrases[0].owners, 6); assert.equal(b.phrases[0].usernames.length, 5);
  assert.equal(b.phrases[1].owners, 2); assert.equal(b.phrases[1].usernames.length, 2);
  assert.equal(b.phrases[1].usernames.every(name => /^user[1-2]$/.test(name)), true);

  const hidden = await (await f.request('fishing/collection', undefined, 8)).json();
  for (const card of hidden.cards) for (const phrase of card.phrases) {
    assert.equal(phrase.locked, true); assert.equal(phrase.text, null);
    assert.equal(phrase.owners, 0); assert.deepEqual(phrase.usernames, []);
  }
  f.db.close();
});

test('rare catches prioritize unopened teacher phrases before returning to the full random pool', async () => {
  const f = fixture(); f.env.TEST_TELEGRAM_USER_ID = '1';
  const realNow = Date.now; let now = realNow(); Date.now = () => now;
  try {
    await f.request('fishing/profile');
    const caught = [];
    const phraseCount = fishingCatalog.reduce((sum, fish) => sum + fish.phrases.length, 0);
    for (let i = 0; i < phraseCount + 1; i++) {
      now += 12000;
      const cast = await (await f.request('fishing/cast', { spot: 'deep', devCatch: 'rare' })).json();
      now += 10000;
      const revealed = await (await f.request('fishing/reveal', { token: cast.token })).json();
      caught.push({ ...revealed, traits: cast.traits });
    }
    const prioritized = caught.slice(0, phraseCount);
    assert.equal(new Set(prioritized.map(result => result.catch.id)).size, fishingCatalog.length);
    assert.equal(new Set(prioritized.map(result => `${result.catch.id}:${result.catch.phraseId}`)).size, phraseCount);
    assert.equal(prioritized.filter(result => result.duplicate).length, phraseCount - fishingCatalog.length);
    const vaskovsky = prioritized.find(result => result.catch.id === 'vaskovsky');
    const others = prioritized.filter(result => result.catch.id !== 'vaskovsky');
    assert.ok(vaskovsky.traits.passMs < Math.min(...others.map(result => result.traits.passMs)));
    assert.ok(vaskovsky.traits.zoneScale < Math.min(...others.map(result => result.traits.zoneScale)));
    assert.ok(vaskovsky.traits.drift > Math.max(...others.map(result => result.traits.drift)));
    assert.equal(caught[phraseCount].duplicate, true);
    assert.ok(fishingCatalog.some(fish => fish.id === caught[phraseCount].catch.id));
  } finally { Date.now = realNow; f.db.close(); }
});

test('a teacher with one missing phrase is selected and reveals that phrase next', async () => {
  const f = fixture(); f.env.TEST_TELEGRAM_USER_ID = '1';
  const realNow = Date.now; let now = realNow(); Date.now = () => now;
  try {
    await f.request('fishing/profile');
    f.db.prepare('UPDATE fishing_players SET game_json = ? WHERE telegram_id = 1').run(JSON.stringify({ wallet: { smallFish: 0 }, fish: {
      kalinin: { count: 1, firstCaughtAt: now, phrases: [0] },
      grekova: { count: 1, firstCaughtAt: now, phrases: [0] },
      kastrica: { count: 1, firstCaughtAt: now, phrases: [0] },
      orlovich: { count: 1, firstCaughtAt: now, phrases: [0] },
      vaskovsky: { count: 1, firstCaughtAt: now, phrases: [0, 1] },
    } }));
    now += 12000;
    const cast = await (await f.request('fishing/cast', { spot: 'deep', devCatch: 'rare' })).json();
    now += 10000;
    const revealed = await (await f.request('fishing/reveal', { token: cast.token })).json();
    assert.equal(revealed.catch.id, 'grekova');
    assert.equal(revealed.catch.phraseId, 1);
    assert.equal(revealed.duplicate, true);
    assert.deepEqual(revealed.game.fish.grekova.phrases.sort(), [0, 1]);
  } finally { Date.now = realNow; f.db.close(); }
});

test('a full collection still randomly draws teachers and accepts successive release/eat choices', async () => {
  const f = fixture(); f.env.TEST_TELEGRAM_USER_ID = '1';
  const realNow = Date.now; let now = realNow(); Date.now = () => now;
  try {
    await f.request('fishing/profile');
    f.db.prepare('UPDATE fishing_players SET game_json = ? WHERE telegram_id = 1').run(JSON.stringify({ wallet: { smallFish: 0 }, fish: {
      kalinin: { count: 1, firstCaughtAt: now, phrases: [0] },
      grekova: { count: 1, firstCaughtAt: now, phrases: [0, 1] },
      kastrica: { count: 1, firstCaughtAt: now, phrases: [0] },
      orlovich: { count: 1, firstCaughtAt: now, phrases: [0] },
      vaskovsky: { count: 1, firstCaughtAt: now, phrases: [0] },
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
      assert.equal(saved.game.wallet.smallFish, 30 * (i + 1) + Math.floor((i + 1) / 2));
      assert.deepEqual(saved.game.fish.grekova.phrases.sort(), [0, 1]);
    }
    assert.equal([...drawn].every(id => fishingCatalog.some(fish => fish.id === id)), true);
    assert.ok(drawn.size >= 2);
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
