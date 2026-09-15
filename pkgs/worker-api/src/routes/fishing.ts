import type { Hono } from 'hono';
import type { AppEnvironment } from '../types';
import { fishingCatalog, pickFishingCandidate, TEACHER_CHANCE } from '../fishing/catalog';
import { authenticate, authError, hmac, readBody } from '../miniapp/auth';
import { seal, unseal, SLOT_MS, RECEIPT_TTL, type Reward } from '../fishing/tokens';
import { ensurePlayer, normalizeGame, publicGame, saveRewards, updatePlayerGame } from '../fishing/repository';
import { baitById, publicShop, rodById, rods } from '../fishing/shop';
import { rareCatchChance, smallFishAmount } from '../fishing/rewards';
import { fishingDevEnabled } from '../fishing/dev';

// Public aggregate only; personal collections are never shared/cached.
let stats: { until: number; rows: { fish_id: string; phrase_id: number; owners: number; usernames: (string | null)[] }[] } | undefined;
let statsRequest: Promise<NonNullable<typeof stats>['rows']> | undefined;
async function owners(db: D1Database) {
  if (stats && stats.until > Date.now()) return stats.rows;
  return statsRequest ||= (async () => {
    const result = await db.prepare(`SELECT f.key AS fish_id, CAST(ph.value AS INTEGER) AS phrase_id, COUNT(DISTINCT p.telegram_id) AS owners
      FROM fishing_players p, json_each(p.game_json, '$.fish') f,
        json_each(CASE WHEN json_type(f.value, '$.phrases') = 'array' THEN json_extract(f.value, '$.phrases') ELSE '[0]' END) ph
      WHERE json_extract(f.value, '$.count') > 0 GROUP BY f.key, CAST(ph.value AS INTEGER)`)
      .all<{ fish_id: string; phrase_id: number; owners: number }>();
    const rows = await Promise.all(result.results.map(async entry => {
      const tags = await db.prepare(`SELECT username FROM (
        SELECT p.telegram_id, p.username FROM fishing_players p, json_each(p.game_json, '$.fish') f,
          json_each(CASE WHEN json_type(f.value, '$.phrases') = 'array' THEN json_extract(f.value, '$.phrases') ELSE '[0]' END) ph
        WHERE f.key = ? AND CAST(ph.value AS INTEGER) = ? AND json_extract(f.value, '$.count') > 0
        GROUP BY p.telegram_id, p.username
      ) ORDER BY random() LIMIT 5`).bind(entry.fish_id, entry.phrase_id).all<{ username: string | null }>();
      return { ...entry, usernames: tags.results.map(row => row.username) };
    }));
    stats = { until: Date.now() + 300000, rows };
    return stats.rows;
  })().finally(() => { statsRequest = undefined; });
}
export function registerFishingRoutes(app: Hono<AppEnvironment>) {
  app.use('/api/fishing/*', async (c, next) => { c.header('Cache-Control', 'no-store'); await next(); });
  app.get('/api/fishing/profile', async c => {
    let user; try { user = await authenticate(c); } catch (error) { return authError(c, error); }
    const row = await ensurePlayer(c.env.DB, user.id, user.username);
    return c.json({ success: true, userId: user.id, revision: row.revision, game: publicGame(JSON.parse(row.game_json)),
      devEnabled: fishingDevEnabled(c.req.url, user.id, c.env) });
  });
  app.get('/api/fishing/leaderboard', async c => {
    let user; try { user = await authenticate(c); } catch (error) { return authError(c, error); }
    await ensurePlayer(c.env.DB, user.id, user.username);
    const result = await c.env.DB.prepare(`WITH scores AS (
      SELECT telegram_id, username, MAX(0, CAST(COALESCE(
        json_extract(game_json, '$.stats.totalCaught'),
        COALESCE(json_extract(game_json, '$.wallet.smallFish'), 0) + COALESCE((
          SELECT SUM(COALESCE(json_extract(f.value, '$.count'), 0)) FROM json_each(game_json, '$.fish') f
        ), 0)
      ) AS INTEGER)) AS total_caught FROM fishing_players
    ), ranked AS (
      SELECT telegram_id, username, total_caught,
        ROW_NUMBER() OVER (ORDER BY total_caught DESC, telegram_id ASC) AS position
      FROM scores WHERE total_caught > 0
    )
    SELECT telegram_id, username, total_caught, position FROM ranked
    WHERE position <= 50 OR telegram_id = ? ORDER BY position`).bind(user.id)
      .all<{ telegram_id: number; username: string | null; total_caught: number; position: number }>();
    const rows = result.results.map(row => ({ position: row.position, username: row.username, totalCaught: row.total_caught }));
    return c.json({ success: true, leaders: rows.filter(row => row.position <= 50), me: rows.find((_, index) => result.results[index]?.telegram_id === user.id) || null });
  });
  app.get('/api/fishing/shop', async c => {
    let user; try { user = await authenticate(c); } catch (error) { return authError(c, error); }
    const row = await ensurePlayer(c.env.DB, user.id, user.username);
    return c.json({ success: true, revision: row.revision, game: publicGame(JSON.parse(row.game_json)), catalog: publicShop() });
  });
  app.post('/api/fishing/shop/buy', async c => {
    let user; try { user = await authenticate(c); } catch (error) { return authError(c, error); }
    const body = await readBody(c, 2000).catch(() => null);
    const item = rodById(body?.itemId) || baitById(body?.itemId);
    if (!item || item.price <= 0) return c.json({ success: false, error: 'Такого товара нет.' }, 400);
    await ensurePlayer(c.env.DB, user.id, user.username);
    try {
      const result = await updatePlayerGame(c.env.DB, user.id, game => {
        if (game.wallet.smallFish < item.price) throw new Error('FUNDS');
        if (item.kind === 'rod' && game.inventory.rods.includes(item.id)) throw new Error('OWNED');
        game.wallet.smallFish -= item.price;
        if (item.kind === 'rod') game.inventory.rods.push(item.id);
        else game.inventory.baits[item.id] = (game.inventory.baits[item.id] || 0) + 1;
        return { changed: true, value: null };
      });
      return c.json({ success: true, revision: result.revision, game: publicGame(result.game) });
    } catch (error) {
      const code = error instanceof Error ? error.message : '';
      return c.json({ success: false, error: code === 'FUNDS' ? 'Не хватает рыбок.' : code === 'OWNED' ? 'Эта удочка уже куплена.' : 'Не удалось купить предмет.' }, code === 'FUNDS' || code === 'OWNED' ? 409 : 503);
    }
  });
  app.post('/api/fishing/loadout', async c => {
    let user; try { user = await authenticate(c); } catch (error) { return authError(c, error); }
    const body = await readBody(c, 2000).catch(() => null);
    if (!['rod', 'bait'].includes(body?.kind)) return c.json({ success: false, error: 'Некорректное снаряжение.' }, 400);
    await ensurePlayer(c.env.DB, user.id, user.username);
    try {
      const result = await updatePlayerGame(c.env.DB, user.id, game => {
        if (body.kind === 'rod') {
          const rod = rodById(body.itemId);
          if (!rod || !game.inventory.rods.includes(rod.id)) throw new Error('NOT_OWNED');
          if (game.equipped.rod === rod.id) return { changed: false, value: null };
          game.equipped.rod = rod.id;
        } else {
          const bait = body.itemId === null ? null : baitById(body.itemId);
          if (body.itemId !== null && (!bait || !(game.inventory.baits[bait.id] || 0))) throw new Error('NOT_OWNED');
          if (game.equipped.bait === (bait?.id || null)) return { changed: false, value: null };
          game.equipped.bait = bait?.id || null;
        }
        return { changed: true, value: null };
      });
      return c.json({ success: true, revision: result.revision, game: publicGame(result.game) });
    } catch (error) {
      return c.json({ success: false, error: error instanceof Error && error.message === 'NOT_OWNED' ? 'Сначала купите предмет.' : 'Не удалось выбрать снаряжение.' }, error instanceof Error && error.message === 'NOT_OWNED' ? 409 : 503);
    }
  });
  app.get('/api/fishing/collection', async c => {
    let user; try { user = await authenticate(c); } catch (error) { return authError(c, error); }
    const row = await ensurePlayer(c.env.DB, user.id, user.username);
    const game = normalizeGame(JSON.parse(row.game_json));
    const counts = await owners(c.env.DB);
    return c.json({ success: true, cards: fishingCatalog.map(fish => {
      const caught = game.fish[fish.id]?.count || 0;
      return { id: fish.id, count: caught, locked: !caught,
        name: caught ? fish.name : null, image: caught ? fish.image : null,
        phrases: fish.phrases.map((text, id) => {
          const unlocked = Boolean(game.fish[fish.id]?.phrases.includes(id));
          const entry = counts.find(item => item.fish_id === fish.id && item.phrase_id === id);
          return { id, locked: !unlocked, text: unlocked ? text : null,
            owners: unlocked ? entry?.owners || 0 : 0, usernames: unlocked ? entry?.usernames || [] : [] };
        }) };
    }) });
  });
  app.post('/api/fishing/cast', async c => {
    let user; try { user = await authenticate(c); } catch (error) { return authError(c, error); }
    const body = await readBody(c, 2000).catch(() => null);
    if (body?.spot !== 'deep' || (body.location && body.location !== 'crossing')) return c.json({ success: false, error: 'Локация закрыта.' }, 400);
    const now = Date.now(), slot = Math.floor(now / SLOT_MS);
    const hour = (new Date(slot * SLOT_MS).getUTCHours() + 3) % 24;
    const period = hour < 6 ? 'night' : hour < 11 ? 'morning' : hour < 18 ? 'day' : hour < 22 ? 'evening' : 'night';
    // One deterministic draw per short slot, so transport retries cannot reroll.
    // Rain-specific encounters stay disabled until authoritative weather is supplied.
    const pool = fishingCatalog.filter(f => f.spots.includes('deep') && f.periods.includes(period) && f.rain === null);
    const bytes = new Uint8Array(await hmac(c.env.TELEGRAM_BOT_TOKEN!, 'draw:v1:' + user.id + ':' + slot));
    const roll = new DataView(bytes.buffer).getUint32(0) / 4294967296;
    const isDev = fishingDevEnabled(c.req.url, user.id, c.env);
    const devKey = isDev ? [body?.devCatch || '', body?.devRod || '', body?.devBait || ''].join(':') : '';
    await ensurePlayer(c.env.DB, user.id, user.username);
    const draw = await updatePlayerGame(c.env.DB, user.id, game => {
      if (game._cast?.slot === slot && (!isDev || game._cast.devKey === devKey)) return { changed: false, value: game._cast };
      const sameSlot = game._cast?.slot === slot;
      const devRod = isDev ? rodById(body?.devRod) : null;
      const devBait = isDev ? baitById(body?.devBait) : null;
      const rod = devRod || (sameSlot ? rodById(game._cast!.rodId) : null) || rodById(game.equipped.rod) || rods[0];
      let bait = devBait || (sameSlot ? baitById(game._cast!.baitId) : baitById(game.equipped.bait));
      if (!sameSlot && !devBait && bait) {
        const count = game.inventory.baits[bait.id] || 0;
        if (count > 0) {
          game.inventory.baits[bait.id] = count - 1;
          if (count === 1) game.equipped.bait = null;
        } else { game.equipped.bait = null; bait = undefined; }
      }
      const rare = isDev && body?.devCatch === 'rare' ? true : isDev && body?.devCatch === 'small' ? false
        : roll < rareCatchChance(TEACHER_CHANCE, bait?.rareBonus || 0, game._commonCatchStreak);
      const unseen = pool.filter(fish => !(game.fish[fish.id]?.count > 0));
      const candidates = unseen.length ? unseen : pool;
      const fishRoll = new DataView(bytes.buffer).getUint32(4) / 4294967296;
      const fish = rare ? pickFishingCandidate(candidates, fishRoll) : null;
      const cast = { slot, baitId: bait?.id || null, fish: fish?.id || null, readyAt: now + (fish ? 9000 : 2500), rodId: rod.id, devKey };
      game._cast = cast;
      return { changed: true, value: cast };
    });
    const cast = draw.value;
    const fish = fishingCatalog.find(item => item.id === cast.fish);
    const rod = rodById(cast.rodId) || rods[0], bait = baitById(cast.baitId);
    const amount = fish ? undefined : smallFishAmount(new DataView(bytes.buffer).getUint32(8) / 4294967296);
    const payload: Reward = { kind: 'cast', uid: user.id, slot, fish: fish?.id || null, readyAt: cast.readyAt, expiresAt: slot * SLOT_MS + 600000, amount };
    return c.json({ success: true, token: await seal(c.env.TELEGRAM_BOT_TOKEN!, payload), slot, nextCastAt: (slot + 1) * SLOT_MS,
      revision: draw.revision, game: publicGame(draw.game), usedBait: bait?.id || null, rod: rod.id,
      traits: fish ? { challenge: 'fight', passMs: Math.round(3200 * Math.max(.8, rod.reactionMs / 2200) * fish.fightPassScale), zoneScale: rod.zoneScale * fish.fightZoneScale, divisions: rod.divisions, waitScale: bait?.waitScale || 1,
        drift: fish.drift * rod.driftScale, shake: fish.shake * rod.shakeScale, shakeSpeed: fish.shakeSpeed }
        : { challenge: rod.autoSmall ? 'auto' : 'quick', passMs: rod.reactionMs, quickZone: rod.quickZone, divisions: rod.divisions, waitScale: bait?.waitScale || 1, drift: 0, shake: 1.5, shakeSpeed: 1 } });
  });
  app.post('/api/fishing/reveal', async c => {
    let user; try { user = await authenticate(c); } catch (error) { return authError(c, error); }
    const body = await readBody(c, 5000).catch(() => null);
    let reward: Reward;
    try { reward = await unseal<Reward>(c.env.TELEGRAM_BOT_TOKEN!, body?.token); } catch { return c.json({ success: false, error: 'Неверный заброс.' }, 400); }
    if (reward.uid !== user.id || reward.kind !== 'cast' || reward.expiresAt <= Date.now()) return c.json({ success: false, error: 'Заброс истёк.' }, 400);
    if (Date.now() < reward.readyAt) return c.json({ success: false, error: 'Улов ещё не готов.' }, 409);
    const fish = fishingCatalog.find(f => f.id === reward.fish);
    const phraseBytes = new Uint8Array(await hmac(c.env.TELEGRAM_BOT_TOKEN!, 'phrase:v1:' + user.id + ':' + reward.slot));
    const phrase = fish ? phraseBytes[0] % fish.phrases.length : 0;
    const receipt = { ...reward, kind: 'receipt' as const, phrase, expiresAt: reward.slot * SLOT_MS + RECEIPT_TTL };
    await ensurePlayer(c.env.DB, user.id, user.username);
    const saved = await saveRewards(c.env.DB, user.id, [receipt]);
    stats = undefined;
    const record = saved.game._catches[String(reward.slot)];
    return c.json({ success: true, receipt: await seal(c.env.TELEGRAM_BOT_TOKEN!, receipt), slot: reward.slot, expiresAt: receipt.expiresAt,
      revision: saved.revision, game: publicGame(saved.game), duplicate: record?.duplicate || false, choice: record?.choice || null,
      catch: fish ? { kind: 'teacher', id: fish.id, name: fish.name, image: fish.image, phraseId: phrase, caption: fish.phrases[phrase] || '' }
        : { kind: 'small', id: 'smallFish', name: 'Маленькая рыбка', image: null, amount: reward.amount || 1, caption: `+${reward.amount || 1} рыбок` } });
  });
  app.post('/api/fishing/resolve', async c => {
    let user; try { user = await authenticate(c); } catch (error) { return authError(c, error); }
    const body = await readBody(c, 5000).catch(() => null);
    if (!['release', 'eat'].includes(body?.choice)) return c.json({ success: false, error: 'Некорректный выбор.' }, 400);
    let reward: Reward;
    try { reward = await unseal<Reward>(c.env.TELEGRAM_BOT_TOKEN!, body?.receipt); } catch { return c.json({ success: false, error: 'Неверный улов.' }, 400); }
    if (reward.uid !== user.id || reward.kind !== 'receipt' || reward.expiresAt <= Date.now() || !reward.fish) return c.json({ success: false, error: 'Улов истёк.' }, 400);
    try {
      const result = await updatePlayerGame(c.env.DB, user.id, game => {
        const record = game._catches[String(reward.slot)];
        if (!record || record.fish !== reward.fish || !record.duplicate) throw new Error('INVALID');
        if (record.choice) {
          if (record.choice !== body.choice) throw new Error('CHOSEN');
          return { changed: false, value: record.choice };
        }
        record.choice = body.choice;
        if (body.choice === 'eat') game.wallet.smallFish++;
        return { changed: true, value: record.choice };
      });
      return c.json({ success: true, choice: result.value, revision: result.revision, game: publicGame(result.game) });
    } catch (error) { return c.json({ success: false, error: error instanceof Error && error.message === 'CHOSEN' ? 'Выбор уже сделан.' : 'Этот улов нельзя обработать.' }, 409); }
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
      return c.json({ success: true, revision: result.revision, game: publicGame(result.game), accepted: rewards.map(r => r.slot), expired });
    } catch { return c.json({ success: false, error: 'Не удалось сохранить. Повторите позже.' }, 503); }
  });
}
