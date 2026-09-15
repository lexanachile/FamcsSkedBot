import { lakeScene } from './scene.js?v=66';
import { createFight, advance, strike, displayedProgress, REST_MS } from './engine.js?v=62';
import { createProgress } from './progress.js?v=62';
import { setupEnvironment } from './environment.js?v=55';
import { bindStrikeInput } from './input.js?v=67';
import { getLocation, worldMapMarkup } from './locations.js?v=65';
import { devBaitOptions, devCatchOptions, devRodOptions, optionsMarkup, renderLoadout, renderShop, storeMarkup } from './storefront.js?v=64';

import { createLocationNotice } from './location-notice.js?v=57';
import { FISHING_RIG } from './rig.js?v=66';

export function anglerPose(state, elapsed, fight, motionTime, reduced = false, strikePulse = 0) {
  const bite = state === 'approach' ? 1 - Math.pow(1 - Math.min(1, elapsed / 2200), 3) : 0;
  const fighting = state === 'fight' || state === 'landing';
  const recovering = fighting && fight?.phase === 'rest';
  const effort = recovering ? Math.sin(Math.PI * Math.min(1, fight.elapsed / REST_MS)) : 0;
  const tug = fighting ? .5 + .5 * Math.sin((fight?.motionTime ?? motionTime) * (recovering ? 3.2 : 7.2)) : 0;
  const pulse = reduced ? 0 : Math.max(0, Math.min(1, strikePulse));
  return {
    pulling: fighting || state === 'approach',
    shiftX: reduced ? (bite ? -5 : fighting ? -3 : 0) : -bite * 8 - (fighting ? 4 + tug * 2 : 0) + pulse * 1.5,
    shiftY: reduced ? 0 : bite * 2 + (fighting ? tug * 1.2 : 0),
    lean: reduced ? 0 : -bite * 1.8 - (fighting ? 1 + tug * .8 : 0) + effort * 3 + pulse * 2.2 + Math.sin(motionTime * 1.6) * .25,
    rodAngle: reduced ? (bite ? 3 : fighting ? 4 : 0) : effort * 8 + bite * 3 + (fighting ? 2.5 + tug * 2 : 0) + pulse * 15 + (state === 'casting' ? -14 * Math.sin(elapsed / 1100 * Math.PI) : 0),
  };
}

export function rodTip(rodAngle, lean, shiftX = 0, shiftY = 0) {
  const { hand, tip, body } = FISHING_RIG;
  const dx = tip.x - hand.x, dy = tip.y - hand.y;
  const a = rodAngle * Math.PI / 180;
  const localX = hand.x + dx * Math.cos(a) - dy * Math.sin(a);
  const localY = hand.y + dx * Math.sin(a) + dy * Math.cos(a);
  const b = lean * Math.PI / 180;
  return {
    x: shiftX + body.x + (localX - body.x) * Math.cos(b) - (localY - body.y) * Math.sin(b),
    y: shiftY + body.y + (localX - body.x) * Math.sin(b) + (localY - body.y) * Math.cos(b),
  };
}

export function linePath(tip, end, tension = 1) {
  const slack = Math.max(0, 1 - tension);
  const controlX = (tip.x + end.x) / 2 + slack * 12;
  const controlY = tip.y + (end.y - tip.y) * .52 + slack * 40;
  return `M${tip.x} ${tip.y} Q${controlX} ${controlY} ${end.x} ${end.y}`;
}

export function biteFishPosition(point, progress) {
  const t = Math.max(0, Math.min(1, progress));
  const pull = 1 - Math.pow(1 - t, 3);
  return { x: point.x + 20 - 88 * pull, y: point.y + 12 - 18 * pull + Math.sin(t * Math.PI * 3) * 3 };
}

