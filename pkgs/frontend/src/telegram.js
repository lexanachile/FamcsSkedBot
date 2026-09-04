const TELEGRAM_BACKGROUND = "#0f0f11";

export function getTelegramWebApp() {
  const webApp = window.Telegram?.WebApp;
  return webApp?.platform && webApp.platform !== "unknown" ? webApp : null;
}

export function initializeTelegramWebApp() {
  const webApp = getTelegramWebApp();
  if (!webApp) return;
  try {
    webApp.expand?.();
    webApp.disableClosingConfirmation?.();
    webApp.setHeaderColor?.(TELEGRAM_BACKGROUND);
    webApp.setBackgroundColor?.(TELEGRAM_BACKGROUND);
    webApp.setBottomBarColor?.(TELEGRAM_BACKGROUND);
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
