import { accountHint, accountRequest } from './account-api.js?v=48';
export function mergeColors(remote, pending) {
  const colors = { ...remote };
  for (const [key, edit] of Object.entries(pending)) {
    if (edit.value === null) delete colors[key]; else colors[key] = edit.value;
  }
  return colors;
}
export function acknowledgeEdits(pending, sent) {
  for (const [key, edit] of Object.entries(sent)) if (pending[key]?.seq === edit.seq) delete pending[key];
}
export function setupCloudColors(onChange, onError) {
  const uid = accountHint();
  if (!uid) return null;
  const key = `colors:account:${uid}`;
  let local = { document: { schemaVersion: 1, savedAt: 0, colors: {}, recentColors: [] }, pending: {}, seq: 0, recent: null };
  try {
    const saved = JSON.parse(localStorage.getItem(key));
    if (saved) local = saved;
    else if (!localStorage.getItem('colors:legacy-owner')) {
      const legacy = JSON.parse(localStorage.getItem('lessonColors:v1') || '{}');
      for (const [key, value] of Object.entries(legacy)) local.pending[key] = { value, seq: ++local.seq };
      localStorage.setItem('colors:legacy-owner', uid);
    }
  } catch { /* optional local cache */ }
  let running = false, timer, disposed = false, reportedError = false;
  const dirty = () => Object.keys(local.pending).length || local.recent;
  function persist() { try { localStorage.setItem(key, JSON.stringify(local)); } catch { /* server still available */ } }
  function paint() {
    const colors = mergeColors(local.document.colors, local.pending);
    try {
      localStorage.setItem('lessonColors:v1', JSON.stringify(colors));
      localStorage.setItem('lessonRecentColors:v1', JSON.stringify(local.recent?.value || local.document.recentColors));
    } catch { /* optional compatibility cache */ }
    onChange?.();
  }
  const queue = (ms = 3000) => { clearTimeout(timer); timer = setTimeout(sync, ms); };
  async function sync() {
    if (running || disposed || accountHint() !== uid) return;
    running = true;
    try {
      // Always read latest before merging edits; timestamps never order writes.
      const current = await accountRequest('colors');
      if (String(current.userId) !== uid) throw new Error('Учётная запись изменилась.');
      local.document = current.document; paint();
      if (dirty()) {
        const sent = JSON.parse(JSON.stringify(local.pending)), recent = local.recent && { ...local.recent };
        const document = { ...local.document, colors: mergeColors(local.document.colors, sent), recentColors: recent?.value || local.document.recentColors };
        const saved = await accountRequest('colors', { revision: current.revision, document }, 'PUT');
        acknowledgeEdits(local.pending, sent);
        if (recent && local.recent?.seq === recent.seq) local.recent = null;
        local.document = saved.document; paint();
      }
      persist();
      reportedError = false;
    } catch (error) {
      if (error.status !== 409) console.warn('Цвета пока не синхронизированы:', error.message);
      if (dirty() && !reportedError && error.status !== 409) { onError?.('Цвета сохранены на устройстве; синхронизация пока недоступна.'); reportedError = true; }
    } finally { running = false; if (dirty()) queue(10000); }
  }
  const refresh = () => { if (!document.hidden) void sync(); };
  window.addEventListener('focus', refresh);
  window.addEventListener('online', refresh);
  document.addEventListener('visibilitychange', refresh);
  setInterval(refresh, 60000);
  window.addEventListener('lesson-recent-changed', event => {
    local.recent = { value: event.detail, seq: ++local.seq }; persist(); queue();
  });
  persist(); paint(); void sync();
  return {
    getColors: () => mergeColors(local.document.colors, local.pending),
    edit(key, value) { local.pending[key] = { value, seq: ++local.seq }; persist(); queue(); },
    stop() { disposed = true; clearTimeout(timer); },
  };
}
