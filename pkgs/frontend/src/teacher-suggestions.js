const normalize = value => value.trim().toLocaleLowerCase('ru').replaceAll('ё', 'е');

export function createTeacherDirectory(apiBase, request = fetch) {
  let names = null;
  let pending = null;
  return async () => {
    if (names !== null) return names;
    if (!pending) {
      pending = (async () => {
        // Не используем AbortSignal.timeout: старые Telegram WebView не
        // реализуют этот метод и тогда подсказки ломаются ещё до fetch.
        const response = await request(`${apiBase}/api/teachers`);
        if (!response.ok) throw new Error('Не удалось загрузить фамилии');
        const result = await response.json();
        if (!result.success || !Array.isArray(result.data?.teachers)) throw new Error('Некорректный список преподавателей');
        names = [...new Set(result.data.teachers.filter(name => typeof name === 'string').map(name => name.trim()).filter(Boolean))]
          .sort((a, b) => a.localeCompare(b, 'ru'));
        return names;
      })();
    }
    try { return await pending; }
    finally { pending = null; }
  };
}

export function matchingTeachers(names, query) {
  const prefix = normalize(query);
  return prefix ? names.filter(name => normalize(name).startsWith(prefix)) : [];
}

export function setupTeacherSuggestions({ form, loadNames, onSelect }) {
  const input = form.querySelector('input');
  const status = document.createElement('p');
  status.id = 'teacher-suggestions-status';
  status.setAttribute('role', 'status');
  const list = document.createElement('div');
  list.className = 'teacher-suggestions';
  list.id = 'teacher-suggestions';
  list.setAttribute('role', 'group');
  list.setAttribute('aria-label', 'Подходящие преподаватели');
  list.hidden = true;
  input.setAttribute('aria-controls', list.id);
  input.setAttribute('aria-describedby', status.id);
  input.setAttribute('spellcheck', 'false');
  form.append(status, list);
  let names = [];
  let active = false;
  let loading = false;
  let failed = false;

  function render() {
    list.replaceChildren();
    list.hidden = true;
    if (!active) return;
    if (loading) { status.textContent = 'Загружаем фамилии…'; return; }
    if (failed) { status.textContent = 'Подсказки недоступны. Можно ввести фамилию и нажать «Найти».'; return; }
    const matches = matchingTeachers(names, input.value);
    status.textContent = !input.value.trim() ? 'Начните вводить фамилию' : matches.length ? `Найдено: ${matches.length}` : 'Совпадений нет. Проверьте фамилию.';
    for (const name of matches) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = name;
      button.addEventListener('click', () => {
        input.value = name;
        input.focus();
        list.hidden = true;
        status.textContent = `Выбран преподаватель: ${name}`;
        onSelect(name);
      });
      list.appendChild(button);
    }
    list.hidden = matches.length === 0;
  }

  input.addEventListener('input', render);
  input.addEventListener('focus', render);
  form.addEventListener('keydown', event => {
    if (event.key === 'Escape') { list.hidden = true; input.focus(); list.hidden = true; }
    if (event.key === 'ArrowDown' && event.target === input && !list.hidden) {
      event.preventDefault();
      list.querySelector('button')?.focus();
    }
  });
  form.addEventListener('submit', () => { list.hidden = true; });
  form.addEventListener('focusout', event => {
    if (!form.contains(event.relatedTarget)) list.hidden = true;
  });

  return async enabled => {
    active = enabled;
    if (!enabled) { list.hidden = true; return; }
    loading = true;
    failed = false;
    render();
    try { names = await loadNames(); }
    catch { failed = true; }
    finally { loading = false; render(); }
  };
}
