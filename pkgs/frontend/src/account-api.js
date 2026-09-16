import { requestJson } from './request.js?v=95';
import { API_ROOT } from './api-root.js?v=95';
export { API_ROOT };
export function accountHint() {
  try { return String(JSON.parse(new URLSearchParams(window.Telegram?.WebApp?.initData).get('user')).id); }
  catch { return null; }
}
export async function accountRequest(path, body, method = body === undefined ? 'GET' : 'POST') {
  const initData = window.Telegram?.WebApp?.initData;
  if (!initData) throw new Error('Откройте приложение через Telegram, чтобы сохранять прогресс.');
  return requestJson(`${API_ROOT}/${path}`, {
    method, headers: { 'Content-Type': 'application/json', Authorization: `tma ${initData}` },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  }, async (...args) => {
    const response = await fetch(...args);
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw Object.assign(new Error(data.error || `Ошибка сервера: ${response.status}`), { status: response.status });
    }
    return response;
  });
}
