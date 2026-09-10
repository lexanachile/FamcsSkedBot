const { readFileSync } = require('node:fs');
const assert = require('node:assert/strict');
const ts = require('typescript');

async function load(file) {
  const source = readFileSync(`${__dirname}/../src/${file}.ts`, 'utf8');
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } });
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
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
