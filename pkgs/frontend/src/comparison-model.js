export const COMPARISON_DAYS = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'];

export function selectionKey({ course, group, subgroup }) {
  return JSON.stringify([String(course), String(group), subgroup]);
}

export function minutes(value) {
  const match = String(value || '').match(/^(\d{1,2})[.:](\d{2})$/);
  if (!match || Number(match[1]) > 23 || Number(match[2]) > 59) return NaN;
  return Number(match[1]) * 60 + Number(match[2]);
}

export function clockTime(value) {
  return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
}

// Every start/end is a shared grid boundary, including partially overlapping
// lessons and nonstandard PE times. Separate lanes prevent overlap within a group.
export function comparisonDay(columns, day, displayedTime) {
  const boundaries = new Set();
  let skipped = 0;
  const schedules = columns.map(column => {
    const slots = new Map();
    for (const item of column.data?.classes || []) {
      const itemDay = item.dayOfWeekName || COMPARISON_DAYS[Number(item.dayOfWeek) - 1];
      if (itemDay !== day) continue;
      const common = item.isCommon === true || item.isCommon === 1;
      const lesson = common ? item.subgroupA : item[column.subgroup];
      if (!lesson || !Object.values(lesson).some(Boolean)) continue;
      const selected = { ...item, subgroupA: lesson, subgroupB: null };
      const time = displayedTime(selected);
      const start = minutes(time.start);
      const end = minutes(time.end);
      if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) { skipped++; continue; }
      const key = `${start}/${end}`;
      if (!slots.has(key)) slots.set(key, { start, end, lessons: [] });
      slots.get(key).lessons.push({ lesson, isLecture: item.isLecture === true || item.isLecture === 1,
        scope: common ? 'common' : column.subgroup === 'subgroupB' ? 'subgroup-b' : 'subgroup-a' });
      boundaries.add(start);
      boundaries.add(end);
    }
    const entries = [...slots.values()].sort((a, b) => a.start - b.start || a.end - b.end);
    const laneEnds = [];
    for (const entry of entries) {
      let lane = laneEnds.findIndex(end => end <= entry.start);
      if (lane === -1) lane = laneEnds.length;
      laneEnds[lane] = entry.end;
      entry.lane = lane;
    }
    return { entries, lanes: Math.max(1, laneEnds.length) };
  });
  return { boundaries: [...boundaries].sort((a, b) => a - b), schedules, skipped };
}
