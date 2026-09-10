import assert from 'node:assert/strict';
import { filterSubgroup, teacherSchedule } from '../src/schedule-modes.js';

const record = { dayOfWeek: 3, dayOfWeekName: 'Среда', course: 3, groupName: '7', startTime: '14.50', endTime: '16.15', isCommon: false, isLecture: false,
  classTitleA: 'ДП-1', professorNameA: 'Цеховая Т.В.', classroomA: '400',
  classTitleB: 'ДП-2', professorNameB: 'Цеховая Т.В.', classroomB: '132' };
const simultaneous = teacherSchedule({ classes: [record] }, 'Цеховая');
assert.equal(simultaneous.classes.length, 1);
assert.equal(simultaneous.classes[0].isCommon, false);
assert.deepEqual(simultaneous.classes[0].teacherLessons.map(entry => entry.label), ['А', 'Б']);
const lecture = { ...record, dayOfWeek: 5, isCommon: true, isLecture: true, professorNameA: 'Доцент Цеховая Т.В.' };
const lectures = teacherSchedule({ classes: [lecture, { ...lecture, groupName: '8' }] }, 'Цеховая');
assert.equal(lectures.classes.length, 1);
assert.equal(lectures.classes[0].isLecture, true);
assert.equal(lectures.classes[0].teacherLessons.length, 1);
assert.match(lectures.classes[0].subgroupA.comments, /группа 7.*группа 8/u);
const group = { classes: [{ isCommon: false, subgroupA: { classTitle: 'ДП-1' }, subgroupB: { classTitle: 'ДП-2' } }, { isCommon: true, subgroupA: { classTitle: 'Лекция' } }] };
assert.equal(filterSubgroup(group, 'subgroupA').classes[0].colorScope, 'subgroup-a');
assert.equal(filterSubgroup(group, 'subgroupB').classes[0].colorScope, 'subgroup-b');
assert.equal(filterSubgroup(group, 'subgroupB').classes[1].colorScope, undefined);
assert.equal(group.classes[0].isCommon, false);
console.log('Teacher slots, lecture deduplication and shared color scopes passed');
