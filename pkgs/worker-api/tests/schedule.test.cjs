const { readFileSync } = require('node:fs');
const assert = require('node:assert/strict');
const ts = require('typescript');
const path = require('node:path');
const moduleUrls = new Map();

function moduleUrl(file) {
  file = path.resolve(file);
  if (moduleUrls.has(file)) return moduleUrls.get(file);
  const source = readFileSync(file, 'utf8');
  let { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } });
  outputText = outputText.replace(/from ["'](\.[^"']+)["']/g, (_, specifier) => `from '${moduleUrl(path.resolve(path.dirname(file), specifier + '.ts'))}'`);
  const url = `data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`;
  moduleUrls.set(file, url);
  return url;
}

async function load(file) {
  return import(moduleUrl(`${__dirname}/../src/${file}.ts`));
}

(async () => {
  const { extractTeacherNames } = await load('formatters');
  for (const name of ['Пазюра', 'ПазюраЕ.В.', 'ПазюраЕ.В.   05,26.09']) {
    assert.deepEqual(extractTeacherNames(name), ['Пазюра']);
  }
  assert.deepEqual(extractTeacherNames('Абрамова Е И.; Козел Е.В; ШибалкоС.А.; Таран А.С'), ['Абрамова', 'Козел', 'Шибалко', 'Таран']);
  assert.deepEqual(extractTeacherNames('05,26.09'), []);
  assert.deepEqual(extractTeacherNames('Доцент Цеховая Т.В.; Профессор Иванов И.И.; ст. пр. Полузеров Т.Д.'), ['Цеховая', 'Иванов', 'Полузеров']);
  assert.deepEqual(extractTeacherNames('Старший преподаватель Урбанович Ю.В.'), ['Урбанович']);

  const { configuredRooms, findRooms } = await load('schedule/rooms');
  assert.throws(() => configuredRooms());
  assert.throws(() => configuredRooms('[123]'));
  const rooms = configuredRooms('["102", "101", "101", "103"]');
  const record = { dayOfWeek: 1, startTime: '08:00', endTime: '09:30', classroomA: '101', classroomB: '999; 102' };
  assert.deepEqual(findRooms(rooms, [record], 1, '09:00', '10:20'), { freeRooms: ['103'], busyRooms: ['101', '102'], totalRooms: 3 });
  assert.deepEqual(findRooms(rooms, [record], 1, '09:30', '10:50').freeRooms, rooms);
  assert.deepEqual(findRooms(rooms, [record], 2, '09:00', '10:20').freeRooms, rooms);
  assert.deepEqual(findRooms(rooms, [{ ...record, startTime: '8.00', endTime: '9.30' }], 1, '09:00', '10:20').freeRooms, ['103']);
  assert.deepEqual(findRooms(rooms, [{ ...record, startTime: '', endTime: '' }], 1, '09:00', '10:20').freeRooms, ['103']);

  const { toScheduleClass } = await load('schedule/records');
  const formatted = toScheduleClass({ comments: 'Общее', commentsA: 'Только А', commentsB: 'Только Б' });
  assert.equal(formatted.subgroupA.comments, 'Только А');
  assert.equal(formatted.subgroupB.comments, 'Только Б');

  const { readGroupSchedule, readCourse } = await load('schedule/repository');
  const { manifestKey, groupKey } = await load('schedule/keys');
  const data = new Map();
  const kv = { get: async key => data.get(key) ?? null };
  const entry = { version: 'new', previousVersion: null, updatedAt: 'today', fingerprint: 'a'.repeat(64), recordCount: 1 };
  data.set(manifestKey(1), { current: 'publication', previous: 'old', updatedAt: 'today', groups: { '1': entry } });
  data.set(groupKey('old', 1, 'removed'), [{ groupName: 'removed' }]);
  assert.deepEqual((await readGroupSchedule(kv, 1, 'removed')).records, []);
  await assert.rejects(readGroupSchedule(kv, 1, '1'), /unavailable/);
  await assert.rejects(readCourse(kv, 1), /incomplete/);
  const teacherRecords = [
    { course: 1, groupName: '1', dayOfWeek: 1, professorNameA: 'Семёнов А.А.', professorNameB: 'Семенова Б.Б.' },
    { course: 1, groupName: '1', dayOfWeek: 2, professorNameA: 'ИвановИ.И.' },
  ];
  data.set(groupKey('new', 1, '1'), { records: teacherRecords, updatedAt: 'today' });
  const routes = new Map();
  const { registerScheduleRoutes } = await load('routes/schedule');
  registerScheduleRoutes({ get: (url, handler) => routes.set(url, handler), post() {} });
  const call = (url, params) => routes.get(url)({ req: { query: key => params[key] }, env: { SCHEDULE_KV: kv }, json: (body, status = 200) => ({ body, status }) });
  for (const name of ['Семёнов', 'семенов', 'СЕМЕНОВ', 'Семёнов А.А.']) {
    const result = await call('/api/teacher', { name });
    assert.equal(result.status, 200);
    assert.equal(result.body.data.classes.length, 1, name);
    assert.equal(result.body.data.classes[0].dayOfWeek, 1);
  }
  assert.equal((await call('/api/teacher', { name: 'Иванов' })).body.data.classes.length, 1);
  assert.equal((await call('/api/groups', { course: '1junk' })).status, 400);
  assert.equal((await call('/api/groups', { course: '1.5' })).status, 400);

  const { enqueueChanges } = await load('schedule/notifications');
  const messages = [];
  const env = {
    TEST_TELEGRAM_USER_ID: '42',
    NOTIFICATIONS_QUEUE: { send: async message => messages.push(message) },
    DB: { prepare: () => ({ bind: () => ({ all: async () => ({ results: [{ telegram_id: '42', chat_id: '42' }, { telegram_id: '43', chat_id: '43' }] }) }) }) },
  };
  await enqueueChanges(env, 5, { '1': 'Изменение', '2': 'Ещё изменение' });
  assert.equal(messages.filter(message => message.chat_id === '42').length, 2);
  assert.equal(messages.length, 4);
  assert.ok(messages.every(message => message.text.startsWith('Курс 5\n')));
  console.log('Schedule regression checks passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
