import { accountRequest, accountHint } from '../account-api.js?v=58';
const empty = () => ({ schemaVersion: 3, savedAt: 0, wallet: { smallFish: 0 }, fish: {}, inventory: { rods: ['twig'], baits: {} }, equipped: { rod: 'twig', bait: null } });
let database;
function db() {
  return database ||= new Promise((resolve, reject) => {
    const request = indexedDB.open('famcs-fishing', 3);
    request.onupgradeneeded = () => {
      for (const name of ['pending', 'unrevealed', 'decisions']) if (!request.result.objectStoreNames.contains(name)) request.result.createObjectStore(name, { keyPath: 'key' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => { database = null; reject(request.error); };
  });
}
async function pendingOperation(mode, callback, table = 'pending') {
  const connection = await db();
  return new Promise((resolve, reject) => {
    const tx = connection.transaction(table, mode), store = tx.objectStore(table);
    const result = callback(store);
    tx.oncomplete = () => resolve(result?.result);
    tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error);
  });
}
export function projectedGame(base, pending) {
  const game = JSON.parse(JSON.stringify(base));
  game.inventory ||= { rods: ['twig'], baits: {} };
  game.inventory.rods ||= ['twig']; game.inventory.baits ||= {};
  game.equipped ||= { rod: 'twig', bait: null };
  for (const entry of pending) {
    if (entry.catch.kind === 'small') game.wallet.smallFish++;
    else {
      const previous = game.fish[entry.catch.id];
      game.fish[entry.catch.id] = { ...previous, count: (previous?.count || 0) + 1, firstCaughtAt: previous?.firstCaughtAt || entry.caughtAt,
        phrases: [...new Set([...(previous?.phrases || []), ...(Number.isInteger(entry.catch.phraseId) ? [entry.catch.phraseId] : [])])] };
    }
  }
  return game;
}
export function createProgress(onChange) {
  let uid, base = empty(), pending = [], decisions = [], revision = -1, loading, saving, cards = [], shopCatalog = null, error = '';
  const known = new Map();
  const notify = () => onChange?.({ game: projectedGame(base, pending), pending: pending.length, decision: decisions[0] || null, error, cards, catalog: shopCatalog, savedAt: base.savedAt });
  function applyServer(result) {
    if (result.game && result.revision >= revision) { base = result.game; revision = result.revision; }
    error = ''; notify();
  }
  async function reloadPending() {
    pending = (await pendingOperation('readonly', store => store.getAll())).filter(item => item.uid === uid);
    for (const entry of pending) known.set(entry.catch.id, entry.catch);
  }
  async function reloadDecisions() {
    decisions = (await pendingOperation('readonly', store => store.getAll(), 'decisions')).filter(item => item.uid === uid).sort((a, b) => a.slot - b.slot);
  }
  async function init() {
    if (uid) { if (accountHint() !== uid) throw new Error('Откройте игру заново для другой учётной записи.'); return; }
    return loading ||= (async () => {
      const result = await accountRequest('fishing/profile');
      uid = String(result.userId); base = result.game; revision = result.revision;
      await reloadPending(); await reloadDecisions(); notify();
    })().catch(e => { uid = null; loading = null; error = e.message; notify(); throw e; });
  }
  async function reveal(token) {
    await init();
    // Keep a recoverable cast until the receipt is durably in IndexedDB.
    const recoveryKey = `${uid}:${token}`;
    await pendingOperation('readwrite', store => store.put({ key: recoveryKey, uid, token }), 'unrevealed');
    const result = await accountRequest('fishing/reveal', { token });
    if (result.game) applyServer(result);
    else {
      const entry = { ...result, key: `${uid}:${result.slot}`, uid, caughtAt: Date.now() };
      await pendingOperation('readwrite', store => store.put(entry));
    }
    if (result.duplicate && !result.choice) {
      await pendingOperation('readwrite', store => store.put({ ...result, key: `${uid}:${result.slot}`, uid }), 'decisions');
      await reloadDecisions();
    }
    await pendingOperation('readwrite', store => store.delete(recoveryKey), 'unrevealed');
    await reloadPending(); error = ''; notify(); return result;
  }
  async function resolveCatch(result, choice) {
    await init();
    const response = await accountRequest('fishing/resolve', { receipt: result.receipt, choice });
    applyServer(response);
    await pendingOperation('readwrite', store => store.delete(`${uid}:${result.slot}`), 'decisions');
    await reloadDecisions(); notify(); return response;
  }
  async function recoverReveal() {
    const entries = (await pendingOperation('readonly', store => store.getAll(), 'unrevealed')).filter(e => e.uid === uid);
    for (const entry of entries) {
      try { await reveal(entry.token); }
      catch (e) {
        if (e.status === 400) { await pendingOperation('readwrite', store => store.delete(entry.key), 'unrevealed'); error = 'Предыдущий заброс истёк до подтверждения.'; notify(); }
        else throw e;
      }
    }
  }
  async function flush() {
    if (saving) return saving;
    return saving = (async () => {
      await init(); await recoverReveal(); await reloadPending();
      while (pending.length) {
        const batch = pending.slice(0, 200);
        const result = await accountRequest('fishing/sync', { game: projectedGame(base, pending), receipts: batch.map(e => e.receipt) });
        const done = new Set([...result.accepted, ...result.expired]);
        await pendingOperation('readwrite', store => { for (const e of batch) if (done.has(e.slot)) store.delete(e.key); });
        if (result.revision >= revision) { base = result.game; revision = result.revision; }
        error = result.expired.length ? 'Часть несохранённых уловов истекла (более суток).' : '';
        await reloadPending(); notify();
      }
    })().catch(e => { error = e.message; notify(); }).finally(() => { saving = null; });
  }
  async function collection() {
    await init();
    if (saving) await saving;
    const result = await accountRequest('fishing/collection');
    cards = result.cards; notify();
  }
  async function refresh() {
    if (!uid || saving) return;
    if (pending.length) { await flush(); return; }
    const result = await accountRequest('fishing/profile');
    // A flush may have started while GET was in flight; never apply it then.
    if (!saving && !pending.length && result.revision >= revision) { base = result.game; revision = result.revision; notify(); }
  }
  const safeRefresh = () => { if (!document.hidden) refresh().catch(e => { error = e.message; notify(); }); };
  setInterval(() => { if (uid && pending.length) void flush(); }, 300000);
  window.addEventListener('online', safeRefresh);
  window.addEventListener('focus', safeRefresh);
  document.addEventListener('visibilitychange', () => { if (document.hidden) { if (uid && pending.length) void flush(); } else safeRefresh(); });
  window.addEventListener('pagehide', () => { if (uid && pending.length) void flush(); });
  return {
    init, flush, collection,
    async shop() {
      await init();
      const result = await accountRequest('fishing/shop');
      shopCatalog = result.catalog; applyServer(result); return result;
    },
    async buy(itemId) {
      await flush();
      if (pending.length) throw new Error('Сначала сохраните текущий улов.');
      const result = await accountRequest('fishing/shop/buy', { itemId });
      applyServer(result); return result;
    },
    async equip(kind, itemId) {
      await flush();
      if (pending.length) throw new Error('Сначала сохраните текущий улов.');
      const result = await accountRequest('fishing/loadout', { kind, itemId });
      applyServer(result); return result;
    },
    async cast(spot, location, dev = {}) {
      await init(); await recoverReveal();
      const result = await accountRequest('fishing/cast', { spot, location, ...dev });
      applyServer(result); return result;
    },
    reveal, resolveCatch,
    pendingDecision() { return decisions[0] || null; },
    pendingCard(id) { return known.get(id); },
  };
}
