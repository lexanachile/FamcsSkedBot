import test from 'node:test';
import assert from 'node:assert/strict';
import { createFight, advance, strike, displayedProgress, passPosition, PASS_MS, REST_MS } from '../src/fishing/engine.js';
import { bindStrikeInput } from '../src/fishing/input.js';
import { minskPeriod } from '../src/fishing/environment.js';
import { anglerPose, biteFishPosition, orbitFishPose, orbitFishPosition, RARE_ORBIT_MS, rodTip, linePath } from '../src/fishing/game.js';
import { getLocation, worldMapMarkup } from '../src/fishing/locations.js';
import { lakeScene } from '../src/fishing/scene.js';
import { readTrophies, writeTrophies, TROPHIES_KEY } from '../src/fishing/trophies.js';
import { createLocationNotice } from '../src/fishing/location-notice.js';
import { devBaitOptions, devCatchOptions, devRodOptions, storeMarkup } from '../src/fishing/storefront.js';
import { bindCatchChoiceInput, catchChoiceKeyframes } from '../src/fishing/catch-choice.js';
const setIndicator = (fight, position) => { fight.elapsed = Math.pow(position, 1 / 1.65) * fight.passMs; };

test('only home and crossing can be opened from the map', () => {
  const map = worldMapMarkup();
  assert.ok(map.includes('<h2>Карта</h2>'));
  assert.ok(map.includes('viewBox="0 0 450 600"'));
  assert.ok(!map.includes('preserveAspectRatio="none"'));
  assert.ok(!map.includes('МАЛЕНЬКИЙ МИР'));
  const buttons = [...map.matchAll(/<button\b[^>]*data-location="([^"]+)"[^>]*>/g)];
  assert.deepEqual(buttons.filter(([markup]) => !markup.includes(' disabled')).map(([, id]) => id), ['home', 'crossing']);
  for (const id of ['main', 'zhdany', 'passage']) assert.equal(getLocation(id).locked, true);
  assert.equal(getLocation('crossing').locked, false);
});
test('lake scene is drawn in a native portrait coordinate system', () => {
  const scene = lakeScene();
  assert.ok(scene.includes('viewBox="0 0 450 600"'));
  assert.ok(scene.includes('preserveAspectRatio="xMidYMid meet"'));
  assert.ok(!scene.includes('slice'));
  assert.ok(scene.includes('class="fish-raccoon"'));
  assert.match(scene, /class="fish-arm-sleeve"[^>]*322 378/);
  assert.ok(scene.includes('class="fish-arm-free"'));
  assert.ok(scene.includes('class="fish-arm-holding"'));
  assert.match(scene, /class="fish-grip-hand"[^>]*rotate\(-32 322 370\)/);
});
test('store and biome loadout expose every dev rod and bait', () => {
  const markup = storeMarkup();
  assert.ok(markup.includes('fish-shop'));
  assert.ok(markup.includes('fish-loadout'));
  assert.deepEqual(devRodOptions.map(([id]) => id), ['', 'twig', 'reed', 'lake', 'moon', 'auto']);
  assert.deepEqual(devBaitOptions.map(([id]) => id), ['', 'crumbs', 'berries', 'glow']);
  assert.deepEqual(devCatchOptions.map(([id]) => id), ['', 'small', 'rare']);
});

test('catch choices accept pointer, touch and ordinary click without double activation', () => {
  const handlers = {}, options = {}; let clock = 1000, choices = 0;
  const button = { disabled: false, dataset: { catchChoice: 'eat' } };
  const container = { addEventListener(name, handler, value) { handlers[name] = handler; options[name] = value; } };
  const event = { target: { closest: () => button }, isPrimary: true, pointerType: 'touch', button: 0, touches: [{}], preventDefault() {} };
  bindCatchChoiceInput(container, choice => { assert.equal(choice, 'eat'); choices++; }, () => clock);
  handlers.pointerdown(event); handlers.click({ ...event, detail: 1 });
  assert.equal(choices, 1);
  clock += 600; handlers.click({ ...event, detail: 1 });
  assert.equal(choices, 2);
  clock += 600; button.disabled = true; handlers.touchstart(event);
  assert.equal(choices, 2);
  assert.equal(options.pointerdown.capture, true);
  assert.deepEqual(options.touchstart, { capture: true, passive: false });
});

