export const PASS_MS = 3200;
export const REST_MS = 5000;
export function makeZones(random = Math.random, scale = 1) {
  const width = Math.min(.2, .105 * Math.max(.6, Number(scale) || 1));
  return [0.18 + random() * 0.08, 0.46 + random() * 0.06, 0.74 + random() * 0.07].map(start => ({ start, end: Math.min(.98, start + width), hit: false }));
}
export function createFight(random = Math.random, traits = {}) {
  const quick = traits.challenge === 'quick';
  const quickWidth = Math.max(.06, Math.min(.3, Number(traits.quickZone) || .15));
  const quickStart = .35 + random() * Math.max(.05, .3 - quickWidth);
  const zones = quick ? [{ start: quickStart, end: quickStart + quickWidth, hit: false }] : makeZones(random, traits.zoneScale);
  return { progress: quick ? 50 : 35, round: 1, elapsed: 0, phase: 'pass', zones, hits: 0, attempts: 0, outcome: null, quick,
    passMs: Math.max(900, Math.min(6000, Number(traits.passMs) || PASS_MS)), zoneScale: Math.max(.6, Math.min(2, Number(traits.zoneScale) || 1)), divisions: Math.max(3, Math.min(16, Number(traits.divisions) || 8)),
    drift: Math.max(0, Math.min(1, Number(traits.drift) || 0)), shake: Math.max(0, Math.min(8, Number(traits.shake) || 0)), shakeSpeed: Math.max(.2, Math.min(5, Number(traits.shakeSpeed) || 2)), motionTime: 0 };
}
export function displayedProgress(fight) {
  const t = fight.motionTime * fight.shakeSpeed;
  // Bounded, zero-mean irregular motion. Never feeds back into game progress.
  return Math.max(0, Math.min(100, fight.progress + fight.shake * (.55 * Math.sin(t * 6.28) + .3 * Math.sin(t * 10.73) + .15 * Math.sin(t * 17.31))));
}
export function strike(fight) {
  if (fight.phase !== 'pass' || fight.outcome) return 'inactive';
  const position = fight.elapsed / fight.passMs;
  const zone = fight.zones.find(item => !item.hit && position >= item.start && position <= item.end);
  fight.attempts++;
  if (zone) { zone.hit = true; fight.hits++; fight.progress = fight.quick ? 100 : Math.min(100, fight.progress + 14); }
  else fight.progress = Math.max(0, fight.progress - 9);
  if (fight.progress === 100) fight.outcome = 'caught';
  if (fight.progress === 0) fight.outcome = 'escaped';
  return zone ? 'hit' : 'miss';
}
export function advance(fight, delta, random = Math.random) {
  if (fight.outcome) return;
  fight.motionTime += delta / 1000;
  fight.progress = Math.max(0, fight.progress - fight.drift * delta / 1000);
  if (!fight.progress) { fight.outcome = 'escaped'; return; }
  fight.elapsed += delta;
  if (fight.phase === 'pass' && fight.elapsed >= fight.passMs) {
    if (fight.quick) { fight.progress = 0; fight.outcome = 'escaped'; return; }
    if (!fight.hits) fight.progress = Math.max(0, fight.progress - 16);
    if (!fight.progress) { fight.outcome = 'escaped'; return; }
    fight.phase = 'rest'; fight.elapsed = 0;
  } else if (fight.phase === 'rest' && fight.elapsed >= REST_MS) {
    fight.phase = 'pass'; fight.elapsed = 0; fight.round++; fight.hits = 0; fight.zones = makeZones(random, fight.zoneScale);
  }
}
