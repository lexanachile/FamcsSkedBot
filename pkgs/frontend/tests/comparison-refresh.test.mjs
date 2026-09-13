import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

// Exercise the real request/cache functions without a browser layout mock.
function comparison() {
  const requests = [];
  const columns = ['subgroupA', 'subgroupB'].map(subgroup => ({ course: '1', group: '1', subgroup, data: { classes: [], marker: 'cached' } }));
  const cache = new Map([[JSON.stringify(['1', '1']), Promise.resolve(columns[0].data)]]);
  const context = vm.createContext({
    URL, columns, cache, apiBase: 'https://example.test', render() {},
    requestData(url, options) {
      return new Promise((resolve, reject) => requests.push({ url, options, resolve, reject }));
    },
  });
  const source = readFileSync(new URL('../src/comparison.js', import.meta.url), 'utf8');
  const start = source.indexOf('  async function loadColumn(');
  const end = source.indexOf("  form.addEventListener('submit'", start);
  vm.runInContext(source.slice(start, end), context);
  return { columns, requests, run: code => vm.runInContext(code, context) };
}

test('forced comparison refresh shares one fresh request across subgroups', async () => {
  const c = comparison();
  const refresh = c.run('refresh()');
  assert.equal(c.requests.length, 1);
  assert.equal(c.requests[0].options.cache, 'no-store');
  assert.equal(c.columns[0].data.marker, 'cached');
  c.requests[0].resolve({ classes: [], marker: 'fresh' });
  await refresh;
  assert.deepEqual(c.columns.map(column => column.data.marker), ['fresh', 'fresh']);
  const again = c.run('refresh()');
  assert.equal(c.requests.length, 2);
  c.requests[1].reject(new Error('offline'));
  await again;
  assert.ok(c.columns.every(column => !column.loading && column.error && column.data.marker === 'fresh'));
});

test('late comparison response cannot overwrite a newer refresh', async () => {
  const c = comparison();
  const older = c.run('refresh()');
  const newer = c.run('refresh()');
  c.requests[1].resolve({ classes: [], marker: 'new' });
  await newer;
  c.requests[0].resolve({ classes: [], marker: 'old' });
  await older;
  assert.deepEqual(c.columns.map(column => column.data.marker), ['new', 'new']);
});