test('eat and release flights end at their requested scene targets', () => {
  const start = { x: 200, y: 180 }, end = { x: 350, y: 360 };
  const eat = catchChoiceKeyframes('eat', start, end);
  const release = catchChoiceKeyframes('release', start, end);
  assert.match(eat.at(-1).transform, /translate\(150px, 180px\).*scale\(0\.16\)/);
  assert.match(release.at(-1).transform, /translate\(150px, 180px\).*scale\(0\.52\)/);
  assert.notEqual(eat[1].transform, release[1].transform);
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
  const buttonHandlers = {}, surfaceHandlers = {};
  const button = { disabled: false, addEventListener(name, handler) { buttonHandlers[name] = handler; } };
  const surface = { addEventListener(name, handler) { surfaceHandlers[name] = handler; } };
  const root = { addEventListener() {} };
  const fight = createFight(() => 0);
  setIndicator(fight, .2);
  bindStrikeInput(button, surface, root, () => strike(fight));
  const target = { closest: () => null };
  surfaceHandlers.pointerdown({ isPrimary: true, button: 0, target, preventDefault() {} });
  assert.equal(fight.hits, 1);
  setIndicator(fight, .4); // finger is released after the sector has passed
  buttonHandlers.click({ detail: 1 });
  assert.equal(fight.attempts, 1);
  assert.equal(fight.progress, 49);
  surfaceHandlers.pointerdown({ isPrimary: false, button: 0, target, preventDefault() {} });
  assert.equal(fight.attempts, 1);
  buttonHandlers.click({ detail: 0 }); // assistive/keyboard activation
  assert.equal(fight.attempts, 2);
});

test('screen-wide strike ignores interface controls', () => {
  const handlers = {};
  const button = { disabled: false, addEventListener() {} };
  const surface = { addEventListener(name, handler) { handlers[name] = handler; } };
  const root = { addEventListener() {} };
  let hits = 0;
  bindStrikeInput(button, surface, root, () => hits++);
  handlers.pointerdown({ isPrimary: true, button: 0, target: { closest: () => ({}) }, preventDefault() {} });
  assert.equal(hits, 0);
  handlers.pointerdown({ isPrimary: true, button: 0, target: { closest: () => null }, preventDefault() {} });
  assert.equal(hits, 1);
});
test('screen-wide strike is inactive after the fight result opens', () => {
  const handlers = {};
  const button = { disabled: false, addEventListener() {} };
  const surface = { addEventListener(name, handler) { handlers[name] = handler; } };
  const root = { addEventListener() {} };
  let active = false, hits = 0;
  bindStrikeInput(button, surface, root, () => hits++, () => active);
  const event = { isPrimary: true, button: 0, target: { closest: () => null }, preventDefault() {} };
  handlers.pointerdown(event);
  assert.equal(hits, 0);
  active = true;
  handlers.pointerdown(event);
  assert.equal(hits, 1);
});
test('touch fallback works in iOS WebViews and cross-API duplicates are ignored', () => {
  const handlers = {}, options = {};
  const button = { disabled: false, addEventListener() {} };
  const surface = { addEventListener(name, handler, value) { handlers[name] = handler; options[name] = value; } };
  const root = { addEventListener() {} };
  let hits = 0, clock = 1000;
  bindStrikeInput(button, surface, root, () => hits++, () => true, () => clock);
  const event = { target: { closest: () => null }, touches: [{}], cancelable: true, preventDefault() {} };
  handlers.touchstart(event);
  assert.equal(hits, 1);
  clock += 10;
  handlers.pointerdown({ target: event.target, pointerType: 'touch', isPrimary: true, button: 0, preventDefault() {} });
  assert.equal(hits, 1);
  clock += 10;
  handlers.touchstart(event);
  assert.equal(hits, 2);
  handlers.touchstart({ ...event, touches: [{}, {}] });
  assert.equal(hits, 2);
  assert.equal(options.pointerdown.capture, true);
  assert.deepEqual(options.touchstart, { capture: true, passive: false });
});
test('pointer contact without mouse-only fields is accepted by the WebView path', () => {
  const handlers = {};
  const button = { disabled: false, addEventListener() {} };
  const surface = { addEventListener(name, handler) { handlers[name] = handler; } };
  const root = { addEventListener() {} };
  let hits = 0;
  bindStrikeInput(button, surface, root, () => hits++);
  handlers.pointerdown({ target: { closest: () => null }, preventDefault() {} });
  assert.equal(hits, 1);
});

