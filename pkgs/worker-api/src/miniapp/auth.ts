import type { Context } from 'hono';
import type { AppEnvironment } from '../types';
const encoder = new TextEncoder();
export async function hmac(secret: string | ArrayBuffer, value: string) {
  const key = await crypto.subtle.importKey('raw', typeof secret === 'string' ? encoder.encode(secret) : secret, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return crypto.subtle.sign('HMAC', key, encoder.encode(value));
}
export async function authenticate(c: Context<AppEnvironment>) {
  return authenticateData(c.env.TELEGRAM_BOT_TOKEN, c.req.header('Authorization')?.replace(/^tma /, '') || '');
}
export async function authenticateData(secret: string | undefined, raw: string) {
  if (!secret) throw new Error('AUTH_CONFIG');
  if (!raw || raw.length > 10000) throw new Error('AUTH');
  const data = new URLSearchParams(raw);
  const keys = [...data.keys()];
  if (new Set(keys).size !== keys.length) throw new Error('AUTH');
  const hash = data.get('hash') || '';
  data.delete('hash');
  const check = [...data.entries()].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([k, v]) => `${k}=${v}`).join('\n');
  const digest = new Uint8Array(await hmac(await hmac('WebAppData', secret), check));
  if (!/^[a-f0-9]{64}$/.test(hash)) throw new Error('AUTH');
  let diff = 0;
  digest.forEach((v, i) => { diff |= v ^ parseInt(hash.slice(i * 2, i * 2 + 2), 16); });
  const age = Date.now() / 1000 - Number(data.get('auth_date'));
  if (diff || !Number.isFinite(age) || age < -60 || age > 86400) throw new Error('AUTH');
  const user = JSON.parse(data.get('user') || '{}');
  if (!Number.isSafeInteger(user.id) || user.id <= 0) throw new Error('AUTH');
  return { id: user.id as number, username: typeof user.username === 'string' ? user.username.slice(0, 64) : null };
}
export function authError(c: Context<AppEnvironment>, error: unknown) {
  return c.json({ success: false, error: error instanceof Error && error.message === 'AUTH_CONFIG'
    ? 'В API не настроен TELEGRAM_BOT_TOKEN.' : 'Откройте приложение заново через Telegram.' }, error instanceof Error && error.message === 'AUTH_CONFIG' ? 503 : 401);
}
export async function readBody(c: Context<AppEnvironment>, limit = 200000) {
  const reader = c.req.raw.body?.getReader();
  if (!reader) throw new Error('BODY');
  const chunks: Uint8Array[] = []; let size = 0;
  while (true) {
    const { done, value } = await reader.read(); if (done) break;
    size += value.length;
    if (size > limit) { await reader.cancel(); throw new Error('BODY'); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return JSON.parse(new TextDecoder().decode(bytes));
}
