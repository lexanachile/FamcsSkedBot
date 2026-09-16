import { accountRequest as httpRequest, accountHint, API_ROOT } from '../account-api.js?v=97';
import { createGameTransport } from './transport.js?v=97';
const RARE_CATCH_SMALL_FISH_BONUS = 30;
const empty = () => ({ schemaVersion: 5, savedAt: 0, wallet: { smallFish: 0 }, stats: { totalCaught: 0 }, fish: {}, inventory: { rods: ['twig'], baits: {} }, equipped: { rod: 'twig', bait: null } });
export async function requestRevealWithRetry(request, wait = delay => new Promise(resolve => setTimeout(resolve, delay))) {
  const delays = [250, 500, 1000];
  for (let attempt = 0; ; attempt++) {
    try { return await request(); }
    catch (error) {
      const temporary = !Number.isInteger(error?.status) || error.status === 409 || error.status >= 500;
      if (!temporary || attempt >= delays.length) throw error;
      await wait(delays[attempt]);
    }
  }
}
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
  game.stats ||= { totalCaught: game.wallet.smallFish + Object.values(game.fish).reduce((sum, fish) => sum + (fish.count || 0), 0) };
  game.inventory.rods ||= ['twig']; game.inventory.baits ||= {};
  game.equipped ||= { rod: 'twig', bait: null };
  for (const entry of pending) {
    if (entry.catch.kind === 'small') { const amount = entry.catch.amount || 1; game.wallet.smallFish += amount; game.stats.totalCaught += amount; }
    else {
      const previous = game.fish[entry.catch.id];
      game.fish[entry.catch.id] = { ...previous, count: (previous?.count || 0) + 1, firstCaughtAt: previous?.firstCaughtAt || entry.caughtAt,
        phrases: [...new Set([...(previous?.phrases || []), ...(Number.isInteger(entry.catch.phraseId) ? [entry.catch.phraseId] : [])])] };
      game.wallet.smallFish += RARE_CATCH_SMALL_FISH_BONUS;
      game.stats.totalCaught += RARE_CATCH_SMALL_FISH_BONUS + 1;
    }
  }
  return game;
}
export function createProgress(onChange) {
  const transport = createGameTransport({ url: API_ROOT.replace(/^http/, 'ws') + '/fishing/socket',
    credentials: () => window.Telegram?.WebApp?.initData || '', http: httpRequest });
  const accountRequest = (...args) => transport.request(...args);
  let lastProfileAt = 0, refreshing, active = true;
  const reads = new Map();
  const purchases = new Map();
  function cachedRead(path, ttl) {
    const old = reads.get(path);
    if (old && old.until > Date.now()) return old.promise;
    const entry = { until: Date.now() + ttl, promise: null };
    entry.promise = accountRequest(path).then(result => {
      if (path === 'fishing/shop') applyServer(result);
      return result;
    }).catch(error => { if (reads.get(path) === entry) reads.delete(path); throw error; });
    reads.set(path, entry); return entry.promise;
  }
  let uid, base = empty(), pending = [], decisions = [], revision = -1, loading, saving, cards = [], shopCatalog = null, error = '', devEnabled = false, devCatalog = [];
  const known = new Map();
  const notify = () => onChange?.({ game: projectedGame(base, pending), pending: pending.length, decision: decisions[0] || null, error, cards, catalog: shopCatalog, savedAt: base.savedAt, devEnabled, devCatalog });
  function applyServer(result) {
    if (result.game && result.revision >= revision) {
      if (JSON.stringify(base.fish) !== JSON.stringify(result.game.fish)) reads.delete('fishing/collection');
      base = result.game; revision = result.revision; lastProfileAt = Date.now();
    }
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
      uid = String(result.userId); lastProfileAt = Date.now(); base = result.game; revision = result.revision; devEnabled = result.devEnabled === true;
      devCatalog = Array.isArray(result.devCatalog) ? result.devCatalog : [];
      await reloadPending(); await reloadDecisions(); notify();
    })().catch(e => { uid = null; loading = null; error = e.message; notify(); throw e; });
  }
  async function reveal(token) {
    await init();
    // Keep a recoverable cast until the receipt is durably in IndexedDB.
    const recoveryKey = `${uid}:${token}`;
    await pendingOperation('readwrite', store => store.put({ key: recoveryKey, uid, token }), 'unrevealed');
    // Reveal is idempotent by user and cast slot, so retrying a transient failure
    // cannot award the same catch twice.
    const result = await requestRevealWithRetry(() => accountRequest('fishing/reveal', { token }));
    if (result.catch?.kind === 'teacher') reads.delete('fishing/collection');
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
        if (result.revision >= revision) { base = result.game; revision = result.revision; lastProfileAt = Date.now(); }
        error = result.expired.length ? 'Часть несохранённых уловов истекла (более суток).' : '';
        await reloadPending(); notify();
      }
    })().catch(e => { error = e.message; notify(); }).finally(() => { saving = null; });
  }
  async function collection() {
    await init();
    if (saving) await saving;
    const result = await cachedRead('fishing/collection', 60000);
    cards = result.cards; notify();
  }
  async function refresh() {
    if (!uid || accountHint() !== uid || saving || !active || Date.now() - lastProfileAt < 60000) return;
    if (refreshing) return refreshing;
    refreshing = (async () => {
      if (pending.length) { await flush(); return; }
      const result = await accountRequest('fishing/profile');
      if (!saving && !pending.length) applyServer(result);
    })().finally(() => { refreshing = null; });
    return refreshing;
  }
  const safeRefresh = () => { if (!document.hidden) refresh().catch(e => { error = e.message; notify(); }); };
  setInterval(() => { if (uid && pending.length) void flush(); }, 300000);
  window.addEventListener('online', safeRefresh);
  window.addEventListener('focus', safeRefresh);
  document.addEventListener('visibilitychange', () => { if (document.hidden) {
    if (uid && pending.length) void flush().finally(() => transport.closeWhenIdle());
    else transport.closeWhenIdle();
  } else safeRefresh(); });
  window.addEventListener('pagehide', () => transport.close());
  return {
    init, flush, collection,
    setActive(value) { active = value; if (value) safeRefresh(); else transport.closeWhenIdle(); },
    async shop() {
      await init();
      const result = await cachedRead('fishing/shop', 600000);
      shopCatalog = result.catalog; notify(); return result;
    },
    async leaderboard() { await init(); if (pending.length) await flush(); return cachedRead('fishing/leaderboard', 60000); },
    async buy(itemId) {
      await flush();
      if (pending.length) throw new Error('Сначала сохраните текущий улов.');
      const key = `fishing:purchase:${uid}:${itemId}`;
      let purchase = purchases.get(key);
      if (!purchase) { try { purchase = JSON.parse(localStorage.getItem(key)); } catch { /* optional persistence */ } }
      if (!purchase || purchase.expiresAt <= Date.now()) {
        purchase = { requestId: crypto.randomUUID(), expiresAt: Date.now() + 23 * 3600000 };
        // Retain the same ID after an ambiguous network failure or page reload.
        try { localStorage.setItem(key, JSON.stringify(purchase)); } catch { /* same-session retry below */ }
      }
      purchases.set(key, purchase);
      try {
        const result = await accountRequest('fishing/shop/buy', { itemId, requestId: purchase.requestId });
        purchases.delete(key);
        try { localStorage.removeItem(key); } catch { /* optional persistence */ }
        applyServer(result); return result;
      } catch (error) {
        if (error.status >= 400 && error.status < 500) { purchases.delete(key); try { localStorage.removeItem(key); } catch {} }
        throw error;
      }
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