test('Space scores on keydown only and held keys do not repeat', () => {
  const handlers = {};
  const button = { disabled: false, addEventListener() {} };
  const root = { addEventListener(name, handler) { handlers[name] = handler; } };
  let hits = 0;
  bindStrikeInput(button, { addEventListener() {} }, root, () => hits++);
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
test('small fish is caught by one correctly timed tap and escapes after its only pass', () => {
  const caught = createFight(() => 0, { challenge: 'quick' });
  assert.equal(caught.zones.length, 1);
  advance(caught, 100);
  assert.equal(caught.outcome, null);
  setIndicator(caught, .5);
  assert.equal(strike(caught), 'hit');
  assert.equal(caught.progress, 100);
  assert.equal(caught.outcome, 'caught');
  const escaped = createFight(() => 0, { challenge: 'quick' });
  advance(escaped, PASS_MS);
  assert.equal(escaped.outcome, 'escaped');
});
test('better rods slow the reaction pass and widen its target', () => {
  const starter = createFight(() => 0, { challenge: 'quick', passMs: 1200, quickZone: .075, divisions: 12 });
  const moon = createFight(() => 0, { challenge: 'quick', passMs: 2800, quickZone: .2, divisions: 5 });
  assert.equal(starter.passMs, 1200);
  assert.equal(moon.passMs, 2800);
  assert.ok((moon.zones[0].end - moon.zones[0].start) > (starter.zones[0].end - starter.zones[0].start));
  assert.ok(starter.divisions > moon.divisions);
});

test('the indicator accelerates and a missed pass gives exactly 2.5 seconds of recovery', () => {
  const fight = createFight(() => 0);
  fight.elapsed = fight.passMs * .25; assert.ok(passPosition(fight) < .25);
  fight.elapsed = fight.passMs * .75; assert.ok(passPosition(fight) > .5);
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
  setIndicator(fight, .2);
  assert.equal(strike(fight), 'hit');
  assert.equal(strike(fight), 'miss');
  setIndicator(fight, .5);
  assert.equal(strike(fight), 'hit');
  setIndicator(fight, .8);
  assert.equal(strike(fight), 'hit');
  advance(fight, PASS_MS);
  assert.equal(fight.progress, 68);
});
test('successful play reaches a catch, a completed fight cannot be changed', () => {
  const fight = createFight(() => 0);
  for (let pass = 0; pass < 2; pass++) {
    for (const pos of [.2, .5, .8]) { setIndicator(fight, pos); strike(fight); }
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

test('rod rotation preserves the hand joint through body rotation and translation', () => {
  assert.deepEqual(rodTip(0, 0), { x: 180, y: 221 });
  for (const rodAngle of [-14, 0, 8, 22]) for (const lean of [-3, 0, 4]) {
    const b = lean * Math.PI / 180;
    const hand = { x: -7 + 365 + (322 - 365) * Math.cos(b) - (370 - 455) * Math.sin(b), y: 2 + 455 + (322 - 365) * Math.sin(b) + (370 - 455) * Math.cos(b) };
    const tip = rodTip(rodAngle, lean, -7, 2);
    assert.ok(Math.abs(Math.hypot(tip.x - hand.x, tip.y - hand.y) - Math.hypot(142, 149)) < 1e-8);
    const end = { x: 72, y: 454 };
    const path = linePath(tip, end, .96);
    assert.ok(path.startsWith(`M${tip.x} ${tip.y} `));
    assert.ok(path.endsWith(' 72 454'));
  }
});
test('bite drags the whole angler left and a skill-check hit pulls the rod up and back', () => {
  const fishStart = biteFishPosition({ x: 160, y: 470 }, 0);
  const fishEnd = biteFishPosition({ x: 160, y: 470 }, 1);
  assert.deepEqual(fishStart, { x: 180, y: 482 });
  assert.ok(fishEnd.x < fishStart.x && fishEnd.y < fishStart.y);
  const bite = anglerPose('approach', 2200, null, 0);
  assert.ok(bite.shiftX < 0);
  const fight = { phase: 'pass', elapsed: 100, motionTime: 0 };
  const base = anglerPose('fight', 0, fight, 0, false, 0);
  const hook = anglerPose('fight', 0, fight, 0, false, 1);
  const baseTip = rodTip(base.rodAngle, base.lean, base.shiftX, base.shiftY);
  const hookTip = rodTip(hook.rodAngle, hook.lean, hook.shiftX, hook.shiftY);
  assert.ok(hookTip.x > baseTip.x);
  assert.ok(hookTip.y < baseTip.y);
});

test('a rare fish swims around the float with lake perspective before pulling left', () => {
  const point = { x: 160, y: 470 };
  const start = orbitFishPosition(point, 0), quarter = orbitFishPosition(point, .25);
  const half = orbitFishPosition(point, .5), end = orbitFishPosition(point, 1);
  assert.equal(RARE_ORBIT_MS, 1000);
  const biteStart = biteFishPosition(point, 0);
  assert.ok(Math.hypot(start.x - biteStart.x, start.y - biteStart.y) < 1e-10);
  assert.ok(Math.hypot(end.x - start.x, end.y - start.y) < 1e-10);
  const samples = Array.from({ length: 101 }, (_, index) => orbitFishPose(point, index / 100));
  const near = samples.reduce((best, pose) => pose.y > best.y ? pose : best);
  const far = samples.reduce((best, pose) => pose.y < best.y ? pose : best);
  assert.ok(near.scaleY > far.scaleY);
  assert.ok(near.opacity > far.opacity);
  assert.ok(samples.some(pose => pose.scaleX < 0));
  assert.ok(samples.some(pose => Math.abs(pose.scaleX) < .1));
  assert.ok(Math.abs(orbitFishPose(point, 0).angle) < 1e-10);
  assert.ok(Math.abs(orbitFishPose(point, 1).angle) < 1e-10);
  assert.ok(quarter.x < point.x);
  assert.ok(half.x < point.x && half.y < point.y);
  assert.ok(biteFishPosition(point, 1).x < end.x);
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
