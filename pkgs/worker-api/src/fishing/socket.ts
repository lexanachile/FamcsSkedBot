import type { Hono } from 'hono';
import type { AppEnvironment } from '../types';
import { authenticateData } from '../miniapp/auth';

const methods: Record<string, string> = {
  'fishing/profile': 'GET', 'fishing/collection': 'GET', 'fishing/shop': 'GET', 'fishing/leaderboard': 'GET',
  'fishing/cast': 'POST', 'fishing/reveal': 'POST', 'fishing/resolve': 'POST', 'fishing/sync': 'POST',
  'fishing/shop/buy': 'POST', 'fishing/loadout': 'POST',
};

export function registerFishingSocket(app: Hono<AppEnvironment>) {
  app.get('/api/fishing/socket', c => {
    if (c.req.header('Upgrade')?.toLowerCase() !== 'websocket') return c.json({ error: 'WebSocket required' }, 426);
    const origin = c.req.header('Origin');
    if (!['https://famcs.online', 'http://localhost:8080', 'http://127.0.0.1:8080', 'http://localhost:8788', 'http://127.0.0.1:8788'].includes(origin || '')) {
      return c.json({ error: 'Origin rejected' }, 403);
    }
    const pair = new WebSocketPair();
    const client = pair[0], server = pair[1];
    server.accept();
    let auth = '', closed = false, queued = 0, lastId = 0;
    let chain = Promise.resolve();
    let idle = setTimeout(() => stop(1008, 'Authentication timeout'), 5000);
    function stop(code = 1000, reason = 'Idle') {
      if (closed) return;
      closed = true; clearTimeout(idle); server.close(code, reason);
    }
    function touch() { clearTimeout(idle); idle = setTimeout(() => stop(), 300000); }
    server.addEventListener('close', () => { closed = true; clearTimeout(idle); });
    server.addEventListener('error', () => stop(1011, 'Connection error'));
    server.addEventListener('message', event => {
      if (closed) return;
      if (typeof event.data !== 'string' || event.data.length > 200000 || queued >= 8) { stop(1008, 'Message limit'); return; }
      const raw = event.data; queued++;
      chain = chain.then(async () => {
        if (closed) return;
        const message = JSON.parse(raw);
        if (!auth) {
          if (message.type !== 'auth' || typeof message.initData !== 'string') { stop(1008, 'Authentication required'); return; }
          await authenticateData(c.env.TELEGRAM_BOT_TOKEN, message.initData);
          auth = message.initData; touch(); server.send(JSON.stringify({ type: 'ready' })); return;
        }
        if (!Number.isSafeInteger(message.id) || message.id <= lastId || !Object.prototype.hasOwnProperty.call(methods, message.path) || methods[message.path] !== message.method) {
          stop(1008, 'Invalid command'); return;
        }
        lastId = message.id; touch();
        // In-process Hono dispatch: no network fetch and no extra Worker invocation.
        // The existing HTTP handlers remain authoritative for auth, CAS and rewards.
        const response = await app.fetch(new Request(new URL('/api/' + message.path, c.req.url), {
          method: message.method,
          headers: { Authorization: 'tma ' + auth, 'Content-Type': 'application/json' },
          ...(message.method === 'POST' ? { body: JSON.stringify(message.body ?? {}) } : {}),
        }), c.env);
        const data = await response.json();
        if (!closed) server.send(JSON.stringify({ id: message.id, status: response.status, data }));
      }).catch(() => stop(1011, 'Command failed')).finally(() => { queued--; });
    });
    return new Response(null, { status: 101, webSocket: client });
  });
}
