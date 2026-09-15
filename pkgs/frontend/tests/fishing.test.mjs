import test from 'node:test';
import assert from 'node:assert/strict';
import { createFight, advance, strike, displayedProgress, PASS_MS, REST_MS } from '../src/fishing/engine.js';
import { bindStrikeInput } from '../src/fishing/input.js';
import { minskPeriod } from '../src/fishing/environment.js';
import { anglerPose, rodTip } from '../src/fishing/game.js';
import { getLocation, worldMapMarkup } from '../src/fishing/locations.js';
import { readTrophies, writeTrophies, TROPHIES_KEY } from '../src/fishing/trophies.js';
import { createLocationNotice } from '../src/fishing/location-notice.js';

test('only home and crossing can be opened from the map', () => {
  const buttons = [...worldMapMarkup().matchAll(/<button\b[^>]*data-location="([^"]+)"[^>]*>/g)];
  assert.deepEqual(buttons.filter(([markup]) => !markup.includes(' disabled')).map(([, id]) => id), ['home', 'crossing']);
  for (const id of ['main', 'zhdany', 'passage']) assert.equal(getLocation(id).locked, true);
  assert.equal(getLocation('crossing').locked, false);
});

test('location title holds for three seconds and cancels old navigation timers', () => {
  const timers = new Map(); let next = 0;
  const classes = new Set();
  const el = { hidden: true, textContent: '', classList: { add: v => classes.add(v), remove: v => classes.delete(v) } };
  const notice = createLocationNotice(el, (fn, delay) => { timers.set(++next, { fn, delay }); return next; }, id => timers.delete(id));
  notice.show('Переправа');
  assert.equal(el.hidden, false);
  assert.equal(timers.get(1).delay, 3000);
  timers.get(1).fn();
  assert.equal(classes.has('is-fading'), true);
  assert.equal(timers.get(2).delay, 700);
  notice.show('Дом');
  assert.equal(timers.has(2), false);
  assert.equal(classes.has('is-fading'), false);
  assert.equal(el.textContent, 'Дом');
  timers.get(3).fn();
  timers.get(4).fn();
  assert.equal(el.hidden, true);
  assert.equal(timers.size, 0);
});

test('touch scores on contact at the displayed position, release does not score again', () => {
  const handlers = {};
  const button = { disabled: false, addEventListener(name, handler) { handlers[name] = handler; } };
  const root = { addEventListener() {} };
  const fight = createFight(() => 0);
  fight.elapsed = .2 * PASS_MS;
  bindStrikeInput(button, root, () => strike(fight));
  handlers.pointerdown({ isPrimary: true, button: 0, preventDefault() {} });
  assert.equal(fight.hits, 1);
  fight.elapsed = .4 * PASS_MS; // finger is released after the sector has passed
  handlers.click({ detail: 1 });
  assert.equal(fight.attempts, 1);
  assert.equal(fight.progress, 49);
  handlers.pointerdown({ isPrimary: false, button: 0, preventDefault() {} });
  assert.equal(fight.attempts, 1);
  handlers.click({ detail: 0 }); // assistive/keyboard activation
  assert.equal(fight.attempts, 2);
});

test('Space scores on keydown only and held keys do not repeat', () => {
  const handlers = {};
  const button = { disabled: false, addEventListener() {} };
  const root = { addEventListener(name, handler) { handlers[name] = handler; } };
  let hits = 0;
  bindStrikeInput(button, root, () => hits++);
  const event = { code: 'Space', target: { closest: () => null }, preventDefault() {}, repeat: false };
  handlers.keydown(event);
  handlers.keydown({ ...event, repeat: true });
  handlers.keyup({ ...event, target: button });
  assert.equal(hits, 1);
});

