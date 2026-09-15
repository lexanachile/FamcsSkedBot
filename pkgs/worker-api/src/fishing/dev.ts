import type { Bindings } from '../types';

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

export function fishingDevEnabled(requestUrl: string, userId: number, env: Pick<Bindings, 'TEST_TELEGRAM_USER_ID'>) {
  const configuredUser = env.TEST_TELEGRAM_USER_ID?.trim();
  if (configuredUser && configuredUser === String(userId)) return true;

  try {
    return LOCAL_HOSTS.has(new URL(requestUrl).hostname.toLowerCase());
  } catch {
    return false;
  }
}
