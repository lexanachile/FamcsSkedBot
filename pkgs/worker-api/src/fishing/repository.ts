import { fishingCatalog } from './catalog';
import type { Reward } from './tokens';
export const emptyGame = () => ({ schemaVersion: 1, savedAt: 0, wallet: { smallFish: 0 }, fish: {} as Record<string, { count: number; firstCaughtAt: number }> });
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
export function applyRewards(game: Game, sync: Record<string, number>, rewards: Reward[], now: number) {
  const next = JSON.parse(JSON.stringify(game)) as Game;
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
    const result = applyRewards(JSON.parse(row.game_json), JSON.parse(row.sync_json), rewards, Date.now());
    if (!result.added) return { revision: row.revision, game: result.game };
    const write = await db.prepare('UPDATE fishing_players SET game_json = ?, sync_json = ?, revision = revision + 1 WHERE telegram_id = ? AND revision = ?')
      .bind(JSON.stringify(result.game), JSON.stringify(result.seen), id, row.revision).run();
    if (write.meta.changes) return { revision: row.revision + 1, game: result.game };
  }
  throw new Error('Concurrent save; retry');
}
