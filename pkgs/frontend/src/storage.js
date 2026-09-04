export function getStoredValue(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function setStoredValue(key, value) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function removeStoredValue(key) {
  try {
    localStorage.removeItem(key);
  } catch {}
}

export function readStoredJson(key) {
  const value = getStoredValue(key);
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    removeStoredValue(key);
    return null;
  }
}

export function writeStoredJson(key, value) {
  return setStoredValue(key, JSON.stringify(value));
}
