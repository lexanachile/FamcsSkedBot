export const PASS_MS = 3200;
export const REST_MS = 5000;
export function makeZones(random = Math.random) {
  return [0.18 + random() * 0.08, 0.46 + random() * 0.06, 0.74 + random() * 0.07].map(start => ({ start, end: start + 0.105, hit: false }));
}
export function createFight(random = Math.random, traits = {}) {
  return { progress: 35, round: 1, elapsed: 0, phase: 'pass', zones: makeZones(random), hits: 0, attempts: 0, outcome: null,
    drift: Math.max(0, Math.min(1, Number(traits.drift) || 0)), shake: Math.max(0, Math.min(8, Number(traits.shake) || 0)), shakeSpeed: Math.max(.2, Math.min(5, Number(traits.shakeSpeed) || 2)), motionTime: 0 };
}
export function displayedProgress(fight) {
  const t = fight.motionTime * fight.shakeSpeed;
  // Bounded, zero-mean irregular motion. Never feeds back into game progress.
  return Math.max(0, Math.min(100, fight.progress + fight.shake * (.55 * Math.sin(t * 6.28) + .3 * Math.sin(t * 10.73) + .15 * Math.sin(t * 17.31))));
}
export function strike(fight) {
  if (fight.phase !== 'pass' || fight.outcome) return 'inactive';
  const position = fight.elapsed / PASS_MS;
  const zone = fight.zones.find(item => !item.hit && position >= item.start && position <= item.end);
  fight.attempts++;
  if (zone) { zone.hit = true; fight.hits++; fight.progress = Math.min(100, fight.progress + 14); }
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
  if (fight.phase === 'pass' && fight.elapsed >= PASS_MS) {
    if (!fight.hits) fight.progress = Math.max(0, fight.progress - 16);
    if (!fight.progress) { fight.outcome = 'escaped'; return; }
    fight.phase = 'rest'; fight.elapsed = 0;
  } else if (fight.phase === 'rest' && fight.elapsed >= REST_MS) {
    fight.phase = 'pass'; fight.elapsed = 0; fight.round++; fight.hits = 0; fight.zones = makeZones(random);
  }
}