test('Minsk periods use Minsk time regardless of device timezone', () => {
  for (const [hour, expected] of [[2, 'night'], [3, 'morning'], [8, 'day'], [15, 'evening'], [19, 'night']]) {
    assert.equal(minskPeriod(new Date(`2026-09-14T${String(hour).padStart(2, '0')}:00:00Z`)), expected);
  }
});
test('cosmetic movement never changes real progress; drift depends on fish', () => {
  const fight = createFight(() => 0, { drift: .2, shake: 4, shakeSpeed: 2 });
  advance(fight, 1000);
  assert.ok(Math.abs(fight.progress - 34.8) < .0001);
  const actual = fight.progress;
  for (let i = 0; i < 100; i++) { fight.motionTime = i / 10; assert.ok(Math.abs(displayedProgress(fight) - actual) <= 4); }
  assert.equal(fight.progress, actual);
});

test('a missed pass loses progress and gives exactly five seconds of recovery', () => {
  const fight = createFight(() => 0);
  advance(fight, PASS_MS);
  assert.equal(fight.progress, 19);
  assert.equal(fight.phase, 'rest');
  assert.equal(strike(fight), 'inactive');
  advance(fight, REST_MS - 1);
  assert.equal(fight.phase, 'rest');
  advance(fight, 1, () => 0);
  assert.equal(fight.phase, 'pass');
  assert.equal(fight.round, 2);
  assert.equal(fight.elapsed, 0);
});
test('several sectors can be caught per pass but each sector only once', () => {
  const fight = createFight(() => 0);
  fight.elapsed = .2 * PASS_MS;
  assert.equal(strike(fight), 'hit');
  assert.equal(strike(fight), 'miss');
  fight.elapsed = .5 * PASS_MS;
  assert.equal(strike(fight), 'hit');
  fight.elapsed = .8 * PASS_MS;
  assert.equal(strike(fight), 'hit');
  advance(fight, PASS_MS);
  assert.equal(fight.progress, 68);
});
test('successful play reaches a catch, a completed fight cannot be changed', () => {
  const fight = createFight(() => 0);
  for (let pass = 0; pass < 2; pass++) {
    for (const pos of [.2, .5, .8]) { fight.elapsed = pos * PASS_MS; strike(fight); }
    if (!fight.outcome) { advance(fight, PASS_MS); advance(fight, REST_MS, () => 0); }
  }
  assert.equal(fight.outcome, 'caught');
  assert.equal(fight.progress, 100);
  assert.equal(strike(fight), 'inactive');
});
test('unanswered passes eventually let the fish escape', () => {
  const fight = createFight(() => 0);
  for (let i = 0; i < 3; i++) { advance(fight, PASS_MS); advance(fight, REST_MS); }
  assert.equal(fight.progress, 0);
  assert.equal(fight.outcome, 'escaped');
});

test('rod stays attached and its pull animation remains restrained', () => {
  assert.deepEqual(rodTip(0, 0), { x: 350, y: 195 });
  const fight = { phase: 'rest', elapsed: REST_MS / 2 };
  const pose = anglerPose('fight', 0, fight, 0, false);
  assert.equal(pose.lean, 3.5);
  assert.equal(pose.rodAngle, 12);
  const tip = rodTip(pose.rodAngle, pose.lean);
  assert.ok(Number.isFinite(tip.x) && Number.isFinite(tip.y));
});

test('world map exposes every destination and trophies persist locally', () => {
  const map = worldMapMarkup();
  for (const location of ['Дом', 'Главка', 'Жданы', 'Переход', 'Переправа']) assert.ok(map.includes(location));
  assert.equal(getLocation('crossing').name, 'Переправа');
  const values = new Map();
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  const trophies = [{ id: 'kalinin', name: 'Калинин А.И.', image: '/kalinin.webp', caption: 'Улов', location: 'crossing', caughtAt: 1 }];
  assert.equal(writeTrophies(trophies, storage), true);
  assert.equal(values.has(TROPHIES_KEY), true);
  assert.deepEqual(readTrophies(storage), trophies);
});
