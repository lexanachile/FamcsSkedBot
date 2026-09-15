// A command is never replayed automatically after send: its outcome may already
// be committed. Reveal recovery uses the existing durable receipt protocol.
export function createGameTransport({ url, credentials, http, Socket = globalThis.WebSocket, timeout = 20000 }) {
  let socket, connecting, blockedUntil = 0, sequence = 0, identity, closingWhenIdle = false;
  const pending = new Map();
  const failure = () => new Error('Соединение прервано. Проверьте прогресс перед повтором действия.');
  function close() {
    const previous = socket; socket = null;
    for (const entry of pending.values()) { clearTimeout(entry.timer); entry.reject(failure()); }
    pending.clear();
    previous?.close();
  }
  async function connect(auth) {
    if (identity !== auth) { close(); identity = auth; }
    if (socket?.readyState === 1 && !connecting) return socket;
    if (connecting) return connecting;
    const opening = new Promise((resolve, reject) => {
      const ws = new Socket(url); socket = ws;
      let ready = false;
      const timer = setTimeout(() => fail(), 5000);
      function fail() {
        clearTimeout(timer);
        if (socket === ws) close();
        if (!ready) reject(failure());
      }
      ws.addEventListener('open', () => ws.send(JSON.stringify({ type: 'auth', initData: auth })));
      ws.addEventListener('error', fail);
      ws.addEventListener('close', fail);
      ws.addEventListener('message', event => {
        let message; try { message = JSON.parse(event.data); } catch { fail(); return; }
        if (message.type === 'ready') { ready = true; clearTimeout(timer); resolve(ws); return; }
        const entry = pending.get(message.id);
        if (!entry) return;
        pending.delete(message.id); clearTimeout(entry.timer);
        if (message.status >= 400) entry.reject(Object.assign(new Error(message.data?.error || 'Ошибка сервера.'), { status: message.status }));
        else entry.resolve(message.data);
        if (closingWhenIdle && pending.size === 0) close();
      });
    });
    connecting = opening;
    try { return await opening; } finally { if (connecting === opening) connecting = null; }
  }
  async function request(path, body, method = body === undefined ? 'GET' : 'POST') {
    closingWhenIdle = false;
    const auth = credentials();
    if (!Socket || Date.now() < blockedUntil) return http(path, body, method);
    let ws;
    try { ws = await connect(auth); }
    catch { blockedUntil = Date.now() + 300000; return http(path, body, method); }
    const id = ++sequence;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { blockedUntil = Date.now() + 300000; close(); }, timeout);
      pending.set(id, { resolve, reject, timer });
      try { ws.send(JSON.stringify({ id, path, method, body })); }
      catch { close(); }
    });
  }
  return { request, close, closeWhenIdle() { closingWhenIdle = true; if (!pending.size) close(); } };
}
