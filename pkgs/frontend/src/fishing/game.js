import { lakeScene } from './scene.js?v=59';
import { createFight, advance, strike, displayedProgress, PASS_MS, REST_MS } from './engine.js?v=55';
import { createProgress } from './progress.js?v=58';
import { setupEnvironment } from './environment.js?v=55';
import { setupFullscreen } from './fullscreen.js?v=55';
import { bindStrikeInput } from './input.js?v=55';
import { getLocation, worldMapMarkup } from './locations.js?v=59';

import { createLocationNotice } from './location-notice.js?v=57';

export function anglerPose(state, elapsed, fight, motionTime, reduced = false) {
  const pulling = state === 'fight' && fight?.phase === 'rest';
  const effort = pulling ? Math.sin(Math.PI * Math.min(1, fight.elapsed / REST_MS)) : 0;
  return {
    pulling,
    lean: reduced ? 0 : effort * 3.5 + Math.sin(motionTime * 1.6) * .35,
    rodAngle: reduced ? 0 : effort * 12 + (state === 'casting' ? -14 * Math.sin(elapsed / 1100 * Math.PI) : Math.sin(motionTime * 1.6) * .45),
  };
}

export function rodTip(rodAngle, lean) {
  const a = rodAngle * Math.PI / 180;
  const localX = 453 - 103 * Math.cos(a) + 115 * Math.sin(a);
  const localY = 310 - 103 * Math.sin(a) - 115 * Math.cos(a);
  const b = lean * Math.PI / 180;
  return {
    x: 506 + (localX - 506) * Math.cos(b) - (localY - 386) * Math.sin(b),
    y: 386 + (localX - 506) * Math.sin(b) + (localY - 386) * Math.cos(b),
  };
}

