import { requestJson } from '../request.js?v=55';
export function minskPeriod(date = new Date()) {
  const hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Minsk', hour: '2-digit', hourCycle: 'h23' }).format(date));
  return hour < 6 ? 'night' : hour < 11 ? 'morning' : hour < 18 ? 'day' : hour < 22 ? 'evening' : 'night';
}
export function setupEnvironment(root) {
  let rain = false, checkedAt = 0, pending = false;
  let periodOverride = '', rainOverride = '';
  function apply() {
    root.dataset.period = periodOverride || minskPeriod();
    root.dataset.rain = String(rainOverride ? rainOverride === 'rain' : rain);
  }
  async function refresh() {
    apply();
    if (pending || Date.now() - checkedAt < 600000) return;
    pending = true; checkedAt = Date.now();
    try {
      const weather = await requestJson('https://api.open-meteo.com/v1/forecast?latitude=53.9&longitude=27.5667&current=rain,showers&timezone=Europe%2FMinsk');
      if (typeof weather.current?.rain !== 'number' || typeof weather.current?.showers !== 'number') throw new Error('Invalid weather');
      rain = weather.current.rain + weather.current.showers > 0;
      root.dataset.weather = 'live';
    } catch { root.dataset.weather = 'unavailable'; }
    finally { pending = false; apply(); }
  }
  root.querySelector('[name="fish-period"]').addEventListener('change', e => { periodOverride = e.target.value; apply(); });
  root.querySelector('[name="fish-rain"]').addEventListener('change', e => { rainOverride = e.target.value; apply(); });
  refresh();
  return { refresh, conditions: () => ({ period: root.dataset.period, rain: root.dataset.rain === 'true' }) };
}
