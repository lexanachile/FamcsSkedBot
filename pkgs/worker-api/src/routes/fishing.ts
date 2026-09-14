import type { Hono } from 'hono';
import type { AppEnvironment } from '../types';
import { fishingCatalog } from '../fishing/catalog';

export function registerFishingRoutes(app: Hono<AppEnvironment>) {
  app.post('/api/fishing/cast', async c => {
    const body = await c.req.json().catch(() => null);
    if (!body || !['reeds', 'deep'].includes(body.spot) ||
      !['morning', 'day', 'evening', 'night'].includes(body.period) || typeof body.rain !== 'boolean') {
      return c.json({ success: false, error: 'Invalid fishing conditions' }, 400);
    }
    const pool = fishingCatalog.filter(f => f.spots.includes(body.spot) && f.periods.includes(body.period) && (f.rain === null || f.rain === body.rain));
    if (!pool.length) return c.json({ success: false, error: 'No fish in these conditions' }, 404);
    const fish = pool[Math.floor(Math.random() * pool.length)];
    const token = crypto.randomUUID();
    const phrase = fish.phrases[Math.floor(Math.random() * fish.phrases.length)] || '';
    await c.env.SCHEDULE_KV.put(`fishing:encounter:${token}`, JSON.stringify({
      readyAt: Date.now() + 9000, expiresAt: Date.now() + 600000,
      catch: { id: fish.id, name: fish.name, image: fish.image, caption: phrase },
    }), { expirationTtl: 600 });
    c.header('Cache-Control', 'no-store');
    return c.json({ success: true, token, traits: { drift: fish.drift, shake: fish.shake, shakeSpeed: fish.shakeSpeed } });
  });
  app.post('/api/fishing/reveal', async c => {
    const body = await c.req.json().catch(() => null);
    if (typeof body?.token !== 'string' || !/^[a-f0-9-]{36}$/.test(body.token)) return c.json({ success: false }, 400);
    const encounter = await c.env.SCHEDULE_KV.get<{ readyAt: number; expiresAt: number; catch: unknown }>(`fishing:encounter:${body.token}`, 'json');
    if (!encounter || Date.now() > encounter.expiresAt) return c.json({ success: false }, 404);
    if (Date.now() < encounter.readyAt) return c.json({ success: false }, 409);
    c.header('Cache-Control', 'no-store');
    return c.json({ success: true, catch: encounter.catch });
  });
}
