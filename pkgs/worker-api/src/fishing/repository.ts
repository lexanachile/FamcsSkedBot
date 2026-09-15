import { fishingCatalog } from './catalog';
import type { Reward } from './tokens';
import { baitById, rodById, type BaitId, type RodId } from './shop';
type CastState = { slot: number; baitId: BaitId | null; fish: string | null; readyAt: number; rodId: RodId };
export const emptyGame = () => ({ schemaVersion: 2, savedAt: 0, wallet: { smallFish: 0 }, fish: {} as Record<string, { count: number; firstCaughtAt: number }>,
  inventory: { rods: ['twig'] as RodId[], baits: {} as Partial<Record<BaitId, number>> },
  equipped: { rod: 'twig' as RodId, bait: null as BaitId | null }, _cast: null as CastState | null });
export type Game = ReturnType<typeof emptyGame>;
type Row = { revision: number; game_json: string; sync_json: string; username: string | null };
export async function readPlayer(db: D1Database, id: number) {
  return db.prepare('SELECT revision, game_json, sync_json, username FROM fishing_players WHERE telegram_id = ?').bind(id).first<Row>();
}
export async function ensurePlayer(db: D1Database, id: number, username: string | null) {
  let row = await readPlayer(db, id);
  if (!row) {
    await db.prepare('INSERT INTO fishing_players (telegram_id, username) VALUES (?, ?) ON CONFLICT(telegram_id) DO NOTHING').bind(id, username).run();
    row = await readPlayer(db, id);
  } else if (row.username !== username) {
    await db.prepare('UPDATE fishing_players SET username = ? WHERE telegram_id = ? AND username IS NOT ?').bind(username, id, username).run();
  }
  return row!;
}
export function normalizeGame(value: unknown): Game {
  const source = value && typeof value === 'object' ? value as Partial<Game> : {};
  const game = emptyGame();
  game.savedAt = Number(source.savedAt) || 0;
  game.wallet.smallFish = Math.max(0, Math.floor(Number(source.wallet?.smallFish) || 0));
  game.fish = source.fish && typeof source.fish === 'object' ? source.fish : {};
  const owned = Array.isArray(source.inventory?.rods) ? source.inventory.rods.filter(id => Boolean(rodById(id))) as RodId[] : [];
  game.inventory.rods = [...new Set(['twig' as RodId, ...owned])];
  if (source.inventory?.baits && typeof source.inventory.baits === 'object') {
    for (const [id, count] of Object.entries(source.inventory.baits)) if (baitById(id)) game.inventory.baits[id as BaitId] = Math.max(0, Math.floor(Number(count) || 0));
  }
  game.equipped.rod = game.inventory.rods.includes(source.equipped?.rod as RodId) ? source.equipped!.rod : 'twig';
  const bait = baitById(source.equipped?.bait);
  game.equipped.bait = bait && (game.inventory.baits[bait.id] || 0) > 0 ? bait.id : null;
  if (source._cast && Number.isSafeInteger(source._cast.slot) && rodById(source._cast.rodId)) game._cast = source._cast as CastState;
  return game;
}
export function publicGame(value: unknown) {
  const { _cast, ...game } = normalizeGame(value);
  return game;
}

export async function updatePlayerGame<T>(db: D1Database, id: number, mutate: (game: Game) => { changed: boolean; value: T }) {
  for (let retry = 0; retry < 5; retry++) {
    const row = await readPlayer(db, id);
    if (!row) throw new Error('PROFILE');
    const game = normalizeGame(JSON.parse(row.game_json));
    const mutation = mutate(game);
    if (!mutation.changed) return { revision: row.revision, game, value: mutation.value };
    game.savedAt = Date.now();
    const write = await db.prepare('UPDATE fishing_players SET game_json = ?, revision = revision + 1 WHERE telegram_id = ? AND revision = ?')
      .bind(JSON.stringify(game), id, row.revision).run();
    if (write.meta.changes) return { revision: row.revision + 1, game, value: mutation.value };
  }
  throw new Error('CONCURRENT');
}
export function applyRewards(game: Game, sync: Record<string, number>, rewards: Reward[], now: number) {
  const next = normalizeGame(JSON.parse(JSON.stringify(game)));
  const seen = Object.fromEntries(Object.entries(sync).filter(([, expiry]) => expiry > now));
  let added = 0;
  for (const reward of rewards) {
    const id = String(reward.slot);
    if (seen[id]) continue;
    seen[id] = reward.expiresAt;
    if (reward.fish) {
      if (!fishingCatalog.some(f => f.id === reward.fish)) throw new Error('Unknown fish');
      const previous = next.fish[reward.fish];
      next.fish[reward.fish] = { count: (previous?.count || 0) + 1, firstCaughtAt: Math.min(previous?.firstCaughtAt || reward.readyAt, reward.readyAt) };
    } else next.wallet.smallFish++;
    added++;
  }
  if (added) next.savedAt = now;
  return { game: next, seen, added };
}
export async function saveRewards(db: D1Database, id: number, rewards: Reward[]) {
  for (let retry = 0; retry < 5; retry++) {
    const row = await readPlayer(db, id);
    if (!row) throw new Error('Profile missing');
    const result = applyRewards(normalizeGame(JSON.parse(row.game_json)), JSON.parse(row.sync_json), rewards, Date.now());
    if (!result.added) return { revision: row.revision, game: result.game };
    const write = await db.prepare('UPDATE fishing_players SET game_json = ?, sync_json = ?, revision = revision + 1 WHERE telegram_id = ? AND revision = ?')
      .bind(JSON.stringify(result.game), JSON.stringify(result.seen), id, row.revision).run();
    if (write.meta.changes) return { revision: row.revision + 1, game: result.game };
  }
  throw new Error('Concurrent save; retry');
}
