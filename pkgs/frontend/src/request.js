// Bound both the connection and JSON body read, including older WebViews.
export async function requestJson(url, options = {}, request = fetch, timeoutMs = 20000) {
  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  let timer;
  try {
    return await Promise.race([
      (async () => {
        const response = await request(url, { ...options, ...(controller ? { signal: controller.signal } : {}) });
        if (!response.ok) throw new Error(`Ошибка сервера: ${response.status}`);
        return await response.json();
      })(),
      new Promise((_, reject) => {
        timer = setTimeout(() => {
          reject(new Error('Сервер не ответил вовремя. Попробуйте ещё раз.'));
          controller?.abort();
        }, timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
