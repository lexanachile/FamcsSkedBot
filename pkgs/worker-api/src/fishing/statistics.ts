// Only public aggregates are shared. Cache is scoped to the D1 binding and each
// isolate; a cold isolate safely recomputes it. Never invalidate on every catch.
type Owner = { fish_id: string; phrase_id: number; owners: number; usernames: (string | null)[] };
type Rank = { telegram_id: number; username: string | null; total_caught: number; position: number };
function cached<T>(ttl: number, query: (db: D1Database) => Promise<T>) {
  const entries = new WeakMap<D1Database, { until: number; value: Promise<T> }>();
  return (db: D1Database) => {
    const old = entries.get(db);
    if (old && old.until > Date.now()) return old.value;
    const entry: { until: number; value: Promise<T> } = { until: Date.now() + ttl, value: Promise.resolve(null as T) };
    entry.value = query(db).catch(error => { if (entries.get(db) === entry) entries.delete(db); throw error; });
    entries.set(db, entry); return entry.value;
  };
}
export const owners = cached<Owner[]>(240000, async db => {
  const result = await db.prepare(`WITH unlocked AS (
    SELECT DISTINCT p.telegram_id, p.username, f.key AS fish_id, CAST(ph.value AS INTEGER) AS phrase_id
    FROM fishing_players p, json_each(p.game_json, '$.fish') f,
      json_each(CASE WHEN json_type(f.value, '$.phrases') = 'array' THEN json_extract(f.value, '$.phrases') ELSE '[0]' END) ph
    WHERE json_extract(f.value, '$.count') > 0
  ), sampled AS (
    SELECT *, COUNT(*) OVER (PARTITION BY fish_id, phrase_id) AS owners,
      ROW_NUMBER() OVER (PARTITION BY fish_id, phrase_id ORDER BY random()) AS sample
    FROM unlocked
  ) SELECT fish_id, phrase_id, MAX(owners) AS owners, json_group_array(username) AS usernames
    FROM sampled WHERE sample <= 5 GROUP BY fish_id, phrase_id`)
    .all<Omit<Owner, 'usernames'> & { usernames: string }>();
  return result.results.map(row => ({ ...row, usernames: JSON.parse(row.usernames) }));
});
export const leaderboard = cached<Rank[]>(60000, async db => {
  const result = await db.prepare(`WITH scores AS (
    SELECT telegram_id, username, MAX(0, CAST(COALESCE(
      json_extract(game_json, '$.stats.totalCaught'),
      COALESCE(json_extract(game_json, '$.wallet.smallFish'), 0) + COALESCE((
        SELECT SUM(COALESCE(json_extract(f.value, '$.count'), 0)) FROM json_each(game_json, '$.fish') f
      ), 0)
    ) AS INTEGER)) AS total_caught FROM fishing_players
  ) SELECT telegram_id, username, total_caught,
    ROW_NUMBER() OVER (ORDER BY total_caught DESC, telegram_id ASC) AS position
    FROM scores WHERE total_caught > 0 ORDER BY position`).all<Rank>();
  return result.results;
});
