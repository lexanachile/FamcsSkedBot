import type { Hono } from 'hono';
import type { AppEnvironment } from '../types';
import { fishingCatalog, fishingVariants, pickFishingVariant, TEACHER_CHANCE } from '../fishing/catalog';
import { authenticate, authError, hmac, readBody } from '../miniapp/auth';
import { seal, unseal, SLOT_MS, RECEIPT_TTL, type Reward } from '../fishing/tokens';
import { ensurePlayer, normalizeGame, publicGame, saveRewards, updatePlayerGame } from '../fishing/repository';
import { baitById, publicShop, rodById, rods } from '../fishing/shop';
import { rareCatchChance, smallFishAmount } from '../fishing/rewards';
import { fishingDevEnabled } from '../fishing/dev';

import { owners, leaderboard } from '../fishing/statistics';

export function registerFishingRoutes(app: Hono<AppEnvironment>) {
  app.use('/api/fishing/*', async (c, next) => { c.header('Cache-Control', 'no-store'); await next(); });
  app.get('/api/fishing/profile', async c => {
    let user; try { user = await authenticate(c); } catch (error) { return authError(c, error); }
    const row = await ensurePlayer(c.env.DB, user.id, user.username);
    const devEnabled = fishingDevEnabled(c.req.url, user.id, c.env);
    return c.json({ success: true, userId: user.id, revision: row.revision, game: publicGame(JSON.parse(row.game_json)),
      devEnabled,
      devCatalog: devEnabled ? fishingVariants().map(({ fish, phrase, phraseId }) => ({
        value: `${fish.id}:${phraseId}`, label: `${fish.name} — ${phrase.text}`,
      })) : undefined });
  });
  app.get('/api/fishing/leaderboard', async c => {
    let user; try { user = await authenticate(c); } catch (error) { return authError(c, error); }
    await ensurePlayer(c.env.DB, user.id, user.username);
    const rows = await leaderboard(c.env.DB);
    // Keep the existing response key for client compatibility; it now contains
    // the spendable small-fish balance used by the leaderboard.
    const publicRow = (row: typeof rows[number]) => ({ position: row.position, username: row.username, totalCaught: row.balance });
    const me = rows.find(row => row.telegram_id === user.id);
    return c.json({ success: true, leaders: rows.slice(0, 50).map(publicRow), me: me ? publicRow(me) : null });
  });
  app.get('/api/fishing/shop', async c => {
    let user; try { user = await authenticate(c); } catch (error) { return authError(c, error); }
    const row = await ensurePlayer(c.env.DB, user.id, user.username);
    return c.json({ success: true, revision: row.revision, game: publicGame(JSON.parse(row.game_json)), catalog: publicShop() });
  });
  app.post('/api/fishing/shop/buy', async c => {
    let user; try { user = await authenticate(c); } catch (error) { return authError(c, error); }
    const body = await readBody(c, 2000).catch(() => null);
    const requestId = body?.requestId;
    if (requestId !== undefined && (typeof requestId !== 'string' || !/^[a-zA-Z0-9-]{16,80}$/.test(requestId))) return c.json({ success: false, error: 'Некорректный идентификатор покупки.' }, 400);
    const item = rodById(body?.itemId) || baitById(body?.itemId);
    if (!item || item.price <= 0) return c.json({ success: false, error: 'Такого товара нет.' }, 400);
    const initialRow = await ensurePlayer(c.env.DB, user.id, user.username);
    try {
      const result = await updatePlayerGame(c.env.DB, user.id, game => {
        if (requestId && game._purchases[requestId]) {
          if (game._purchases[requestId].itemId !== item.id) throw new Error('REQUEST');
          return { changed: false, value: null };
        }
        if (game.wallet.smallFish < item.price) throw new Error('FUNDS');
        if (item.kind === 'rod' && game.inventory.rods.includes(item.id)) throw new Error('OWNED');
        game.wallet.smallFish -= item.price;
        if (item.kind === 'rod') game.inventory.rods.push(item.id);
        else game.inventory.baits[item.id] = (game.inventory.baits[item.id] || 0) + 1;
        if (requestId) game._purchases[requestId] = { itemId: item.id, expiresAt: Date.now() + 86400000 };
        return { changed: true, value: null };
      }, initialRow);
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
    const initialRow = await ensurePlayer(c.env.DB, user.id, user.username);
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
      }, initialRow);
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
        phrases: fish.phrases.map((phrase, id) => {
          const unlocked = Boolean(game.fish[fish.id]?.phrases.includes(id));
          const entry = counts.find(item => item.fish_id === fish.id && item.phrase_id === id);
          return { id, locked: !unlocked, text: unlocked ? phrase.text : null,
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
    const variants = fishingVariants(pool);
    const bytes = new Uint8Array(await hmac(c.env.TELEGRAM_BOT_TOKEN!, 'draw:v1:' + user.id + ':' + slot));
    const roll = new DataView(bytes.buffer).getUint32(0) / 4294967296;
    const isDev = fishingDevEnabled(c.req.url, user.id, c.env);
    const forcedVariant = isDev && typeof body?.devFish === 'string'
      ? variants.find(candidate => `${candidate.fish.id}:${candidate.phraseId}` === body.devFish)
      : undefined;
    const devKey = isDev ? [body?.devCatch || '', body?.devFish || '', body?.devRod || '', body?.devBait || ''].join(':') : '';
    const initialRow = await ensurePlayer(c.env.DB, user.id, user.username);
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
      const rare = Boolean(forcedVariant) || (isDev && body?.devCatch === 'rare') ? true : isDev && body?.devCatch === 'small' ? false
        : roll < rareCatchChance(TEACHER_CHANCE, rod.rareBonus, bait?.rareBonus || 0, game._commonCatchStreak);
      const incomplete = variants.filter(candidate => !game.fish[candidate.fish.id]?.phrases.includes(candidate.phraseId));
      const candidates = incomplete.length ? incomplete : variants;
      const fishRoll = new DataView(bytes.buffer).getUint32(4) / 4294967296;
      const variant = forcedVariant || (rare ? pickFishingVariant(candidates, fishRoll) : null);
      const cast = { slot, baitId: bait?.id || null, fish: variant?.fish.id || null, phrase: variant?.phraseId,
        readyAt: now + (variant ? 9000 : 2500), rodId: rod.id, devKey };
      game._cast = cast;
      return { changed: true, value: cast };
    }, initialRow);
    const cast = draw.value;
    const fish = fishingCatalog.find(item => item.id === cast.fish);
    const phraseSettings = fish?.phrases[Number.isInteger(cast.phrase) ? cast.phrase! : 0];
    const rod = rodById(cast.rodId) || rods[0], bait = baitById(cast.baitId);
    const amount = fish ? undefined : smallFishAmount(new DataView(bytes.buffer).getUint32(8) / 4294967296);
    const payload: Reward = { kind: 'cast', uid: user.id, slot, fish: fish?.id || null, phrase: fish ? cast.phrase : undefined,
      readyAt: cast.readyAt, expiresAt: slot * SLOT_MS + 600000, amount };
    return c.json({ success: true, token: await seal(c.env.TELEGRAM_BOT_TOKEN!, payload), slot, nextCastAt: (slot + 1) * SLOT_MS,
      revision: draw.revision, game: publicGame(draw.game), usedBait: bait?.id || null, rod: rod.id,
      traits: fish && phraseSettings ? { challenge: 'fight', passMs: Math.round(3200 * Math.max(.8, rod.reactionMs / 2200) * phraseSettings.fight.passScale), zoneScale: rod.zoneScale * phraseSettings.fight.zoneScale, divisions: rod.divisions, waitScale: bait?.waitScale || 1,
        drift: phraseSettings.fight.drift * rod.driftScale, shake: phraseSettings.fight.shake * rod.shakeScale, shakeSpeed: phraseSettings.fight.shakeSpeed }
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
    const initialRow = await ensurePlayer(c.env.DB, user.id, user.username);
    const game = normalizeGame(JSON.parse(initialRow.game_json));
    let phrase = Number.isInteger(reward.phrase) && reward.phrase! >= 0 && reward.phrase! < (fish?.phrases.length || 0) ? reward.phrase! : -1;
    if (fish && phrase < 0) {
      // Compatibility for cast tokens created before phrases were selected at cast time.
      const phraseBytes = new Uint8Array(await hmac(c.env.TELEGRAM_BOT_TOKEN!, 'phrase:v1:' + user.id + ':' + reward.slot));
      const missing = fish.phrases.map((_, id) => id).filter(id => !game.fish[fish.id]?.phrases.includes(id));
      const available = missing.length ? missing : fish.phrases.map((_, id) => id);
      phrase = available[phraseBytes[0] % available.length];
    }
    if (phrase < 0) phrase = 0;
    const receipt = { ...reward, kind: 'receipt' as const, phrase, expiresAt: reward.slot * SLOT_MS + RECEIPT_TTL };
    const saved = await saveRewards(c.env.DB, user.id, [receipt], initialRow);
    const record = saved.game._catches[String(reward.slot)];
    return c.json({ success: true, receipt: await seal(c.env.TELEGRAM_BOT_TOKEN!, receipt), slot: reward.slot, expiresAt: receipt.expiresAt,
      revision: saved.revision, game: publicGame(saved.game), duplicate: record?.duplicate || false, choice: record?.choice || null,
      catch: fish ? { kind: 'teacher', id: fish.id, name: fish.name, image: fish.image, phraseId: phrase, caption: fish.phrases[phrase]?.text || '' }
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
