// Local preview compatibility for the deployed API's older surname parser.
// Remove this adapter after deploying the corrected worker-api formatter.
import { extractTeacherNames } from '../worker-api/src/formatters.ts';

const upstream = 'https://famcsschedulebot.yarashsei.workers.dev';
const titles = /^(?:Доцент|Профессор|Старший|Преподаватель|Ассистент)$/iu;
let cached;
let expires = 0;
const normalize = value => value.toLocaleLowerCase('ru').replaceAll('ё', 'е');
async function read(path) {
  const response = await fetch(upstream + path, { signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error(`Upstream API: ${response.status}`);
  const result = await response.json();
  if (!result.success) throw new Error('Upstream API failed');
  return result.data;
}
async function directory() {
  if (!cached || Date.now() >= expires) {
    expires = Date.now() + 5 * 60 * 1000;
    cached = (async () => {
      const { teachers } = await read('/api/teachers');
      const batches = await Promise.all(teachers.filter(name => titles.test(name)).map(name => read(`/api/teacher?name=${encodeURIComponent(name)}`)));
      const records = batches.flatMap(batch => batch.classes);
      const names = new Set(teachers.filter(name => !titles.test(name)));
      for (const record of records) {
        for (const name of extractTeacherNames([record.professorNameA, record.professorNameB].filter(Boolean).join(';'))) names.add(name);
      }
      return { teachers: [...names].sort((a, b) => a.localeCompare(b, 'ru')), records };
    })().catch(error => { cached = null; throw error; });
  }
  return cached;
}

export async function localTeacherResponse(url) {
  if (url.pathname === '/api/teachers') return { success: true, data: { teachers: (await directory()).teachers } };
  const name = url.searchParams.get('name')?.trim();
  if (!name) return { success: false, error: 'Missing name' };
  const [direct, extra] = await Promise.all([read(`/api/teacher?name=${encodeURIComponent(name)}`), directory()]);
  const records = [...direct.classes, ...extra.records].filter(record =>
    [record.professorNameA, record.professorNameB].some(value => extractTeacherNames(value || '').some(teacher => normalize(teacher) === normalize(name))),
  );
  const unique = new Map(records.map(record => [JSON.stringify(record), record]));
  return { success: true, data: { teacher: name, classes: [...unique.values()] } };
}
