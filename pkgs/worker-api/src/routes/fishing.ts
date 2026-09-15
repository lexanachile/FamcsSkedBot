import type { Hono } from 'hono';
import type { AppEnvironment } from '../types';
import { fishingCatalog, TEACHER_CHANCE } from '../fishing/catalog';
import { authenticate, authError, hmac, readBody } from '../miniapp/auth';
import { seal, unseal, SLOT_MS, RECEIPT_TTL, type Reward } from '../fishing/tokens';
import { ensurePlayer, saveRewards } from '../fishing/repository';

// Public aggregate only; personal collections are never shared/cached.
let stats: { until: number; rows: { fish_id: string; owners: number; usernames: string }[] } | undefined;
let statsRequest: Promise<NonNullable<typeof stats>['rows']> | undefined;
async function owners(db: D1Database) {
  if (stats && stats.until > Date.now()) return stats.rows;
  return statsRequest ||= (async () => {
    const result = await db.prepare(`SELECT f.key AS fish_id, COUNT(*) AS owners,
      CASE WHEN COUNT(*) < 3 THEN json_group_array(p.username) ELSE '[]' END AS usernames
      FROM fishing_players p, json_each(p.game_json, '$.fish') f
      WHERE json_extract(f.value, '$.count') > 0 GROUP BY f.key`)
      .all<{ fish_id: string; owners: number; usernames: string }>();
    stats = { until: Date.now() + 300000, rows: result.results };
    return stats.rows;
  })().finally(() => { statsRequest = undefined; });
}
export function registerFishingRoutes(app: Hono<AppEnvironment>) {
  app.use('/api/fishing/*', async (c, next) => { c.header('Cache-Control', 'no-store'); await next(); });
  app.get('/api/fishing/profile', async c => {
    let user; try { user = await authenticate(c); } catch (error) { return authError(c, error); }
    const row = await ensurePlayer(c.env.DB, user.id, user.username);
    return c.json({ success: true, userId: user.id, revision: row.revision, game: JSON.parse(row.game_json) });
  });
  app.get('/api/fishing/collection', async c => {
    let user; try { user = await authenticate(c); } catch (error) { return authError(c, error); }
    const row = await ensurePlayer(c.env.DB, user.id, user.username);
    const game = JSON.parse(row.game_json);
    const counts = await owners(c.env.DB);
    return c.json({ success: true, cards: fishingCatalog.map(fish => {
      const entry = counts.find(item => item.fish_id === fish.id);
      const caught = game.fish[fish.id]?.count || 0;
      return { id: fish.id, count: caught, locked: !caught,
        name: caught ? fish.name : null, image: caught ? fish.image : null,
        owners: entry?.owners || 0, usernames: entry ? JSON.parse(entry.usernames) : [] };
    }) });
  });
  app.post('/api/fishing/cast', async c => {
    let user; try { user = await authenticate(c); } catch (error) { return authError(c, error); }
    const body = await readBody(c, 2000).catch(() => null);
    if (body?.spot !== 'deep' || (body.location && body.location !== 'crossing')) return c.json({ success: false, error: 'Локация закрыта.' }, 400);
    const now = Date.now(), slot = Math.floor(now / SLOT_MS);
    const hour = (new Date(slot * SLOT_MS).getUTCHours() + 3) % 24;
    const period = hour < 6 ? 'night' : hour < 11 ? 'morning' : hour < 18 ? 'day' : hour < 22 ? 'evening' : 'night';
    // One deterministic draw per user / 30-second slot, so retries cannot reroll.
    // Rain-specific encounters stay disabled until authoritative weather is supplied.
    const pool = fishingCatalog.filter(f => f.spots.includes('deep') && f.periods.includes(period) && f.rain === null);
    const bytes = new Uint8Array(await hmac(c.env.TELEGRAM_BOT_TOKEN!, 'draw:v1:' + user.id + ':' + slot));
    const roll = new DataView(bytes.buffer).getUint32(0) / 4294967296;
    const fish = roll < TEACHER_CHANCE && pool.length ? pool[bytes[4] % pool.length] : null;
    const payload: Reward = { kind: 'cast', uid: user.id, slot, fish: fish?.id || null, readyAt: now + 9000, expiresAt: slot * SLOT_MS + 600000 };
    return c.json({ success: true, token: await seal(c.env.TELEGRAM_BOT_TOKEN!, payload),
      slot, nextCastAt: (slot + 1) * SLOT_MS,
      traits: fish ? { drift: fish.drift, shake: fish.shake, shakeSpeed: fish.shakeSpeed } : { drift: .08, shake: 1.5, shakeSpeed: 1 } });
  });
  app.post('/api/fishing/reveal', async c => {
    let user; try { user = await authenticate(c); } catch (error) { return authError(c, error); }
    const body = await readBody(c, 5000).catch(() => null);
    let reward: Reward;
    try { reward = await unseal<Reward>(c.env.TELEGRAM_BOT_TOKEN!, body?.token); } catch { return c.json({ success: false, error: 'Неверный заброс.' }, 400); }
    if (reward.uid !== user.id || reward.kind !== 'cast' || reward.expiresAt <= Date.now()) return c.json({ success: false, error: 'Заброс истёк.' }, 400);
    if (Date.now() < reward.readyAt) return c.json({ success: false, error: 'Улов ещё не готов.' }, 409);
    const fish = fishingCatalog.find(f => f.id === reward.fish);
    const receipt = { ...reward, kind: 'receipt' as const, expiresAt: reward.slot * SLOT_MS + RECEIPT_TTL };
    return c.json({ success: true, receipt: await seal(c.env.TELEGRAM_BOT_TOKEN!, receipt), slot: reward.slot, expiresAt: receipt.expiresAt,
      catch: fish ? { kind: 'teacher', id: fish.id, name: fish.name, image: fish.image, caption: fish.phrases[0] || '' }
        : { kind: 'small', id: 'smallFish', name: 'Маленькая рыбка', image: null, caption: '+1 рыбка в карман' } });
  });
  app.post('/api/fishing/sync', async c => {
    let user; try { user = await authenticate(c); } catch (error) { return authError(c, error); }
    const body = await readBody(c).catch(() => null);
    if (!Array.isArray(body?.receipts) || body.receipts.length > 200) return c.json({ success: false, error: 'Некорректный пакет.' }, 400);
    const rewards: Reward[] = []; const expired: number[] = [];
    try {
      for (const token of body.receipts) {
        const reward = await unseal<Reward>(c.env.TELEGRAM_BOT_TOKEN!, token);
        if (reward.kind !== 'receipt' || reward.uid !== user.id || !Number.isSafeInteger(reward.slot)) throw new Error('receipt');
        if (reward.expiresAt <= Date.now()) expired.push(reward.slot); else rewards.push(reward);
      }
    } catch { return c.json({ success: false, error: 'Подтверждение улова повреждено.' }, 400); }
    // Snapshot is sent for the client protocol, but NEVER trusted as a balance.
    try {
      const result = await saveRewards(c.env.DB, user.id, rewards);
      return c.json({ success: true, ...result, accepted: rewards.map(r => r.slot), expired });
    } catch { return c.json({ success: false, error: 'Не удалось сохранить. Повторите позже.' }, 503); }
  });
}
