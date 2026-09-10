export function getTelegramWebApp() {
  const webApp = window.Telegram?.WebApp;
  return webApp?.platform && webApp.platform !== "unknown" ? webApp : null;
}

export function initializeTelegramWebApp() {
  const webApp = getTelegramWebApp();
  if (!webApp) return;
  const background = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim() || '#0b0b0c';
  try {
    webApp.expand?.();
    webApp.disableClosingConfirmation?.();
    webApp.setHeaderColor?.(background);
    webApp.setBackgroundColor?.(background);
    webApp.setBottomBarColor?.(background);
    webApp.ready();
  } catch (error) {
    console.warn("Ошибка настройки UI Telegram:", error);
  }
}

export function triggerTelegramHaptic(style) {
  if (!style) return;
  try {
    getTelegramWebApp()?.HapticFeedback?.impactOccurred?.(style);
  } catch {}
}
