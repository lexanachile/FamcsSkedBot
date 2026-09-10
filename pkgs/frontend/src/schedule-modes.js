import { createTeacherDirectory, setupTeacherSuggestions } from './teacher-suggestions.js?v=24';
import { setupComparison } from './comparison.js?v=29';

export function filterSubgroup(data, subgroup) {
  return { ...data, classes: (data.classes || []).flatMap(item => {
    if (item.isCommon) return [item];
    const lesson = item[subgroup];
    if (!lesson || !Object.values(lesson).some(Boolean)) return [];
    return [{ ...item, isCommon: true, subgroupA: lesson, subgroupB: null, colorScope: subgroup === 'subgroupA' ? 'subgroup-a' : 'subgroup-b' }];
  }) };
}

export function teacherSchedule(data, name) {
  const normalize = value => value.trim().toLocaleLowerCase('ru').replaceAll('ё', 'е');
  const query = normalize(name);
  const slots = new Map();
  for (const item of data.classes || []) {
    const common = item.isCommon === true || item.isCommon === 1;
    for (const side of ['A', 'B']) {
      if (side === 'B' && common) continue;
      const professor = item[`professorName${side}`] || '';
      if (!normalize(professor).includes(query)) continue;
      const key = `${item.dayOfWeek}|${item.startTime?.replace('.', ':')}|${item.endTime?.replace('.', ':')}`;
      if (!slots.has(key)) slots.set(key, { ...item, entries: [] });
      const slot = slots.get(key);
      const lesson = {
        classTitle: item[`classTitle${side}`], professorName: professor,
        classroom: item[`classroom${side}`],
        comments: item[`comments${side}`] || item.comments || '',
      };
      const isLecture = item.isLecture === true || item.isLecture === 1;
      const signature = JSON.stringify([lesson, isLecture, common ? 'common' : `${item.course}/${item.groupName}/${side}`]);
      const audience = `${item.course} курс · группа ${item.groupName}${common ? '' : ` · подгруппа ${side === 'A' ? 'А' : 'Б'}`}`;
      const existing = slot.entries.find(entry => entry.signature === signature);
      if (existing) { if (!existing.audiences.includes(audience)) existing.audiences.push(audience); }
      else slot.entries.push({ signature, lesson, isLecture, label: common ? '' : side === 'A' ? 'А' : 'Б', audiences: [audience] });
    }
  }
  return { teacher: name, classes: [...slots.values()].map(({ entries, ...slot }) => {
    const lessons = entries.map(entry => ({ ...entry, lesson: { ...entry.lesson, comments: [...entry.audiences, entry.lesson.comments].filter(Boolean).join(' · ') } }));
    return { ...slot, isCommon: lessons.length === 1, isLecture: lessons.every(entry => entry.isLecture), subgroupA: lessons[0].lesson, subgroupB: lessons[1]?.lesson || null, teacherLessons: lessons };
  }) };
}