export function mountFishing(host) {
  host.innerHTML = `<section class="fishing-game" aria-label="Рыбалка" tabindex="-1">
    <div class="fish-stage">${lakeScene()}${worldMapMarkup()}
      <section class="fish-home" aria-label="Дом и коллекция трофеев" hidden>
        <div class="fish-home-heading"><h2>Коллекция трофеев</h2><p class="fish-trophy-summary"></p><button type="button" class="fish-save">Сохранить улов</button></div>
        <p class="fish-trophy-empty">Здесь появятся карточки пойманных преподавателей.</p>
        <div class="fish-trophy-list"></div>
      </section>
      <div class="fish-hud"><span class="fish-count" title="Обычные рыбки в кармане">0 <small>РЫБОК</small></span><div class="fish-hud-buttons"><button type="button" class="fish-fullscreen" aria-label="На весь экран" aria-pressed="false">⛶</button><button type="button" class="fish-help-toggle" aria-label="Как играть" aria-expanded="false">?</button></div></div>
      <button type="button" class="fish-map-return" aria-label="Вернуться на карту" hidden><span>←</span> Карта</button>
      <div class="fish-location-name" hidden></div>
      <div class="fish-dev"><button type="button" class="fish-dev-toggle" aria-label="Настройки разработчика" aria-expanded="false"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="m8 6-6 6 6 6m8-12 6 6-6 6m-3-16-2 20"/></svg></button><div class="fish-dev-panel" hidden><label>Время<select name="fish-period"><option value="">Минск · авто</option><option value="morning">Утро</option><option value="day">День</option><option value="evening">Вечер</option><option value="night">Ночь</option></select></label><label>Погода<select name="fish-rain"><option value="">Минск · авто</option><option value="rain">Дождь</option><option value="dry">Без дождя</option></select></label><small class="fish-weather-error">Погода недоступна; сохранено последнее состояние.</small></div></div>
      <div class="fish-spots" aria-label="Место заброса"><button data-spot="deep" class="fish-spot fish-spot-deep" aria-label="Забросить на глубину"><span>+</span></button></div>
      <div class="fish-check" hidden><span class="fish-check-label">ПОПАДИ<br>В СЕКТОР</span><div class="fish-track"><div class="fish-zones"></div><div class="fish-cursor"></div></div><span class="fish-round"></span></div>
      <div class="fish-result" hidden><span class="fish-eyebrow">УЛОВ</span><div class="fish-portrait">?</div><h3></h3><p></p><button type="button" class="fish-again">Ещё заброс</button></div>
      <div class="fish-pause" hidden>Тихая пауза<span>Вернёмся к клёву, когда вы вернётесь.</span></div>
      <div class="fish-play-hud"><span class="fish-status" role="status" aria-live="polite"></span><span class="fish-hint" hidden></span><div class="fish-tension" hidden><span>РЫБА</span><div role="progressbar" aria-label="Прогресс вываживания" aria-valuemin="0" aria-valuemax="100"><i></i></div><span>ВЫ</span></div></div>
      <button class="fish-action" type="button" disabled aria-label="Подсечь">Подсечь</button>
    </div>
    <p class="fish-sync-status" role="status"></p>
    <div class="fish-help" hidden><p>Выберите локацию на карте, затем забросьте на глубину и дождитесь поклёвки.</p><p>Индикатор движется снизу вверх. Коснитесь кнопки подсечки или нажмите пробел, когда он внутри светлого сектора. Каждый сектор засчитывается один раз. Промахи и проходы без попаданий отнимают прогресс. Между проходами — 5 секунд паузы. Заполните шкалу, чтобы достать улов.</p></div>
  </section>`;
  const root = host.firstElementChild;
  const elements = new Map();
  const q = selector => {
    if (!elements.has(selector)) elements.set(selector, root.querySelector(selector));
    return elements.get(selector);
  };
  const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
  const locationNotice = createLocationNotice(q('.fish-location-name'));
  const environment = setupEnvironment(root);
  setupFullscreen(root);
  q('.fish-dev-toggle').addEventListener('click', e => { const panel = q('.fish-dev-panel'); panel.hidden = !panel.hidden; e.currentTarget.setAttribute('aria-expanded', String(!panel.hidden)); });
  let encounter = null, session = 0, motionTime = 0, environmentTime = 0;
  let state = 'idle', elapsed = 0, fight, point = { x: 282, y: 422 }, waitMs = 0;
  let selectedSpot = 'deep', currentLocation = 'crossing';
  let open = true, visible = true, raf = 0, last = 0, savedRound = 0;
  let progressState = { game: { wallet: { smallFish: 0 }, fish: {} }, pending: 0, cards: [], error: '' };
  let retryReveal = null;
  const progress = createProgress(value => {
    progressState = value;
    q('.fish-count').firstChild.textContent = `${value.game.wallet.smallFish} `;
    q('.fish-sync-status').textContent = value.error || (value.pending ? `Не сохранено уловов: ${value.pending}. Автосохранение раз в 5 минут.` : 'Улов сохранён');
    if (root.dataset.view === 'home') renderTrophies();
  });
  const status = (title, hint) => { q('.fish-status').textContent = title; q('.fish-hint').textContent = hint; };
  const action = (_label, disabled) => { q('.fish-action').textContent = disabled ? 'Тянем' : 'Подсечь'; q('.fish-action').disabled = disabled; };
  function setState(next) { state = next; elapsed = 0; root.dataset.state = next; }
  function zones() {
    q('.fish-zones').replaceChildren(...fight.zones.map(zone => {
      const el = document.createElement('i'); el.style.bottom = `${zone.start * 100}%`; el.style.height = `${(zone.end - zone.start) * 100}%`; return el;
    }));
    savedRound = fight.round;
  }
  function showProgress() {
    const bar = q('.fish-tension [role="progressbar"]');
    bar.setAttribute('aria-valuenow', String(Math.round(fight.progress)));
    const display = motionPreference.matches ? fight.progress : displayedProgress(fight);
    bar.firstElementChild.style.width = `${display}%`;
    bar.style.setProperty('--fish-progress', `${display}%`);
  }
  function renderTrophies() {
    const { game, cards } = progressState;
    q('.fish-trophy-summary').textContent = `В кармане: ${game.wallet.smallFish} рыбок`;
    q('.fish-trophy-empty').hidden = cards.length > 0;
    q('.fish-trophy-empty').textContent = 'Загружаем коллекцию…';
    q('.fish-trophy-list').replaceChildren(...cards.map(item => {
      const caught = game.fish[item.id]?.count || 0;
      const local = progress.pendingCard(item.id);
      const card = document.createElement('article');
      card.className = 'fish-trophy' + (caught ? '' : ' is-locked');
      const portrait = document.createElement('div'); portrait.className = 'fish-trophy-portrait'; portrait.textContent = caught ? '≈' : '🔒';
      const image = item.image || local?.image;
      if (caught && image) {
        const img = document.createElement('img'); img.src = image; img.alt = item.name || local?.name || ''; img.loading = 'lazy'; portrait.replaceChildren(img);
      }
      const copy = document.createElement('div');
      const name = document.createElement('h3'); name.textContent = caught ? (item.name || local?.name || 'Улов') : 'Ещё не пойман';
      const amount = document.createElement('p'); amount.textContent = caught ? `В коллекции: ${caught}` : '';
      const owners = document.createElement('p'); owners.textContent = `Есть у ${item.owners} рыбаков`;
      const tags = document.createElement('p');
      if (item.owners > 0 && item.owners < 3) tags.textContent = item.usernames.map(tag => tag ? '@' + tag : 'Рыбак без тега').join(', ');
      copy.append(name, amount, owners, tags); card.append(portrait, copy); return card;
    }));
  }
  function showMap() {
    locationNotice.hide();
    reset();
    root.dataset.view = 'map';
    q('.fish-world-map').hidden = false; q('.fish-home').hidden = true;
    q('.fish-map-return').hidden = true; q('.fish-location-name').hidden = true;
    root.querySelectorAll('[data-location]').forEach(button => button.setAttribute('aria-current', String(button.dataset.location === currentLocation)));
    syncPause();
  }
  function visit(locationId) {
    const location = getLocation(locationId);
    if (locationId !== 'home' && (!location || location.locked)) return;
    reset();
    if (locationId === 'home') {
      root.dataset.view = 'home'; q('.fish-world-map').hidden = true; q('.fish-home').hidden = false;
      q('.fish-map-return').hidden = false; q('.fish-location-name').hidden = true;
      locationNotice.show('Дом');
      renderTrophies();
      progress.collection().catch(error => { q('.fish-trophy-empty').textContent = error.message; });
      syncPause(); return;
    }
    currentLocation = location.id; root.dataset.location = location.id; root.dataset.view = 'fishing';
    q('.fish-spots').hidden = false;
    q('.fish-world-map').hidden = true; q('.fish-home').hidden = true; q('.fish-map-return').hidden = false;
    locationNotice.show(location.name);
    status('', '');
    syncPause();
  }
  async function finish() {
    const version = session;
    setState('result');
    q('.fish-check').hidden = true;
    q('.fish-result').hidden = false;
    const caught = fight.outcome === 'caught';
    let item = { name: 'Улов пойман', image: null, caption: 'Раскрываем улов…' };
    const portrait = q('.fish-portrait'); portrait.replaceChildren();
    portrait.textContent = caught ? '?' : '≈';
    q('.fish-result h3').textContent = caught ? item.name : 'Уплыла. Бывает.';
    q('.fish-result p').textContent = caught ? item.caption : 'Попробуйте ещё раз.';
    status(caught ? 'Улов пойман' : 'Рыба уплыла', '');
    action('Ещё заброс ↗', false);
    if (caught && encounter) {
      const token = encounter.token;
      async function reveal() {
        q('.fish-again').disabled = true;
        try {
          const result = await progress.reveal(token);
          if (version !== session || state !== 'result') return;
          item = result.catch;
          q('.fish-result h3').textContent = item.name;
          q('.fish-result p').textContent = item.caption;
          portrait.textContent = item.kind === 'small' ? '🐟' : '?';
          if (item.image) { const img = document.createElement('img'); img.alt = item.name; img.src = item.image; portrait.replaceChildren(img); }
          retryReveal = null; q('.fish-again').textContent = 'Ещё заброс';
        } catch (error) {
          if (version === session) { q('.fish-result p').textContent = error.message; retryReveal = reveal; q('.fish-again').textContent = 'Повторить'; }
        } finally { if (version === session) q('.fish-again').disabled = false; }
      }
      await reveal();
    }
  }

  function reset() {
    session++; encounter = null; retryReveal = null; q('.fish-again').disabled = false; q('.fish-again').textContent = 'Ещё заброс'; delete root.dataset.pull;
    setState('idle'); q('.fish-result').hidden = true; q('.fish-check').hidden = true; q('.fish-tension').hidden = true;
    q('.fish-spots').hidden = root.dataset.view !== 'fishing';
    for (const selector of ['.fish-float', '.fish-line', '.fish-bubbles', '.fish-approach']) q(selector).style.opacity = '0';
    status('', ''); action('Подсечь', true);
  }
  async function cast(spot) {
    if (state !== 'idle') return;
    root.focus({ preventScroll: true });
    selectedSpot = spot;
    setState('preparing'); q('.fish-spots').hidden = true;
    status('Готовим заброс…', '');
    const version = ++session;
    try {
      encounter = await progress.cast(selectedSpot, currentLocation);
      if (version !== session) return;
      if (!encounter.success) throw new Error('No encounter');
    } catch (error) { if (version === session) { reset(); status(error.message, ''); } return; }
    point = { x: 282, y: 422 };
    waitMs = 2800 + Math.random() * 3000;
    q('.fish-spots').hidden = true;
    q('.fish-line').setAttribute('d', `M350 195Q${point.x + 30} 240 ${point.x} ${point.y}`);
    setState('casting'); status('Красивый заброс', 'На глубине свои секреты…'); action('Леска в полёте…', true); start();
  }
  function hit() {
    if (state === 'result') { reset(); return; }
    if (!canRun() || state !== 'fight' || fight.phase !== 'pass') return;
    // fight.elapsed is the position drawn by the latest frame. Score that
    // visible position immediately; do not extrapolate ahead of the display.
    const result = strike(fight);
    status(result === 'hit' ? 'Есть контакт!' : 'Чуть мимо', result === 'hit' ? 'Держите ритм. Можно поймать следующий сектор.' : 'Ловите светлые участки, не спешите.');
    [...q('.fish-zones').children].forEach((el, i) => el.classList.toggle('is-hit', fight.zones[i].hit));
    showProgress(); if (fight.outcome) finish();
  }
  function tick(now) {
    raf = 0;
    if (!canRun()) { last = 0; return; }
    const dt = last ? Math.min(now - last, 80) : 0; last = now; elapsed += dt;
    if (state === 'casting') {
      const t = Math.min(1, elapsed / 1100);
      const x = 350 + (point.x - 350) * t, y = 195 + (point.y - 195) * t - Math.sin(t * Math.PI) * 110;
      q('.fish-float').style.opacity = '1'; q('.fish-float').setAttribute('transform', `translate(${x} ${y})`);
      if (t === 1) { q('.fish-line').style.opacity = '.7'; setState('waiting'); status('Теперь просто тишина', 'Следите за поплавком. Кто-то уже рядом.'); action('Ждём поклёвку…', true); }
    } else if (state === 'waiting' && elapsed >= waitMs) {
      setState('approach'); q('.fish-bubbles').setAttribute('transform', `translate(${point.x} ${point.y + 12})`); q('.fish-bubbles').style.opacity = '1'; status('Кажется, клюёт…', 'Приготовьтесь: скоро появится индикатор.');
    } else if (state === 'approach') {
      const t = Math.min(1, elapsed / 2200);
      q('.fish-approach').style.opacity = String(Math.sin(t * Math.PI));
      q('.fish-approach').setAttribute('transform', `translate(${point.x - 110 * (1 - t)} ${point.y + 20 * (1 - t)})`);
      if (t === 1) { fight = createFight(Math.random, encounter.traits); zones(); showProgress(); setState('fight'); q('.fish-check').hidden = false; q('.fish-tension').hidden = false; q('.fish-bubbles').style.opacity = '0'; status('Тянем аккуратно', 'Нажмите, когда индикатор внутри светлого сектора.'); action('Подсечь · ПРОБЕЛ', false); }
    } else if (state === 'fight') {
      const previousPhase = fight.phase;
      advance(fight, dt); showProgress();
      if (fight.outcome) { finish(); start(); return; }
      if (savedRound !== fight.round) zones();
      const resting = fight.phase === 'rest';
      root.dataset.pull = String(resting);
      q('.fish-check').classList.toggle('is-resting', resting);
      q('.fish-cursor').style.bottom = `${Math.min(100, fight.elapsed / PASS_MS * 100)}%`;
      q('.fish-round').textContent = resting ? `${Math.ceil((REST_MS - fight.elapsed) / 1000)} с` : `0${fight.round}`;
      if (previousPhase !== fight.phase) {
        status(resting ? 'Вываживаем…' : 'Новый рывок!', resting ? 'Енот тянет удочку на себя.' : 'Индикатор идёт вверх. Ловите светлые сектора.');
        action(resting ? 'Рыба набирается сил…' : 'Подсечь · ПРОБЕЛ', resting);
      }
    }
    animatePose(dt);
    environmentTime += dt;
    if (environmentTime > 60000) { environmentTime = 0; environment.refresh(); }
    raf = requestAnimationFrame(tick);
  }
  function canRun() { return open && visible && !document.hidden && root.dataset.view === 'fishing'; }
  function start() { if (canRun() && !raf) { last = 0; raf = requestAnimationFrame(tick); } }
  function animatePose(dt) {
    motionTime += dt / 1000;
    const t = motionTime;
    const reduced = motionPreference.matches;
    const { pulling, lean, rodAngle } = anglerPose(state, elapsed, fight, t, reduced);
    q('.fish-angler').setAttribute('transform', `rotate(${lean} 506 386)`);
    q('.fish-rod').setAttribute('transform', `rotate(${rodAngle} 453 310)`);
    if (state !== 'idle' && state !== 'casting' && state !== 'preparing') {
      const { x, y } = rodTip(rodAngle, lean);
      q('.fish-line').setAttribute('d', `M${x} ${y} Q${(x + point.x) / 2} ${pulling ? 230 : 280} ${point.x} ${point.y}`);
    }
  }
  function syncPause() {
    const externallyPaused = root.dataset.view === 'fishing' && (!open || !visible || document.hidden);
    root.classList.toggle('is-paused', externallyPaused); q('.fish-pause').hidden = !externallyPaused;
    const paused = !canRun();
    if (paused) { cancelAnimationFrame(raf); raf = 0; last = 0; } else { environment.refresh(); start(); }
  }
  root.querySelectorAll('[data-spot]').forEach(button => button.addEventListener('click', () => cast(button.dataset.spot)));
  root.querySelectorAll('[data-location]').forEach(button => button.addEventListener('click', () => visit(button.dataset.location)));
  q('.fish-map-return').addEventListener('click', showMap);
  bindStrikeInput(q('.fish-action'), root, hit);
  q('.fish-again').addEventListener('click', () => retryReveal ? retryReveal() : reset());
  q('.fish-save').addEventListener('click', async () => { await progress.flush(); await progress.collection().catch(() => {}); });
  q('.fish-help-toggle').addEventListener('click', event => { const help = q('.fish-help'); help.hidden = !help.hidden; event.currentTarget.setAttribute('aria-expanded', String(!help.hidden)); });
  document.addEventListener('visibilitychange', syncPause);
  if (typeof IntersectionObserver === 'function') new IntersectionObserver(entries => { visible = entries[0].isIntersecting; syncPause(); }, { threshold: 0 }).observe(root);
  root.dataset.view = 'map';
  showMap();
  progress.init().catch(error => { q('.fish-sync-status').textContent = error.message; });
  return { setOpen(value) { open = value; syncPause(); if (!value) void progress.flush(); } };
}