export function mountFishing(host) {
  host.innerHTML = `<section class="fishing-game" aria-label="Рыбалка" tabindex="-1">
    <div class="fish-stage">${lakeScene()}${worldMapMarkup()}${storeMarkup()}
      <section class="fish-home" aria-label="Дом и коллекция трофеев" hidden>
        <div class="fish-home-heading"><h2>Коллекция трофеев</h2><p class="fish-trophy-summary"></p><button type="button" class="fish-save">Сохранить улов</button></div>
        <p class="fish-trophy-empty">Здесь появятся карточки пойманных преподавателей.</p>
        <div class="fish-trophy-list"></div>
      </section>
      <div class="fish-hud"><span class="fish-count" title="Обычные рыбки в кармане">0 <small>РЫБОК</small></span><div class="fish-hud-buttons"><button type="button" class="fish-loadout-open" aria-label="Открыть снаряжение">◇</button><button type="button" class="fish-help-toggle" aria-label="Как играть" aria-expanded="false">?</button></div></div>
      <button type="button" class="fish-map-return" aria-label="Вернуться на карту" hidden><span>←</span> Карта</button>
      <div class="fish-location-name" hidden></div>
      <div class="fish-dev"><button type="button" class="fish-dev-toggle" aria-label="Настройки разработчика" aria-expanded="false"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="m8 6-6 6 6 6m8-12 6 6-6 6m-3-16-2 20"/></svg></button><div class="fish-dev-panel" hidden><label>Время<select name="fish-period"><option value="">Минск · авто</option><option value="morning">Утро</option><option value="day">День</option><option value="evening">Вечер</option><option value="night">Ночь</option></select></label><label>Погода<select name="fish-rain"><option value="">Минск · авто</option><option value="rain">Дождь</option><option value="dry">Без дождя</option></select></label><label>Улов<select name="fish-dev-catch">${optionsMarkup(devCatchOptions)}</select></label><label>Удочка<select name="fish-dev-rod">${optionsMarkup(devRodOptions)}</select></label><label>Прикормка<select name="fish-dev-bait">${optionsMarkup(devBaitOptions)}</select></label><small>Dev-предметы не покупаются и не расходуются.</small><small class="fish-weather-error">Погода недоступна; сохранено последнее состояние.</small></div></div>
      <div class="fish-spots" aria-label="Место заброса"><button data-spot="deep" class="fish-spot fish-spot-deep" aria-label="Забросить на глубину"><span>+</span></button></div>
      <div class="fish-check" hidden><span class="fish-check-label">ПОПАДИ<br>В СЕКТОР</span><div class="fish-track"><div class="fish-zones"></div><div class="fish-cursor"></div></div><span class="fish-round"></span></div>
      <div class="fish-result" hidden><span class="fish-eyebrow">УЛОВ</span><div class="fish-portrait">?</div><h3></h3><p></p><button type="button" class="fish-again">Ещё заброс</button></div>
      <div class="fish-pause" hidden>Тихая пауза<span>Вернёмся к клёву, когда вы вернётесь.</span></div>
      <div class="fish-play-hud"><span class="fish-status" role="status" aria-live="polite"></span><span class="fish-hint" hidden></span><div class="fish-tension" hidden><span>РЫБА</span><div role="progressbar" aria-label="Прогресс вываживания" aria-valuemin="0" aria-valuemax="100"><i></i></div><span>ВЫ</span></div></div>
      <button class="fish-action" type="button" disabled aria-label="Подсечь">Подсечь</button>
      <div class="fish-game-toast" role="status" aria-live="polite" hidden></div>
      <section class="fish-help" role="dialog" aria-modal="true" aria-label="Как играть" hidden><button type="button" class="fish-help-close" aria-label="Закрыть помощь">×</button><h2>Как играть</h2><p>Выберите локацию, снаряжение и забросьте на глубину. Маленькой рыбке нужен один точный тап в любом месте сцены.</p><p>Редкий улов требует нескольких попаданий. Удочки замедляют индикатор, расширяют сектора и смягчают рывки. Прикормка расходуется по одной порции, ускоряет клёв и повышает шанс редкой встречи.</p></section>
    </div>
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
  q('.fish-dev-toggle').addEventListener('click', e => { const panel = q('.fish-dev-panel'); panel.hidden = !panel.hidden; e.currentTarget.setAttribute('aria-expanded', String(!panel.hidden)); });
  let encounter = null, session = 0, motionTime = 0, environmentTime = 0;
  let state = 'idle', elapsed = 0, fight, point = { ...FISHING_RIG.cast }, fishPosition = { x: 180, y: 482 }, waitMs = 0, strikePulse = 0;
  const displayedPose = { shiftX: 0, shiftY: 0, lean: 0, rodAngle: 0 };
  let landingStart = { x: 92, y: 454 };
  let selectedSpot = 'deep', currentLocation = 'crossing';
  let open = true, visible = true, raf = 0, last = 0, savedRound = 0;
  let progressState = { game: { wallet: { smallFish: 0 }, fish: {}, inventory: { rods: ['twig'], baits: {} }, equipped: { rod: 'twig', bait: null } }, pending: 0, cards: [], catalog: null, error: '' };
  let retryReveal = null, toastTimer = 0, lastSyncMessage = '';
  function toast(message, duration = 2800) {
    clearTimeout(toastTimer);
    const element = q('.fish-game-toast');
    element.textContent = message;
    element.hidden = !message;
    element.classList.remove('is-leaving');
    if (message && duration) toastTimer = setTimeout(() => {
      element.classList.add('is-leaving');
      toastTimer = setTimeout(() => { element.hidden = true; element.classList.remove('is-leaving'); }, 220);
    }, duration);
  }
  const progress = createProgress(value => {
    progressState = value;
    q('.fish-count').firstChild.textContent = `${value.game.wallet.smallFish} `;
    q('.fish-store-wallet').textContent = `${value.game.wallet.smallFish} ≈`;
    q('.fish-loadout-wallet').textContent = `${value.game.wallet.smallFish} ≈`;
    const syncMessage = value.error || (value.pending ? `Улов ждёт синхронизации: ${value.pending}` : 'Улов сохранён');
    if (syncMessage !== lastSyncMessage) { lastSyncMessage = syncMessage; toast(syncMessage, value.error ? 4500 : 2400); }
    if (root.dataset.view === 'home') renderTrophies();
    if (value.catalog && root.dataset.view === 'shop') drawShop();
    if (value.catalog && root.dataset.view === 'loadout') drawLoadout();
  });
  const status = (title, hint) => { q('.fish-status').textContent = title; q('.fish-hint').textContent = hint; q('.fish-hint').hidden = !hint; };
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
  const storeMessage = (selector, message = '') => { q(selector).textContent = message; };
  function drawShop() {
    if (!progressState.catalog) return;
    renderShop(q('.fish-store-content'), progressState.catalog, progressState.game, async itemId => {
      storeMessage('.fish-shop .fish-store-message', 'Покупаем…');
      try { await progress.buy(itemId); storeMessage('.fish-shop .fish-store-message', 'Покупка в рюкзаке.'); }
      catch (error) { storeMessage('.fish-shop .fish-store-message', error.message); }
    });
  }
  function drawLoadout() {
    if (!progressState.catalog) return;
    renderLoadout(q('.fish-loadout-content'), progressState.catalog, progressState.game, async (kind, itemId) => {
      storeMessage('.fish-loadout .fish-store-message', 'Сохраняем выбор…');
      try { await progress.equip(kind, itemId); storeMessage('.fish-loadout .fish-store-message', 'Снаряжение выбрано.'); }
      catch (error) { storeMessage('.fish-loadout .fish-store-message', error.message); }
    });
  }
  async function loadStore(kind) {
    try { await progress.shop(); if (kind === 'shop') drawShop(); else drawLoadout(); }
    catch (error) { storeMessage(`.fish-${kind} .fish-store-message`, error.message); }
  }
  function showShop() {
    locationNotice.hide(); reset(); root.dataset.view = 'shop';
    q('.fish-world-map').hidden = true; q('.fish-home').hidden = true; q('.fish-shop').hidden = false; q('.fish-loadout').hidden = true;
    q('.fish-map-return').hidden = true; syncPause(); void loadStore('shop');
  }
  function showLoadout() {
    if (state !== 'idle') return;
    locationNotice.hide(); root.dataset.view = 'loadout'; q('.fish-loadout').hidden = false; q('.fish-shop').hidden = true;
    q('.fish-spots').hidden = true; q('.fish-map-return').hidden = true; syncPause(); void loadStore('loadout');
  }
  function closeLoadout() {
    root.dataset.view = 'fishing'; q('.fish-loadout').hidden = true; q('.fish-spots').hidden = false; q('.fish-map-return').hidden = false; syncPause();
  }
  function showMap() {
    locationNotice.hide();
    reset();
    root.dataset.view = 'map';
    q('.fish-world-map').hidden = false; q('.fish-home').hidden = true; q('.fish-shop').hidden = true; q('.fish-loadout').hidden = true;
    q('.fish-map-return').hidden = true; q('.fish-location-name').hidden = true;
    root.querySelectorAll('[data-location]').forEach(button => button.setAttribute('aria-current', String(button.dataset.location === currentLocation)));
    syncPause();
  }
  function visit(locationId) {
    const location = getLocation(locationId);
    if (locationId !== 'home' && (!location || location.locked)) return;
    reset();
    if (locationId === 'home') {
      root.dataset.view = 'home'; q('.fish-world-map').hidden = true; q('.fish-home').hidden = false; q('.fish-shop').hidden = true; q('.fish-loadout').hidden = true;
      q('.fish-map-return').hidden = false; q('.fish-location-name').hidden = true;
      locationNotice.show('Дом');
      renderTrophies();
      progress.collection().catch(error => { q('.fish-trophy-empty').textContent = error.message; });
      syncPause(); return;
    }
    currentLocation = location.id; root.dataset.location = location.id; root.dataset.view = 'fishing';
    q('.fish-spots').hidden = false;
    q('.fish-world-map').hidden = true; q('.fish-home').hidden = true; q('.fish-shop').hidden = true; q('.fish-loadout').hidden = true; q('.fish-map-return').hidden = false;
    locationNotice.show(location.name);
    status('', '');
    syncPause();
  }
  async function finish() {
    const version = session;
    setState('result');
    q('.fish-check').hidden = true;
    q('.fish-approach').style.opacity = '0'; q('.fish-pull-wake').style.opacity = '0'; q('.fish-line').style.opacity = '0';
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
    session++; encounter = null; retryReveal = null; strikePulse = 0; q('.fish-again').disabled = false; q('.fish-again').textContent = 'Ещё заброс'; delete root.dataset.pull;
    setState('idle'); q('.fish-result').hidden = true; q('.fish-check').hidden = true; q('.fish-tension').hidden = true;
    q('.fish-spots').hidden = root.dataset.view !== 'fishing';
    for (const selector of ['.fish-float', '.fish-line', '.fish-bubbles', '.fish-approach', '.fish-pull-wake']) q(selector).style.opacity = '0';
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
      encounter = await progress.cast(selectedSpot, currentLocation, { devCatch: q('[name="fish-dev-catch"]').value || undefined, devRod: q('[name="fish-dev-rod"]').value || undefined, devBait: q('[name="fish-dev-bait"]').value || undefined });
      if (version !== session) return;
      if (!encounter.success) throw new Error('No encounter');
    } catch (error) { if (version === session) { reset(); status(error.message, ''); } return; }
    point = { ...FISHING_RIG.cast };
    waitMs = (2800 + Math.random() * 3000) * (encounter.traits.waitScale || 1);
    q('.fish-spots').hidden = true;
    q('.fish-line').setAttribute('d', linePath(FISHING_RIG.tip, point, .5));
    setState('casting'); status('Красивый заброс', 'На глубине свои секреты…'); action('Леска в полёте…', true); start();
  }
  function concludeFight() {
    if (fight.outcome !== 'caught') { void finish(); return; }
    landingStart = { ...fishPosition }; strikePulse = 1; setState('landing');
    q('.fish-check').hidden = true; q('.fish-tension').hidden = true; action('', true);
  }
  function hit() {
    if (state === 'result') { reset(); return; }
    if (!canRun() || state !== 'fight' || fight.phase !== 'pass') return;
    // fight.elapsed is the position drawn by the latest frame. Score that
    // visible position immediately; do not extrapolate ahead of the display.
    const result = strike(fight);
    strikePulse = result === 'hit' ? 1 : .45;
    const check = q('.fish-check');
    check.classList.remove('is-tap-hit', 'is-tap-miss'); void check.offsetWidth;
    check.classList.add(result === 'hit' ? 'is-tap-hit' : 'is-tap-miss');
    status(result === 'hit' ? (fight.quick ? 'Точно!' : 'Есть контакт!') : 'Чуть мимо', result === 'hit' ? (fight.quick ? 'Маленькая рыбка уже на крючке.' : 'Держите ритм. Можно поймать следующий сектор.') : (fight.quick ? 'Дождитесь светлого сектора и тапните ещё раз.' : 'Ловите светлые участки, не спешите.'));
    [...q('.fish-zones').children].forEach((el, i) => el.classList.toggle('is-hit', fight.zones[i].hit));
    showProgress(); if (fight.outcome) concludeFight();
  }
  function tick(now) {
    raf = 0;
    if (!canRun()) { last = 0; return; }
    const dt = last ? Math.min(now - last, 80) : 0; last = now; elapsed += dt;
    if (state === 'casting') {
      const t = Math.min(1, elapsed / 1100);
      const x = FISHING_RIG.tip.x + (point.x - FISHING_RIG.tip.x) * t, y = FISHING_RIG.tip.y + (point.y - FISHING_RIG.tip.y) * t - Math.sin(t * Math.PI) * 105;
      q('.fish-float').style.opacity = '1'; q('.fish-float').setAttribute('transform', `translate(${x} ${y})`);
      if (t === 1) { q('.fish-line').style.opacity = '.7'; setState('waiting'); status('Теперь просто тишина', 'Следите за поплавком. Кто-то уже рядом.'); action('Ждём поклёвку…', true); }
    } else if (state === 'waiting' && elapsed >= waitMs) {
      setState('approach'); fishPosition = { x: point.x + 20, y: point.y + 12 }; root.dataset.pull = 'bite';
      q('.fish-float').style.opacity = '0'; q('.fish-bubbles').setAttribute('transform', `translate(${fishPosition.x} ${fishPosition.y})`); q('.fish-bubbles').style.opacity = '1'; status('Клюёт!', 'Рыба уходит влево. Енот держит леску и готовится к подсечке.');
    } else if (state === 'approach') {
      const t = Math.min(1, elapsed / 2200);
      const pull = 1 - Math.pow(1 - t, 3);
      fishPosition = biteFishPosition(point, t);
      q('.fish-approach').style.opacity = String(Math.min(1, t * 5)); q('.fish-approach').setAttribute('transform', `translate(${fishPosition.x} ${fishPosition.y})`);
      q('.fish-pull-wake').style.opacity = String(.75 * pull); q('.fish-pull-wake').setAttribute('transform', `translate(${fishPosition.x} ${fishPosition.y})`);
      q('.fish-bubbles').setAttribute('transform', `translate(${fishPosition.x + 18} ${fishPosition.y + 5})`);
      if (t === 1) {
        if (encounter.traits.challenge === 'auto') { fight = { outcome: 'caught' }; q('.fish-bubbles').style.opacity = '0'; void finish(); }
        else { fight = createFight(Math.random, encounter.traits); q('.fish-track').style.setProperty('--fish-divisions', fight.divisions); zones(); showProgress(); setState('fight'); root.dataset.pull = 'fight'; q('.fish-check').hidden = false; q('.fish-tension').hidden = false; q('.fish-bubbles').style.opacity = '0'; status(fight.quick ? 'Один точный тап' : 'Тянем аккуратно', fight.quick ? 'Коснитесь в любом месте экрана, когда индикатор окажется в светлом секторе.' : 'Коснитесь в любом месте экрана, когда индикатор внутри светлого сектора.'); action('Подсечь · ПРОБЕЛ', false); }
      }
    } else if (state === 'fight') {
      const previousPhase = fight.phase;
      advance(fight, dt); showProgress();
      if (fight.outcome) { concludeFight(); animatePose(dt); raf = requestAnimationFrame(tick); return; }
      if (savedRound !== fight.round) zones();
      const resting = fight.phase === 'rest';
      root.dataset.pull = resting ? 'recover' : 'fight';
      const fishTug = .5 + .5 * Math.sin(fight.motionTime * (resting ? 3.2 : 7.2));
      const fishTarget = { x: (resting ? 101 : 92) - fishTug * (resting ? 4 : 10), y: 454 + Math.sin(fight.motionTime * 4.6) * (resting ? 2 : 5) };
      const fishBlend = 1 - Math.exp(-dt / 110);
      fishPosition.x += (fishTarget.x - fishPosition.x) * fishBlend; fishPosition.y += (fishTarget.y - fishPosition.y) * fishBlend;
      q('.fish-approach').style.opacity = '.82'; q('.fish-approach').setAttribute('transform', `translate(${fishPosition.x} ${fishPosition.y})`);
      q('.fish-pull-wake').style.opacity = resting ? '.28' : '.7'; q('.fish-pull-wake').setAttribute('transform', `translate(${fishPosition.x} ${fishPosition.y})`);
      q('.fish-check').classList.toggle('is-resting', resting);
      q('.fish-cursor').style.bottom = `${Math.min(100, fight.elapsed / fight.passMs * 100)}%`;
      q('.fish-round').textContent = resting ? `${Math.ceil((REST_MS - fight.elapsed) / 1000)} с` : `0${fight.round}`;
      if (previousPhase !== fight.phase) {
        status(resting ? 'Вываживаем…' : 'Новый рывок!', resting ? 'Енот тянет удочку на себя.' : 'Индикатор идёт вверх. Ловите светлые сектора.');
        action(resting ? 'Рыба набирается сил…' : 'Подсечь · ПРОБЕЛ', resting);
      }
    } else if (state === 'landing') {
      const t = Math.min(1, elapsed / 380), lift = 1 - Math.pow(1 - t, 2);
      fishPosition = { x: landingStart.x + (160 - landingStart.x) * lift, y: landingStart.y - 36 * lift };
      q('.fish-approach').setAttribute('transform', `translate(${fishPosition.x} ${fishPosition.y})`);
      q('.fish-pull-wake').setAttribute('transform', `translate(${fishPosition.x} ${fishPosition.y})`); q('.fish-pull-wake').style.opacity = String(.6 * (1 - t));
      if (t === 1) void finish();
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
    strikePulse = Math.max(0, strikePulse - dt / 430);
    const t = motionTime;
    const reduced = motionPreference.matches;
    const targetPose = anglerPose(state, elapsed, fight, t, reduced, strikePulse);
    const blend = reduced ? 1 : 1 - Math.exp(-dt / (strikePulse ? 55 : 95));
    for (const key of ['shiftX', 'shiftY', 'lean', 'rodAngle']) displayedPose[key] += (targetPose[key] - displayedPose[key]) * blend;
    const { shiftX, shiftY, lean, rodAngle } = displayedPose;
    q('.fish-angler').setAttribute('transform', `translate(${shiftX} ${shiftY}) rotate(${lean} ${FISHING_RIG.body.x} ${FISHING_RIG.body.y})`);
    q('.fish-rod').setAttribute('transform', `rotate(${rodAngle} ${FISHING_RIG.hand.x} ${FISHING_RIG.hand.y})`);
    if (state === 'waiting' || state === 'approach' || state === 'fight' || state === 'landing') {
      const tip = rodTip(rodAngle, lean, shiftX, shiftY);
      const end = state === 'waiting' ? point : { x: fishPosition.x - 22, y: fishPosition.y };
      q('.fish-line').style.opacity = state === 'waiting' ? '.7' : '.92';
      q('.fish-line').setAttribute('d', linePath(tip, end, targetPose.pulling ? .96 : .55));
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
  q('.fish-shop-open').addEventListener('click', showShop);
  q('.fish-store-back').addEventListener('click', showMap);
  q('.fish-loadout-open').addEventListener('click', showLoadout);
  q('.fish-loadout-back').addEventListener('click', closeLoadout);
  bindStrikeInput(q('.fish-action'), q('.fish-stage'), root, hit, () => state === 'fight');
  q('.fish-again').addEventListener('click', () => retryReveal ? retryReveal() : reset());
  q('.fish-save').addEventListener('click', async () => { await progress.flush(); await progress.collection().catch(() => {}); });
  const closeHelp = () => { q('.fish-help').hidden = true; q('.fish-help-toggle').setAttribute('aria-expanded', 'false'); };
  q('.fish-help-toggle').addEventListener('click', event => { const help = q('.fish-help'); help.hidden = false; event.currentTarget.setAttribute('aria-expanded', 'true'); q('.fish-help-close').focus(); });
  q('.fish-help-close').addEventListener('click', closeHelp);
  root.addEventListener('keydown', event => { if (event.key === 'Escape' && !q('.fish-help').hidden) closeHelp(); });
  document.addEventListener('visibilitychange', syncPause);
  if (typeof IntersectionObserver === 'function') new IntersectionObserver(entries => { visible = entries[0].isIntersecting; syncPause(); }, { threshold: 0 }).observe(root);
  root.dataset.view = 'map';
  showMap();
  progress.init().catch(error => { toast(error.message, 5000); });
  return { setOpen(value) { open = value; syncPause(); if (!value) void progress.flush(); } };
}
