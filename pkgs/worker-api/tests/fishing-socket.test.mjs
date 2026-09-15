import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { build } from '../node_modules/esbuild/lib/main.js';
import { Miniflare } from '../node_modules/miniflare/dist/src/index.js';

test('real Worker WebSocket authenticates, saves, deduplicates and restricts routes', { timeout: 30000 }, async () => {
  const bundle = await build({ entryPoints: [new URL('../src/index.ts', import.meta.url).pathname.replace(/^\/(\w:)/, '$1')], bundle: true, write: false, format: 'esm', platform: 'browser' });
  const secret = 'local-test-only';
  const mf = new Miniflare({ modules: true, script: bundle.outputFiles[0].text, compatibilityDate: '2024-11-01',
    bindings: { TELEGRAM_BOT_TOKEN: secret }, d1Databases: ['DB'] });
  let ws;
  try {
    const db = await mf.getD1Database('DB');
    await db.exec(`CREATE TABLE fishing_players (telegram_id INTEGER PRIMARY KEY, username TEXT, revision INTEGER NOT NULL DEFAULT 0, game_json TEXT NOT NULL DEFAULT '{"wallet":{"smallFish":100},"fish":{}}', sync_json TEXT NOT NULL DEFAULT '{}');`);
    const params = new URLSearchParams({ auth_date: String(Math.floor(Date.now() / 1000)), user: JSON.stringify({ id: 1, username: 'test' }) });
    const check = [...params].sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => k + '=' + v).join('\n');
    params.set('hash', createHmac('sha256', createHmac('sha256', 'WebAppData').update(secret).digest()).update(check).digest('hex'));
    const response = await mf.dispatchFetch('http://localhost/api/fishing/socket', { headers: { Upgrade: 'websocket', Origin: 'https://famcs.online' } });
    assert.equal(response.status, 101); ws = response.webSocket; ws.accept();
    function exchange(message) {
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => { ws.removeEventListener('message', receive); reject(new Error('No socket response')); }, 5000);
        function receive(event) { clearTimeout(timer); ws.removeEventListener('message', receive); resolve(JSON.parse(event.data)); }
        ws.addEventListener('message', receive); ws.send(JSON.stringify(message));
      });
    }
    assert.equal((await exchange({ type: 'auth', initData: String(params) })).type, 'ready');
    assert.equal((await exchange({ id: 1, path: 'fishing/profile', method: 'GET' })).data.game.wallet.smallFish, 100);
    const body = { itemId: 'crumbs', requestId: 'test-purchase-00000001' };
    const first = await exchange({ id: 2, path: 'fishing/shop/buy', method: 'POST', body });
    const second = await exchange({ id: 3, path: 'fishing/shop/buy', method: 'POST', body });
    assert.equal(first.status, 200); assert.equal(first.data.game.wallet.smallFish, 92);
    assert.equal(second.data.game.wallet.smallFish, 92); assert.equal(second.data.game.inventory.baits.crumbs, 1);
    assert.equal(second.data.game._purchases, undefined);
    const cast = await exchange({ id: 4, path: 'fishing/cast', method: 'POST', body: { spot: 'deep', devCatch: 'small' } });
    assert.equal(cast.status, 200);
    await new Promise(resolve => setTimeout(resolve, 2600));
    const reveal = await exchange({ id: 5, path: 'fishing/reveal', method: 'POST', body: { token: cast.data.token } });
    assert.equal(reveal.status, 200);
    const repeated = await exchange({ id: 6, path: 'fishing/reveal', method: 'POST', body: { token: cast.data.token } });
    assert.equal(repeated.data.game.wallet.smallFish, reveal.data.game.wallet.smallFish);
    assert.ok(reveal.data.game.wallet.smallFish > 92);
    const profile = await mf.dispatchFetch('http://localhost/api/fishing/profile', { headers: { Authorization: 'tma ' + params } });
    assert.equal((await profile.json()).game.wallet.smallFish, reveal.data.game.wallet.smallFish);
    const closed = new Promise(resolve => ws.addEventListener('close', resolve, { once: true }));
    ws.send(JSON.stringify({ id: 7, path: 'schedule/import', method: 'POST', body: {} }));
    assert.equal((await closed).code, 1008);
  } finally {
    ws?.close();
    await mf.dispose();
  }
});
