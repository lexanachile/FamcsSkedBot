import { lakeScene } from './scene.js?v=80';
import { createFight, advance, strike, displayedProgress, passPosition, REST_MS } from './engine.js?v=80';
import { createProgress } from './progress.js?v=80';
import { setupEnvironment } from './environment.js?v=80';
import { bindStrikeInput } from './input.js?v=80';
import { bindCatchChoiceInput, catchChoiceKeyframes, withCatchChoice } from './catch-choice.js?v=80';
import { ownerLine } from './collection.js?v=80';
import { getLocation, worldMapMarkup } from './locations.js?v=80';
import { devBaitOptions, devCatchOptions, devRodOptions, optionsMarkup, renderLoadout, renderShop, storeMarkup } from './storefront.js?v=80';

import { createLocationNotice } from './location-notice.js?v=80';
import { FISHING_RIG } from './rig.js?v=80';

export function anglerPose(state, elapsed, fight, motionTime, reduced = false, strikePulse = 0) {
  const bite = state === 'approach' ? 1 - Math.pow(1 - Math.min(1, elapsed / 2200), 3) : 0;
  const fighting = state === 'fight' || state === 'landing';
  const recovering = fighting && fight?.phase === 'rest';
  const effort = recovering ? Math.sin(Math.PI * Math.min(1, fight.elapsed / REST_MS)) : 0;
  const tug = fighting ? .5 + .5 * Math.sin((fight?.motionTime ?? motionTime) * (recovering ? 3.2 : 7.2)) : 0;
  const step = recovering && !reduced ? Math.sin((fight?.motionTime ?? motionTime) * 11) : 0;
  const pulse = reduced ? 0 : Math.max(0, Math.min(1, strikePulse));
  return {
    pulling: fighting || state === 'approach',
    shiftX: reduced ? (bite ? -5 : fighting ? -3 : 0) : -bite * 8 - (fighting ? 4 + tug * (recovering ? 5 : 2) : 0) + step * .7 + pulse * 1.5,
    shiftY: reduced ? 0 : bite * 2 + (fighting ? tug * 1.2 : 0) + Math.abs(step) * 1.5,
    lean: reduced ? 0 : -bite * 1.8 - (fighting ? 1 + tug * (recovering ? 1.5 : .8) : 0) + effort * 3 + pulse * 2.2 + Math.sin(motionTime * 1.6) * .25,
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

export const RARE_ORBIT_MS = 1000;
export function orbitFishPose(point, progress) {
  const t = Math.max(0, Math.min(1, progress));
  const radiusX = 34;
  const startAngle = Math.acos(20 / radiusX);
  const radiusY = 12 / Math.sin(startAngle);
  const angle = startAngle + t * Math.PI * 2;
  const x = point.x + Math.cos(angle) * radiusX;
  const y = point.y + Math.sin(angle) * radiusY;
  const depth = (Math.sin(angle) + 1) / 2;
  const startDepth = (Math.sin(startAngle) + 1) / 2;
  const perspective = (.78 + depth * .22) / (.78 + startDepth * .22);
  const velocityX = -radiusX * Math.sin(angle);
  const velocityY = radiusY * Math.cos(angle);
  const facing = Math.tanh(-velocityX / 7);
  const bank = Math.max(-13, Math.min(13,
    Math.sign(velocityX || 1) * Math.atan2(velocityY, Math.max(1, Math.abs(velocityX))) * 180 / Math.PI)) * Math.sin(Math.PI * t);
  return {
    x, y, angle: bank,
    scaleX: perspective * facing,
    scaleY: perspective * (.88 + Math.abs(facing) * .12),
    opacity: Math.min(1, .62 + depth * .38),
    depth,
  };
}
export function orbitFishPosition(point, progress) {
  const { x, y } = orbitFishPose(point, progress);
  return { x, y };
}

export function mountFishing(host) {
  host.innerHTML = `<section class="fishing-game" aria-label="Рыбалка" tabindex="-1">
    <div class="fish-stage">${lakeScene()}${worldMapMarkup()}${storeMarkup()}
      <section class="fish-home" aria-label="Дом и коллекция трофеев" hidden>
        <div class="fish-home-heading"><h2>Коллекция трофеев</h2><p class="fish-trophy-summary"></p><button type="button" class="fish-save">Сохранить улов</button></div>
        <p class="fish-trophy-empty">Здесь появятся карточки пойманных преподавателей.</p>
        <div class="fish-trophy-list"></div>
      </section>
      <section class="fish-leaderboard" aria-label="Топ рыбаков" hidden><header><button type="button" class="fish-leaderboard-back" aria-label="Вернуться на карту">←</button><div><small>ОБЩИЙ УЛОВ</small><h2>Топ рыбаков</h2></div></header><p class="fish-leaderboard-me"></p><ol class="fish-leaderboard-list"><li class="fish-leaderboard-loading">Считаем улов…</li></ol></section>
      <div class="fish-hud"><div class="fish-wallet-stack"><span class="fish-count" title="Обычные рыбки в кармане">0 <small>РЫБОК</small></span><button type="button" class="fish-leaderboard-open">Топ рыбаков</button></div><div class="fish-hud-buttons"><button type="button" class="fish-loadout-open" aria-label="Открыть снаряжение">◇</button><button type="button" class="fish-help-toggle" aria-label="Как играть" aria-expanded="false">?</button></div></div>
      <button type="button" class="fish-map-return" aria-label="Вернуться на карту" hidden><span>←</span> Карта</button>
      <div class="fish-location-name" hidden></div>
      <div class="fish-dev"><button type="button" class="fish-dev-toggle" aria-label="Настройки разработчика" aria-expanded="false"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="m8 6-6 6 6 6m8-12 6 6-6 6m-3-16-2 20"/></svg></button><div class="fish-dev-panel" hidden><label>Время<select name="fish-period"><option value="">Минск · авто</option><option value="morning">Утро</option><option value="day">День</option><option value="evening">Вечер</option><option value="night">Ночь</option></select></label><label>Погода<select name="fish-rain"><option value="">Минск · авто</option><option value="rain">Дождь</option><option value="dry">Без дождя</option></select></label><label>Улов<select name="fish-dev-catch">${optionsMarkup(devCatchOptions)}</select></label><label>Удочка<select name="fish-dev-rod">${optionsMarkup(devRodOptions)}</select></label><label>Прикормка<select name="fish-dev-bait">${optionsMarkup(devBaitOptions)}</select></label><small>Dev-предметы не покупаются и не расходуются.</small><small class="fish-weather-error">Погода недоступна; сохранено последнее состояние.</small></div></div>
      <div class="fish-spots" aria-label="Место заброса"><button data-spot="deep" class="fish-spot fish-spot-deep" aria-label="Забросить на глубину"><span>+</span></button></div><div class="fish-catch-plus" hidden aria-hidden="true">+1 <span>≈</span></div>
      <div class="fish-check" hidden><span class="fish-check-mark" aria-hidden="true">⌁</span><div class="fish-track"><div class="fish-zones"></div><div class="fish-cursor"></div></div><span class="fish-round"></span></div>
      <div class="fish-result" hidden><div class="fish-portrait"><span class="fish-result-loader"></span></div><h3></h3><p></p><div class="fish-catch-choices" hidden><button type="button" data-catch-choice="release">Выпустить</button><button type="button" data-catch-choice="eat">Съесть</button></div><button type="button" class="fish-again" aria-label="Ещё заброс">↗</button></div>
      <div class="fish-pause" hidden><span class="fish-pause-ring" aria-hidden="true"></span></div>
      <div class="fish-play-hud"><div class="fish-tension" hidden><span aria-hidden="true">≈</span><div role="progressbar" aria-label="Прогресс вываживания" aria-valuemin="0" aria-valuemax="100"><i></i></div><span aria-hidden="true">◆</span></div></div>
      <button class="fish-action" type="button" disabled aria-label="Подсечь"><span aria-hidden="true">⌁</span></button>
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
  q('.fish-dev').hidden = true;
  q('.fish-dev-toggle').addEventListener('click', e => { const panel = q('.fish-dev-panel'); panel.hidden = !panel.hidden; e.currentTarget.setAttribute('aria-expanded', String(!panel.hidden)); });
  let encounter = null, session = 0, motionTime = 0, environmentTime = 0;
  let state = 'idle', elapsed = 0, fight, point = { ...FISHING_RIG.cast }, fishPosition = { x: 180, y: 482 }, waitMs = 0, strikePulse = 0;
  const displayedPose = { shiftX: 0, shiftY: 0, lean: 0, rodAngle: 0 };
  let landingStart = { x: 92, y: 454 };
  let selectedSpot = 'deep', currentLocation = 'crossing';
  let open = true, visible = true, raf = 0, last = 0, savedRound = 0;
  let progressState = { game: { wallet: { smallFish: 0 }, fish: {}, inventory: { rods: ['twig'], baits: {} }, equipped: { rod: 'twig', bait: null } }, pending: 0, decision: null, cards: [], catalog: null, error: '' };
  let retryReveal = null, currentCatch = null, toastTimer = 0, rewardTimer = 0, lastSyncMessage = '';
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
    q('.fish-dev').hidden = !value.devEnabled;
    if (!value.devEnabled) {
      q('.fish-dev-panel').hidden = true;
      q('.fish-dev-toggle').setAttribute('aria-expanded', 'false');
    }
    q('.fish-count').firstChild.textContent = `${value.game.wallet.smallFish} `;
    q('.fish-store-wallet').textContent = `${value.game.wallet.smallFish} ≈`;
    q('.fish-loadout-wallet').textContent = `${value.game.wallet.smallFish} ≈`;
    const syncMessage = value.error;
    if (syncMessage !== lastSyncMessage) { lastSyncMessage = syncMessage; toast(syncMessage, value.error ? 4500 : 2400); }
    if (root.dataset.view === 'home') renderTrophies();
    if (value.catalog && root.dataset.view === 'shop') drawShop();
    if (value.catalog && root.dataset.view === 'loadout') drawLoadout();
  });
  const action = (_label, disabled) => { q('.fish-action').disabled = disabled; };
  function setState(next) { state = next; elapsed = 0; root.dataset.state = next; }
  function zones() {
    q('.fish-zones').replaceChildren(...fight.zones.map(zone => {
      const el = document.createElement('i'); el.style.bottom = `${zone.start * 100}%`; el.style.height = `${(zone.end - zone.start) * 100}%`;
      el.style.setProperty('--zone-a', `${(-1 - Math.random() * 2).toFixed(1)}px`);
      el.style.setProperty('--zone-b', `${(1 + Math.random() * 2).toFixed(1)}px`);
      el.style.setProperty('--zone-drop', `${(3 + Math.random() * 3).toFixed(1)}px`);
      el.style.setProperty('--zone-time', `${(1.7 + Math.random() * .9).toFixed(2)}s`);
      el.style.setProperty('--zone-delay', `${(-Math.random() * 2).toFixed(2)}s`); return el;
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
      const amount = document.createElement('p'); amount.textContent = caught ? `Поймано: ${caught}` : '';
      const phrases = document.createElement('ul'); phrases.className = 'fish-trophy-phrases';
      for (const phrase of item.phrases || []) {
        const row = document.createElement('li'); row.className = phrase.locked ? 'is-locked' : '';
        const quote = document.createElement('span'); quote.textContent = phrase.locked ? '◆ ······' : `«${phrase.text}»`; row.append(quote);
        if (!phrase.locked) { const owners = document.createElement('small'); owners.className = 'fish-phrase-owners'; owners.textContent = ownerLine(phrase); row.append(owners); }
        phrases.append(row);
      }
      copy.append(name, amount, phrases); card.append(portrait, copy); return card;
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
    q('.fish-world-map').hidden = true; q('.fish-home').hidden = true; q('.fish-leaderboard').hidden = true; q('.fish-shop').hidden = false; q('.fish-loadout').hidden = true;
    q('.fish-map-return').hidden = true; syncPause(); void loadStore('shop');
  }
  function showLoadout() {
    if (state !== 'idle') return;
    locationNotice.hide(); root.dataset.view = 'loadout'; q('.fish-loadout').hidden = false; q('.fish-shop').hidden = true; q('.fish-leaderboard').hidden = true;
    q('.fish-spots').hidden = true; q('.fish-map-return').hidden = true; syncPause(); void loadStore('loadout');
  }
  function closeLoadout() {
    root.dataset.view = 'fishing'; q('.fish-loadout').hidden = true; q('.fish-spots').hidden = false; q('.fish-map-return').hidden = false; syncPause();
  }
  function showMap() {
    locationNotice.hide();
    reset();
    root.dataset.view = 'map';
    q('.fish-world-map').hidden = false; q('.fish-home').hidden = true; q('.fish-leaderboard').hidden = true; q('.fish-shop').hidden = true; q('.fish-loadout').hidden = true;
    q('.fish-map-return').hidden = true; q('.fish-location-name').hidden = true;
    root.querySelectorAll('[data-location]').forEach(button => button.setAttribute('aria-current', String(button.dataset.location === currentLocation)));
    syncPause();
  }
  function drawLeaderboard(result) {
    const list = q('.fish-leaderboard-list');
    list.replaceChildren(...result.leaders.map(entry => {
      const row = document.createElement('li');
      if (entry.position <= 3) row.dataset.medal = String(entry.position);
      const place = document.createElement('span'); place.className = 'fish-leaderboard-place'; place.textContent = String(entry.position);
      const name = document.createElement('strong'); name.textContent = entry.username ? `@${entry.username}` : 'Рыбак без тега';
      const score = document.createElement('span'); score.className = 'fish-leaderboard-score'; score.textContent = `${entry.totalCaught} ≈`;
      row.append(place, name, score); return row;
    }));
    if (!result.leaders.length) { const empty = document.createElement('li'); empty.className = 'fish-leaderboard-loading'; empty.textContent = 'Первый улов ещё впереди'; list.append(empty); }
    q('.fish-leaderboard-me').textContent = result.me ? `Ваше место: ${result.me.position} · ${result.me.totalCaught} рыб` : 'У вас пока нет улова';
  }
  async function showLeaderboard() {
    locationNotice.hide(); reset(); root.dataset.view = 'leaderboard';
    q('.fish-world-map').hidden = true; q('.fish-home').hidden = true; q('.fish-shop').hidden = true; q('.fish-loadout').hidden = true; q('.fish-leaderboard').hidden = false;
    q('.fish-map-return').hidden = true; q('.fish-leaderboard-me').textContent = '';
    q('.fish-leaderboard-list').innerHTML = '<li class="fish-leaderboard-loading">Считаем улов…</li>'; syncPause();
    try { const result = await progress.leaderboard(); if (root.dataset.view === 'leaderboard') drawLeaderboard(result); }
    catch (error) { if (root.dataset.view === 'leaderboard') q('.fish-leaderboard-list').textContent = error.message; }
  }
  function visit(locationId) {
    const location = getLocation(locationId);
    if (locationId !== 'home' && (!location || location.locked)) return;
    reset();
    if (locationId === 'home') {
      root.dataset.view = 'home'; q('.fish-world-map').hidden = true; q('.fish-home').hidden = false; q('.fish-leaderboard').hidden = true; q('.fish-shop').hidden = true; q('.fish-loadout').hidden = true;
      q('.fish-map-return').hidden = false; q('.fish-location-name').hidden = true;
      locationNotice.show('Дом');
      renderTrophies();
      progress.collection().catch(error => { q('.fish-trophy-empty').textContent = error.message; });
      syncPause(); return;
    }
    currentLocation = location.id; root.dataset.location = location.id; root.dataset.view = 'fishing';
    q('.fish-spots').hidden = false;
    q('.fish-world-map').hidden = true; q('.fish-home').hidden = true; q('.fish-leaderboard').hidden = true; q('.fish-shop').hidden = true; q('.fish-loadout').hidden = true; q('.fish-map-return').hidden = false;
    locationNotice.show(location.name);
    if (progressState.decision) {
      setState('result'); q('.fish-spots').hidden = true; q('.fish-result').hidden = false; showCatch(progressState.decision);
    }
    syncPause();
  }
  function showCatch(result) {
    currentCatch = result;
    q('.fish-catch-choices').querySelectorAll('button').forEach(button => { button.disabled = false; });
    const item = result.catch, portrait = q('.fish-portrait');
    portrait.replaceChildren();
    portrait.textContent = item.kind === 'small' ? '🐟' : '◆';
    if (item.image) { const img = document.createElement('img'); img.alt = item.name; img.src = item.image; portrait.replaceChildren(img); }
    q('.fish-result h3').textContent = item.name;
    q('.fish-result p').textContent = item.caption || '';
    q('.fish-catch-choices').hidden = !result.duplicate || Boolean(result.choice);
    q('.fish-again').hidden = result.duplicate && !result.choice;
  }
  function showSmallReward(amount = 1) {
    clearTimeout(rewardTimer);
    const reward = q('.fish-catch-plus'); reward.innerHTML = `+${amount} <span>≈</span>`; reward.hidden = false; reward.classList.remove('is-rising'); void reward.offsetWidth; reward.classList.add('is-rising');
    rewardTimer = setTimeout(() => { reward.hidden = true; reward.classList.remove('is-rising'); }, 1050);
  }
  async function finish() {
    const version = session;
    setState('resolving');
    q('.fish-check').hidden = true;
    q('.fish-approach').style.opacity = '0'; q('.fish-pull-wake').style.opacity = '0'; q('.fish-line').style.opacity = '0';
    q('.fish-result').hidden = true;
    q('.fish-result h3').textContent = '';
    q('.fish-result p').textContent = '';
    q('.fish-catch-choices').hidden = true;
    q('.fish-again').hidden = true;
    if (encounter) {
      const token = encounter.token;
      async function reveal() {
        setState('resolving'); q('.fish-result').hidden = true;
        q('.fish-again').disabled = true;
        try {
          const result = await progress.reveal(token);
          if (version !== session || state !== 'resolving') return;
          retryReveal = null;
          if (result.catch.kind === 'small') { reset(); showSmallReward(result.catch.amount); return; }
          setState('result'); q('.fish-result').hidden = false; showCatch(result);
        } catch (error) {
          if (version === session) { setState('result'); q('.fish-result').hidden = false; q('.fish-result p').textContent = error.message; retryReveal = reveal; q('.fish-again').hidden = false; }
        } finally { if (version === session) q('.fish-again').disabled = false; }
      }
      await reveal();
    }
  }

  async function chooseCatch(choice) {
    if (!currentCatch) return;
    const caught = currentCatch, version = session;
    await withCatchChoice([...q('.fish-catch-choices').querySelectorAll('button')], async () => {
      try {
        await progress.resolveCatch(caught, choice);
        if (version !== session) return;
        await playCatchChoice(choice);
        if (version === session) reset();
      } catch (error) {
        q('.fish-result').classList.remove('is-choosing');
        if (version === session) q('.fish-result p').textContent = error.message;
      }
    });
  }

  async function playCatchChoice(choice) {
    const stage = q('.fish-stage'), stageRect = stage.getBoundingClientRect();
    const portraitRect = q('.fish-portrait').getBoundingClientRect();
    const sceneRect = q('.fish-scene').getBoundingClientRect();
    const startPoint = { x: portraitRect.left - stageRect.left + portraitRect.width / 2, y: portraitRect.top - stageRect.top + portraitRect.height / 2 };
    const targetSvg = choice === 'eat' ? { x: 367, y: 361 } : { x: 118, y: 475 };
    const endPoint = { x: sceneRect.left - stageRect.left + sceneRect.width * targetSvg.x / 450, y: sceneRect.top - stageRect.top + sceneRect.height * targetSvg.y / 600 };
    const flight = document.createElement('div');
    flight.className = `fish-choice-flight is-${choice}`;
    flight.setAttribute('aria-hidden', 'true');
    flight.style.left = `${startPoint.x - 27}px`; flight.style.top = `${startPoint.y - 17}px`;
    flight.innerHTML = '<svg viewBox="0 0 72 42"><path class="fish-choice-tail" d="M17 21 2 8v26z"/><path class="fish-choice-body" d="M14 21C25 5 53 4 68 21 53 38 25 37 14 21Z"/><circle cx="55" cy="17" r="2.3"/><path d="M29 11q7 10 0 20" fill="none" stroke="currentColor" stroke-width="2" opacity=".5"/></svg>';
    stage.append(flight); q('.fish-result').classList.add('is-choosing');
    const duration = motionPreference.matches ? 220 : choice === 'eat' ? 720 : 880;
    if (typeof flight.animate === 'function') {
      const animation = flight.animate(catchChoiceKeyframes(choice, startPoint, endPoint), { duration, easing: 'cubic-bezier(.25,.75,.25,1)', fill: 'forwards' });
      await animation.finished.catch(() => {});
    } else await new Promise(resolve => setTimeout(resolve, duration));
    if (choice === 'release') {
      const splash = document.createElement('i'); splash.className = 'fish-choice-splash'; splash.setAttribute('aria-hidden', 'true');
      splash.style.left = `${endPoint.x}px`; splash.style.top = `${endPoint.y}px`; stage.append(splash);
      await new Promise(resolve => setTimeout(resolve, motionPreference.matches ? 120 : 360)); splash.remove();
    } else {
      root.classList.add('is-chewing');
      await new Promise(resolve => setTimeout(resolve, motionPreference.matches ? 80 : 220)); root.classList.remove('is-chewing');
    }
    flight.remove(); q('.fish-result').classList.remove('is-choosing');
  }

  function reset() {
    q('.fish-catch-choices').querySelectorAll('button').forEach(button => { button.disabled = false; });
    session++; encounter = null; retryReveal = null; currentCatch = null; strikePulse = 0; q('.fish-again').disabled = false; q('.fish-again').hidden = false; q('.fish-catch-choices').hidden = true; q('.fish-result').classList.remove('is-choosing'); root.classList.remove('is-chewing'); delete root.dataset.pull;
    setState('idle'); q('.fish-result').hidden = true; q('.fish-check').hidden = true; q('.fish-tension').hidden = true;
    q('.fish-spots').hidden = root.dataset.view !== 'fishing';
    for (const selector of ['.fish-float', '.fish-line', '.fish-bubbles', '.fish-approach', '.fish-pull-wake', '.fish-broken-hook']) q(selector).style.opacity = '0';
    Object.assign(displayedPose, { shiftX: 0, shiftY: 0, lean: 0, rodAngle: 0 });
    q('.fish-angler').setAttribute('transform', `translate(0 0) rotate(0 ${FISHING_RIG.body.x} ${FISHING_RIG.body.y})`);
    q('.fish-rod').setAttribute('transform', `rotate(0 ${FISHING_RIG.hand.x} ${FISHING_RIG.hand.y})`);
    action('', true);
  }
  async function cast(spot) {
    if (state !== 'idle') return;
    root.focus({ preventScroll: true });
    selectedSpot = spot;
    setState('preparing'); q('.fish-spots').hidden = true;
    const version = ++session;
    try {
      encounter = await progress.cast(selectedSpot, currentLocation, { devCatch: q('[name="fish-dev-catch"]').value || undefined, devRod: q('[name="fish-dev-rod"]').value || undefined, devBait: q('[name="fish-dev-bait"]').value || undefined });
      if (version !== session) return;
      if (!encounter.success) throw new Error('No encounter');
    } catch (error) { if (version === session) { reset(); toast(error.message, 4500); } return; }
    point = { ...FISHING_RIG.cast };
    waitMs = (2800 + Math.random() * 3000) * (encounter.traits.waitScale || 1);
    q('.fish-spots').hidden = true;
    q('.fish-line').setAttribute('d', linePath(FISHING_RIG.tip, point, .5));
    setState('casting'); action('', true); start();
  }
  function concludeFight() {
    if (fight.outcome !== 'caught') {
      landingStart = { ...fishPosition }; setState('escaping');
      q('.fish-check').hidden = true; q('.fish-tension').hidden = true; q('.fish-broken-hook').style.opacity = '1'; action('', true); return;
    }
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
      if (t === 1) { q('.fish-line').style.opacity = '.7'; setState('waiting'); action('', true); }
    } else if (state === 'waiting' && elapsed >= waitMs) {
      setState('approach'); fishPosition = { x: point.x + 20, y: point.y + 12 }; root.dataset.pull = 'bite';
      q('.fish-float').style.opacity = encounter.traits.challenge === 'fight' ? '1' : '0'; q('.fish-bubbles').setAttribute('transform', `translate(${fishPosition.x} ${fishPosition.y})`); q('.fish-bubbles').style.opacity = '1';
    } else if (state === 'approach') {
      const rare = encounter.traits.challenge === 'fight';
      const circling = rare && elapsed < RARE_ORBIT_MS;
      const orbit = rare ? Math.min(1, elapsed / RARE_ORBIT_MS) : 1;
      const t = Math.min(1, Math.max(0, elapsed - (rare ? RARE_ORBIT_MS : 0)) / 2200);
      const pull = 1 - Math.pow(1 - t, 3);
      const orbitPose = circling ? orbitFishPose(point, orbit) : null;
      fishPosition = orbitPose || biteFishPosition(point, t);
      const fishTransform = orbitPose
        ? `translate(${orbitPose.x} ${orbitPose.y}) rotate(${orbitPose.angle}) scale(${orbitPose.scaleX} ${orbitPose.scaleY})`
        : `translate(${fishPosition.x} ${fishPosition.y})`;
      q('.fish-approach').style.opacity = String(orbitPose ? Math.min(orbitPose.opacity, orbit * 8) : Math.min(1, t * 5)); q('.fish-approach').setAttribute('transform', fishTransform);
      q('.fish-pull-wake').style.opacity = String(orbitPose ? (.22 + orbitPose.depth * .34) : .75 * pull); q('.fish-pull-wake').setAttribute('transform', fishTransform);
      q('.fish-bubbles').setAttribute('transform', `translate(${fishPosition.x + 18} ${fishPosition.y + 5})`);
      if (!circling) { root.dataset.pull = 'bite'; q('.fish-float').style.opacity = '0'; }
      if (t === 1) {
        if (encounter.traits.challenge === 'auto') { fight = { outcome: 'caught' }; q('.fish-bubbles').style.opacity = '0'; void finish(); }
        else { fight = createFight(Math.random, encounter.traits); q('.fish-track').style.setProperty('--fish-divisions', fight.divisions); zones(); showProgress(); setState('fight'); root.dataset.pull = 'fight'; q('.fish-check').hidden = false; q('.fish-tension').hidden = false; q('.fish-bubbles').style.opacity = '0'; action('', false); }
      }
    } else if (state === 'fight') {
      const previousPhase = fight.phase;
      advance(fight, dt); showProgress();
      if (fight.outcome) { concludeFight(); animatePose(dt); raf = requestAnimationFrame(tick); return; }
      if (savedRound !== fight.round) zones();
      const resting = fight.phase === 'rest';
      root.dataset.pull = resting ? 'recover' : 'fight';
      const fishTug = .5 + .5 * Math.sin(fight.motionTime * (resting ? 3.2 : 7.2));
      const fishTarget = { x: (resting ? 91 : 92) - fishTug * (resting ? 14 : 10), y: 454 + Math.sin(fight.motionTime * (resting ? 7 : 4.6)) * (resting ? 4 : 5) };
      const fishBlend = 1 - Math.exp(-dt / 110);
      fishPosition.x += (fishTarget.x - fishPosition.x) * fishBlend; fishPosition.y += (fishTarget.y - fishPosition.y) * fishBlend;
      q('.fish-approach').style.opacity = '.82'; q('.fish-approach').setAttribute('transform', `translate(${fishPosition.x} ${fishPosition.y})`);
      q('.fish-pull-wake').style.opacity = resting ? '.52' : '.7'; q('.fish-pull-wake').setAttribute('transform', `translate(${fishPosition.x} ${fishPosition.y})`);
      q('.fish-check').classList.toggle('is-resting', resting);
      q('.fish-cursor').style.bottom = `${passPosition(fight) * 100}%`;
      q('.fish-round').textContent = resting ? `${Math.ceil((REST_MS - fight.elapsed) / 1000)} с` : `0${fight.round}`;
      if (previousPhase !== fight.phase) action('', resting);
    } else if (state === 'landing') {
      const t = Math.min(1, elapsed / 380), lift = 1 - Math.pow(1 - t, 2);
      fishPosition = { x: landingStart.x + (160 - landingStart.x) * lift, y: landingStart.y - 36 * lift };
      q('.fish-approach').setAttribute('transform', `translate(${fishPosition.x} ${fishPosition.y})`);
      q('.fish-pull-wake').setAttribute('transform', `translate(${fishPosition.x} ${fishPosition.y})`); q('.fish-pull-wake').style.opacity = String(.6 * (1 - t));
      if (t === 1) void finish();
    } else if (state === 'escaping') {
      const t = Math.min(1, elapsed / 720), rush = 1 - Math.pow(1 - t, 3);
      fishPosition = { x: landingStart.x - 190 * rush, y: landingStart.y + Math.sin(t * Math.PI * 4) * 5 };
      q('.fish-approach').setAttribute('transform', `translate(${fishPosition.x} ${fishPosition.y})`);
      q('.fish-approach').style.opacity = String(1 - Math.max(0, (t - .7) / .3));
      q('.fish-pull-wake').setAttribute('transform', `translate(${fishPosition.x} ${fishPosition.y})`);
      q('.fish-pull-wake').style.opacity = String(.7 * (1 - t));
      if (t === 1) reset();
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
    const rareOrbit = state === 'approach' && encounter?.traits.challenge === 'fight' && elapsed < RARE_ORBIT_MS;
    const poseElapsed = state === 'approach' && encounter?.traits.challenge === 'fight' ? Math.max(0, elapsed - RARE_ORBIT_MS) : elapsed;
    const targetPose = anglerPose(state, poseElapsed, fight, t, reduced, strikePulse);
    const blend = reduced ? 1 : 1 - Math.exp(-dt / (strikePulse ? 55 : 95));
    for (const key of ['shiftX', 'shiftY', 'lean', 'rodAngle']) displayedPose[key] += (targetPose[key] - displayedPose[key]) * blend;
    const { shiftX, shiftY, lean, rodAngle } = displayedPose;
    q('.fish-angler').setAttribute('transform', `translate(${shiftX} ${shiftY}) rotate(${lean} ${FISHING_RIG.body.x} ${FISHING_RIG.body.y})`);
    q('.fish-rod').setAttribute('transform', `rotate(${rodAngle} ${FISHING_RIG.hand.x} ${FISHING_RIG.hand.y})`);
    if (state === 'waiting' || state === 'approach' || state === 'fight' || state === 'landing' || state === 'escaping') {
      const tip = rodTip(rodAngle, lean, shiftX, shiftY);
      let end = state === 'waiting' || rareOrbit ? point : { x: fishPosition.x - 22, y: fishPosition.y };
      if (state === 'escaping') {
        const snap = Math.min(1, elapsed / 720), recoil = 1 - Math.pow(1 - snap, 2);
        end = { x: landingStart.x - 22 + (tip.x + 26 - (landingStart.x - 22)) * recoil, y: landingStart.y + (tip.y + 48 - landingStart.y) * recoil };
        q('.fish-broken-hook').setAttribute('transform', `translate(${end.x} ${end.y}) rotate(${snap * 150})`);
        q('.fish-broken-hook').style.opacity = String(1 - snap);
      }
      q('.fish-line').style.opacity = state === 'waiting' ? '.7' : state === 'escaping' ? String(Math.max(0, 1 - elapsed / 720)) : '.92';
      q('.fish-line').setAttribute('d', linePath(tip, end, rareOrbit ? .55 : targetPose.pulling ? .96 : .55));
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
  q('.fish-leaderboard-open').addEventListener('click', () => { void showLeaderboard(); });
  q('.fish-leaderboard-back').addEventListener('click', showMap);
  q('.fish-shop-open').addEventListener('click', showShop);
  q('.fish-store-back').addEventListener('click', showMap);
  q('.fish-loadout-open').addEventListener('click', showLoadout);
  q('.fish-loadout-back').addEventListener('click', closeLoadout);
  bindStrikeInput(q('.fish-action'), q('.fish-stage'), root, hit, () => state === 'fight');
  q('.fish-again').addEventListener('click', () => retryReveal ? retryReveal() : reset());
  bindCatchChoiceInput(q('.fish-catch-choices'), choice => { void chooseCatch(choice); });
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
