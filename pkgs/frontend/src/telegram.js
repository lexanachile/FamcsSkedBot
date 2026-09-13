export function getTelegramWebApp() {
  const webApp = window.Telegram?.WebApp;
  return webApp?.platform && webApp.platform !== "unknown" ? webApp : null;
}

const configured = new WeakSet();

export function initializeTelegramWebApp() {
  const webApp = getTelegramWebApp();
  if (!webApp) return;
  const background = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim() || '#0b0b0c';
  const call = (method, ...args) => {
    try { webApp[method]?.(...args); }
    catch (error) { console.warn(`Telegram ${method} failed:`, error); }
  };
  // Release Telegram's placeholder independently of optional UI features.
  call('ready');
  call('expand');
  call('disableClosingConfirmation');
  call('setHeaderColor', background);
  call('setBackgroundColor', background);
  call('setBottomBarColor', background);
  if (!configured.has(webApp)) {
    configured.add(webApp);
    // The first expand can arrive during the iOS opening animation. Retry once
    // after its first stable viewport event, not on every keyboard/drag event.
    let initialViewport = true;
    call('onEvent', 'viewportChanged', event => {
      if (!initialViewport || !event?.isStateStable) return;
      initialViewport = false;
      if (!webApp.isExpanded) call('expand');
    });
    call('onEvent', 'activated', () => { call('ready'); call('expand'); });
  }
}

export function triggerTelegramHaptic(style) {
  if (!style) return;
  try {
    getTelegramWebApp()?.HapticFeedback?.impactOccurred?.(style);
  } catch {}
}