export function setupScheduleModes({ onChange, onTeacher, apiBase, comparison }) {
  const modeStorageKey = 'schedule-mode:v1';
  const savedMode = (() => {
    try { return localStorage.getItem(modeStorageKey); } catch { return null; }
  })();
  const subgroupStorageKey = 'schedule-subgroup:v1';
  const savedSubgroup = (() => {
    try {
      return localStorage.getItem(subgroupStorageKey) === 'subgroupB' ? 'subgroupB' : 'subgroupA';
    } catch { return 'subgroupA'; }
  })();
  const icons = [
    '<circle cx="12" cy="8" r="4"/><path d="M5 21v-2a7 7 0 0 1 14 0v2"/>',
    '<circle cx="9" cy="8" r="3"/><path d="M2 21v-2a7 7 0 0 1 14 0v2M16 5a3 3 0 0 1 0 6M18 14a6 6 0 0 1 4 5v2"/>',
    '<path d="m2 8 10-5 10 5-10 5L2 8Zm4 3v6c4 3 8 3 12 0v-6M22 8v9"/>',
    '<rect x="3" y="4" width="18" height="17" rx="4"/><path d="M8 2v4M16 2v4M3 10h18M12 13v5M9.5 15.5h5"/>',
  ];
  const modes = [
    ['subgroup', 'Моя подгруппа', 'p.s. Нажмите на время пары, чтобы выбрать цвет для заметки'],
    ['group', 'Обе подгруппы вместе', 'p.s. Нажмите на время пары, чтобы выбрать цвет для заметки'],
    ['teacher', 'Поиск по фамилии', ''],
    ['compare', 'Сравнение расписаний', ''],
  ];
  const section = document.createElement('section');
  const modeLabels = ['Подгруппа', 'Группа', 'Преподаватели', 'Сравнение'];
  section.className = 'mode-section';
  section.setAttribute('aria-label', 'Режим расписания');
  section.innerHTML = `<div class="mode-grid">${modes.map(([id, title], i) => `<div class="mode-option"><span class="mode-label">${modeLabels[i]}</span><button type="button" class="mode-card" data-mode="${id}" aria-label="${title}" title="${title}" aria-pressed="false"><span class="mode-icon mode-icon-${id}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[i]}</svg></span></button></div>`).join('')}</div><p id="mode-description" class="mode-description" aria-live="polite" hidden></p>
    <form id="teacher-form" class="mode-panel" hidden><label for="teacher-name">Поиск по фамилии</label><div class="teacher-input-row"><input id="teacher-name" name="teacher" placeholder="Например, Орлович" autocomplete="off" required maxlength="80"><button type="submit">Найти</button></div></form>
    <section id="compare-panel" class="compare-panel" aria-label="Сравнение расписаний" hidden></section>`;
  document.querySelector('.header').after(section);
  const comparisonController = setupComparison({ panel: document.getElementById('compare-panel'), ...comparison });
  const activateSuggestions = setupTeacherSuggestions({
    form: document.getElementById('teacher-form'),
    loadNames: createTeacherDirectory(apiBase),
    onSelect: onTeacher,
  });
  document.querySelector('.subtitle').textContent = 'Какое расписание посмотрим?';
  const controls = document.querySelector('.controls-section');
  controls.hidden = true;
  const updateControlsHeight = () => document.documentElement.style.setProperty('--controls-height', `${controls.hidden ? 0 : controls.offsetHeight}px`);
  new ResizeObserver(updateControlsHeight).observe(controls);
  const subgroup = document.createElement('div');
  subgroup.className = 'subgroup-control';
  subgroup.hidden = true;
  subgroup.innerHTML = `<span class="subgroup-label">Подгруппа</span><div class="subgroup-buttons" role="group" aria-label="Подгруппа"><button type="button" data-subgroup="subgroupA" aria-pressed="${savedSubgroup === 'subgroupA'}">А</button><button type="button" data-subgroup="subgroupB" aria-pressed="${savedSubgroup === 'subgroupB'}">Б</button></div><select id="subgroup-select" hidden><option value="subgroupA">А</option><option value="subgroupB">Б</option></select>`;
  subgroup.querySelector('select').value = savedSubgroup;
  controls.querySelector('.controls-select-row').insertBefore(subgroup, document.getElementById('refresh-schedule-button'));
  subgroup.querySelectorAll('[data-subgroup]').forEach(button => button.addEventListener('click', () => {
    subgroup.querySelector('select').value = button.dataset.subgroup;
    try { localStorage.setItem(subgroupStorageKey, button.dataset.subgroup); } catch { /* storage unavailable */ }
    subgroup.querySelectorAll('button').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
    onChange('subgroup', false);
  }));
  section.querySelectorAll('[data-mode]').forEach(button => button.addEventListener('click', () => {
    const mode = button.dataset.mode;
    try { localStorage.setItem(modeStorageKey, mode); } catch { /* storage unavailable */ }
    const description = document.getElementById('mode-description');
    const selected = modes.find(item => item[0] === mode);
    description.textContent = mode === 'compare' ? '' : [selected[1], selected[2]].filter(Boolean).join('\n');
    description.hidden = mode === 'compare';
    section.querySelectorAll('[data-mode]').forEach(card => card.setAttribute('aria-pressed', String(card === button)));
    controls.hidden = !['group', 'subgroup'].includes(mode);
    document.getElementById('refresh-schedule-button').hidden = controls.hidden;
    subgroup.hidden = mode !== 'subgroup';
    updateControlsHeight();
    document.getElementById('teacher-form').hidden = mode !== 'teacher';
    activateSuggestions(mode === 'teacher');
    comparisonController.activate(mode === 'compare');
    onChange(mode, true);
  }));
  document.getElementById('teacher-form').addEventListener('submit', event => {
    event.preventDefault();
    const name = document.getElementById('teacher-name').value.trim();
    if (name) onTeacher(name);
  });
  if (modes.some(([id]) => id === savedMode)) {
    section.querySelector(`[data-mode="${savedMode}"]`)?.click();
  }
}
