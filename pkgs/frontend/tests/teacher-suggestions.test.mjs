import test from 'node:test';
import assert from 'node:assert/strict';
import { createTeacherDirectory, hasTeacher, matchingTeachers, setupTeacherSuggestions } from '../src/teacher-suggestions.js';
import { teacherSchedule } from '../src/schedule-modes.js';

test('teacher match uses whole surnames, initials, roles and yo normalization', () => {
  assert.equal(hasTeacher('Профессор Иванова И.И.', 'Иванов'), false);
  assert.equal(hasTeacher('ИвановИ.И.; Доцент Цеховая Т.В.', 'Цеховая'), true);
  assert.equal(hasTeacher('ИвановИ.И.', 'Иванов'), true);
  assert.equal(hasTeacher('Семёнов А.А.', 'семенов'), true);
  assert.equal(hasTeacher('Семёнов А.А.', 'Семёнов А.А.'), true);
  assert.deepEqual(matchingTeachers(['Семёнов', 'Иванов'], 'семе'), ['Семёнов']);
  const result = teacherSchedule({ classes: [{ dayOfWeek: 1, professorNameA: 'Иванов И.И.', professorNameB: 'Иванова А.А.', classTitleA: 'A', classTitleB: 'B' }] }, 'Иванов');
  assert.equal(result.classes[0].teacherLessons.length, 1);
});

test('directory shares concurrent requests and retries a failed load', async () => {
  let calls = 0;
  const directory = createTeacherDirectory('', async () => {
    if (++calls === 1) throw new Error('offline');
    return { ok: true, json: async () => ({ success: true, data: { teachers: ['Цеховая', 'Цеховая'] } }) };
  });
  const first = await Promise.allSettled([directory(), directory()]);
  assert.ok(first.every(result => result.status === 'rejected'));
  assert.equal(calls, 1);
  assert.deepEqual(await directory(), ['Цеховая']);
  await directory();
  assert.equal(calls, 2);
});

for (const gesture of ['click', 'tap', 'scroll', 'cancel', 'multi-touch']) {
test(`suggestion interaction: ${gesture}`, async () => {
  class Element {
    children = []; listeners = {}; value = 'Це';
    setAttribute() {}
    replaceChildren() { this.children = []; }
    append(...items) { this.children.push(...items); }
    appendChild(item) { this.append(item); }
    addEventListener(name, handler) { (this.listeners[name] ||= []).push(handler); }
    dispatch(name, event = {}) { for (const handler of this.listeners[name] || []) handler(event); }
    focus() { this.dispatch('focus'); }
    blur() { form.dispatch('focusout', { relatedTarget: null }); }
    contains(item) { return item === input || this.children.includes(item); }
    querySelector() { return input; }
  }
  const input = new Element(), form = new Element(), selected = [];
  const previousDocument = globalThis.document;
  globalThis.document = { createElement: () => new Element(), addEventListener() {} };
  try {
    const activate = setupTeacherSuggestions({ form, loadNames: async () => ['Цеховая'], onSelect: name => selected.push(name) });
    await activate(true);
    const list = form.children[1], button = list.children[0];
    form.dispatch('focusout', { relatedTarget: null });
    assert.equal(list.hidden, false);
    if (gesture !== 'click') {
      const point = { identifier: 1, clientX: 20, clientY: 20 };
      button.dispatch('touchstart', { touches: gesture === 'multi-touch' ? [point, { ...point, identifier: 2 }] : [point] });
      if (gesture === 'scroll') {
        button.dispatch('touchmove', { changedTouches: [{ ...point, clientY: 60 }] });
      }
      if (gesture === 'cancel') button.dispatch('touchcancel');
      let prevented = false;
      button.dispatch('touchend', { touches: [], changedTouches: [point], preventDefault() { prevented = true; } });
      assert.equal(prevented, gesture === 'tap');
      assert.deepEqual(selected, gesture === 'tap' ? ['Цеховая'] : []);
    }
    // A synthetic click after touchend must not launch a second request,
    // or select a teacher after a drag/cancelled gesture.
    button.dispatch('click', { detail: 1 });
    if (['scroll', 'cancel', 'multi-touch'].includes(gesture)) {
      assert.deepEqual(selected, []);
      assert.equal(list.hidden, false);
      return;
    }
    assert.equal(input.value, 'Цеховая');
    assert.deepEqual(selected, ['Цеховая']);
    assert.equal(list.hidden, true);
  } finally { globalThis.document = previousDocument; }
});
}
