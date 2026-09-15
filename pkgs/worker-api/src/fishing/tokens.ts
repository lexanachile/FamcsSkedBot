import { hmac } from '../miniapp/auth';
export const SLOT_MS = 4000;
export const RECEIPT_TTL = 86400000;
const enc = new TextEncoder();
async function key(secret: string) {
  return crypto.subtle.importKey('raw', await hmac(secret, 'famcs:fishing:aes:v1'), 'AES-GCM', false, ['encrypt', 'decrypt']);
}
export async function seal(secret: string, payload: unknown) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await key(secret), enc.encode(JSON.stringify(payload))));
  return btoa(String.fromCharCode(...iv, ...encrypted)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}
export async function unseal<T>(secret: string, token: string): Promise<T> {
  if (typeof token !== 'string' || token.length > 3000) throw new Error('TOKEN');
  const bytes = Uint8Array.from(atob(token.replace(/-/g, '+').replace(/_/g, '/')), ch => ch.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes.slice(0, 12) }, await key(secret), bytes.slice(12))));
}
export type Reward = { kind: 'receipt' | 'cast'; uid: number; slot: number; fish: string | null; readyAt: number; expiresAt: number; phrase?: number };
