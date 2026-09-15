import test from 'node:test';
import assert from 'node:assert/strict';
import { createGameTransport } from '../src/fishing/transport.js';

function fixture() {
  const sockets = [], http = [];
  class Socket extends EventTarget {
    readyState = 0; sent = [];
    constructor() { super(); sockets.push(this); queueMicrotask(() => { this.readyState = 1; this.dispatchEvent(new Event('open')); }); }
    send(raw) { const data = JSON.parse(raw); this.sent.push(data); if (data.type === 'auth') queueMicrotask(() => this.reply({ type: 'ready' })); }
    reply(data) { this.dispatchEvent(new MessageEvent('message', { data: JSON.stringify(data) })); }
    close() { if (this.readyState === 3) return; this.readyState = 3; this.dispatchEvent(new Event('close')); }
  }
  const transport = createGameTransport({ url: 'ws://test', credentials: () => 'test', Socket,
    http: async (...args) => { http.push(args); return { fallback: true }; } });
  return { transport, sockets, http };
}
const tick = () => new Promise(resolve => setImmediate(resolve));
test('many commands share a socket; replies match IDs and HTTP is unused', async () => {
  const f = fixture();
  try {
    const first = f.transport.request('fishing/profile');
    const second = f.transport.request('fishing/shop');
    await tick();
    assert.equal(f.sockets.length, 1);
    const ws = f.sockets[0];
    ws.reply({ id: 2, status: 200, data: { shop: true } });
    ws.reply({ id: 1, status: 200, data: { profile: true } });
    assert.deepEqual(await first, { profile: true });
    assert.deepEqual(await second, { shop: true });
    assert.equal(f.http.length, 0);
  } finally { f.transport.close(); }
});
test('a lost mutation response is not replayed over HTTP; next command reconnects', async () => {
  const f = fixture();
  try {
    const buy = f.transport.request('fishing/shop/buy', { itemId: 'bait' });
    const rejected = assert.rejects(buy, /прервано/);
    await tick(); f.sockets[0].close(); await rejected;
    assert.equal(f.http.length, 0);
    const profile = f.transport.request('fishing/profile'); await tick();
    assert.equal(f.sockets.length, 2);
    f.sockets[1].reply({ id: 2, status: 200, data: { saved: true } });
    assert.deepEqual(await profile, { saved: true });
  } finally { f.transport.close(); }
});
test('socket unavailable falls back before sending and uses a cooldown', async () => {
  let attempts = 0, calls = 0;
  const f = createGameTransport({ url: 'ws://test', credentials: () => 'test',
    Socket: class { constructor() { attempts++; throw new Error('unsupported'); } },
    http: async () => { calls++; return {}; } });
  await f.request('fishing/profile'); await f.request('fishing/shop');
  assert.equal(attempts, 1); assert.equal(calls, 2);
});
test('hiding the game waits for a pending save response before closing', async () => {
  const f = fixture();
  const save = f.transport.request('fishing/reveal', { token: 'test' }); await tick();
  f.transport.closeWhenIdle(); assert.equal(f.sockets[0].readyState, 1);
  f.sockets[0].reply({ id: 1, status: 200, data: { saved: true } });
  assert.deepEqual(await save, { saved: true }); assert.equal(f.sockets[0].readyState, 3);
});
