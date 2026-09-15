export const TROPHIES_KEY = 'fishing:trophies:v1';

export function readTrophies(storage = globalThis.localStorage) {
  try {
    const value = JSON.parse(storage.getItem(TROPHIES_KEY) || '[]');
    if (!Array.isArray(value)) return [];
    return value.filter(item => item && typeof item.name === 'string').map(item => ({
      id: typeof item.id === 'string' ? item.id : '',
      name: item.name,
      image: typeof item.image === 'string' ? item.image : null,
      caption: typeof item.caption === 'string' ? item.caption : '',
      location: typeof item.location === 'string' ? item.location : 'crossing',
      caughtAt: Number.isFinite(item.caughtAt) ? item.caughtAt : 0,
    }));
  } catch { return []; }
}

export function writeTrophies(trophies, storage = globalThis.localStorage) {
  try { storage.setItem(TROPHIES_KEY, JSON.stringify(trophies)); return true; }
  catch { return false; }
}
