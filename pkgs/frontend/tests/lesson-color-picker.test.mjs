import test from 'node:test';
import assert from 'node:assert/strict';
import { recentColors, hsvToHex } from '../src/lesson-color-picker.js';

test('recent colors reject corrupt storage, exclude presets and retain two unique latest colors', () => {
  const presets = [{ color: '#FF5F56' }];
  assert.deepEqual(recentColors({ broken: true }, presets), []);
  assert.deepEqual(recentColors(['#AA00FF', '#aa00ff', '#FF5F56', null, 'red', '#123456', '#abcdef'], presets), ['#aa00ff', '#123456', '#abcdef']);
  assert.deepEqual(recentColors(['#123456', '#aa00ff', '#123456'], presets), ['#123456', '#aa00ff']);
});

test('HSV palette covers primary colors, hue wrap, white and black', () => {
  for (const [h, color] of [[0, '#ff0000'], [60, '#ffff00'], [120, '#00ff00'], [180, '#00ffff'], [240, '#0000ff'], [300, '#ff00ff'], [360, '#ff0000']]) {
    assert.equal(hsvToHex(h, 1, 1), color);
  }
  assert.equal(hsvToHex(130, 0, 1), '#ffffff');
  assert.equal(hsvToHex(230, 1, 0), '#000000');
  assert.equal(hsvToHex(0, 0, .5), '#808080');
});

test('shade adjustments reuse one slot until a new palette session begins', () => {
  const baseline = ['#123456', '#abcdef'];
  let stored = recentColors(['#aa00ff', ...baseline], []);
  assert.deepEqual(stored, ['#aa00ff', '#123456', '#abcdef']);
  stored = recentColors(['#aa01ff', ...baseline], []);
  assert.deepEqual(stored, ['#aa01ff', '#123456', '#abcdef']);
  const nextSession = [...stored];
  stored = recentColors(['#22aaff', ...nextSession], []);
  assert.deepEqual(stored, ['#22aaff', '#aa01ff', '#123456']);
  assert.deepEqual(stored.slice().reverse(), ['#123456', '#aa01ff', '#22aaff']);
});
