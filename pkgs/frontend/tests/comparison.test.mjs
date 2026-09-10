import assert from 'node:assert/strict';
import { comparisonDay, selectionKey, minutes, clockTime } from '../src/comparison-model.js';

const day = 'Понедельник';
const time = item => ({ start: item.startTime, end: item.endTime });
const lesson = title => ({ classTitle: title, professorName: 'Преподаватель', classroom: '442' });
const pair = (start, end, extra = {}) => ({ dayOfWeek: 1, startTime: start, endTime: end,
  isCommon: false, subgroupA: lesson('А'), subgroupB: lesson('Б'), ...extra });
const column = (subgroup, classes) => ({ course: '1', group: '1', subgroup, data: { classes } });
const data = [pair('9.00', '10.20'), pair('10:30', '11:50', { isCommon: 1, isLecture: 1, subgroupB: null })];
const original = JSON.stringify(data);
const result = comparisonDay([column('subgroupA', data), column('subgroupB', data)], day, time);
assert.deepEqual(result.boundaries, [540, 620, 630, 710]);
assert.equal(result.schedules[0].entries[0].lessons[0].lesson.classTitle, 'А');
assert.equal(result.schedules[1].entries[0].lessons[0].lesson.classTitle, 'Б');
assert.equal(result.schedules[1].entries[1].lessons[0].scope, 'common');
assert.equal(result.schedules[1].entries[1].lessons[0].isLecture, true);
assert.equal(JSON.stringify(data), original, 'comparison must not mutate the regular schedule');

// Overlap across groups shares boundaries. Within a group, overlapping lessons
// get separate lanes, while consecutive lessons reuse their lane.
const overlap = comparisonDay([
  column('subgroupA', [pair('09:00', '10:20'), pair('09:30', '11:00'), pair('11:00', '12:00')]),
  column('subgroupB', [pair('09:45', '10:45')]),
], day, time);
assert.deepEqual(overlap.boundaries, [540, 570, 585, 620, 645, 660, 720]);
assert.equal(overlap.schedules[0].lanes, 2);
assert.deepEqual(overlap.schedules[0].entries.map(item => item.lane), [0, 1, 0]);
assert.equal(overlap.schedules[1].lanes, 1);

// Multiple alternatives in the exact same time slot remain visible in one cell.
const alternatives = comparisonDay([column('subgroupA', [pair('9.00', '10.20'), pair('9:00', '10:20')])], day, time);
assert.equal(alternatives.schedules[0].entries.length, 1);
assert.equal(alternatives.schedules[0].entries[0].lessons.length, 2);
assert.equal(alternatives.schedules[0].lanes, 1);

const invalid = comparisonDay([column('subgroupB', [
  pair('bad', '10:00'), pair('11:00', '10:00'), pair('10:00', '10:00'),
  pair('9:00', '10:00', { subgroupB: null }), pair('9:00', '10:00', { dayOfWeek: 2 }),
])], day, time);
assert.equal(invalid.skipped, 3);
assert.deepEqual(invalid.boundaries, []);
assert.deepEqual(comparisonDay([], day, time).schedules, []);

// The time callback sees only the chosen subgroup (PE may specify its own time).
comparisonDay([column('subgroupB', data)], day, selected => {
  assert.equal(selected.subgroupB, null);
  assert.ok(['А', 'Б'].includes(selected.subgroupA.classTitle));
  return time(selected);
});
assert.equal(minutes('09.05'), 545);
assert.equal(clockTime(545), '09:05');
for (const value of ['24:00', '10:60', '', null, 'x']) assert.ok(Number.isNaN(minutes(value)));
assert.equal(selectionKey({ course: 1, group: '1', subgroup: 'subgroupA' }), selectionKey(column('subgroupA', [])));
assert.notEqual(selectionKey(column('subgroupA', [])), selectionKey(column('subgroupB', [])));
console.log('Comparison: subgroups, lectures, time alignment, overlaps, alternatives, empty and invalid data passed');
