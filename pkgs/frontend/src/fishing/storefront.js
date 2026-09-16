export function storeMarkup() {
  return `<button type="button" class="fish-shop-open">Магазин</button>
    <section class="fish-store fish-shop" aria-label="Магазин улучшений" hidden>
      <header><button type="button" class="fish-store-back" aria-label="Вернуться на карту">←</button><div><h2>Магазин</h2></div><strong class="fish-store-wallet">0 ≈</strong></header>
      <p class="fish-store-intro">Удочки остаются навсегда. Одна порция прикормки расходуется на следующий заброс.</p>
      <p class="fish-store-message" role="status"></p>
      <div class="fish-store-content"><p class="fish-store-loading">Загружаем товары…</p></div>
    </section>
    <section class="fish-store fish-loadout" aria-label="Снаряжение" hidden>
      <header><button type="button" class="fish-loadout-back" aria-label="Вернуться к водоёму">←</button><div><h2>Снаряжение</h2></div><strong class="fish-loadout-wallet">0 ≈</strong></header>
      <p class="fish-store-intro">Выберите удочку и прикормку. Прикормка останется активной, пока не закончатся порции.</p>
      <p class="fish-store-message" role="status"></p>
      <div class="fish-loadout-content"><p class="fish-store-loading">Проверяем рюкзак…</p></div>
    </section>`;
}

function itemCard(item, meta, action, label, disabled = false) {
  const card = document.createElement('article');
  card.className = `fish-store-card fish-store-${item.kind}`;
  const copy = document.createElement('div');
  const name = document.createElement('h3'); name.textContent = item.name;
  const description = document.createElement('p'); description.textContent = item.description;
  const note = document.createElement('small'); note.textContent = meta;
  copy.append(name, description, note);
  const button = document.createElement('button'); button.type = 'button'; button.textContent = label; button.disabled = disabled;
  button.addEventListener('click', async () => {
    button.disabled = true;
    try { await action(item.id); } finally { if (button.isConnected) button.disabled = disabled; }
  });
  card.append(copy, button); return card;
}

export function renderShop(container, catalog, game, buy) {
  container.replaceChildren();
  const rodHeading = document.createElement('h3'); rodHeading.className = 'fish-store-section-title'; rodHeading.textContent = 'Удочки';
  container.append(rodHeading);
  for (const item of catalog.rods) {
    const owned = game.inventory.rods.includes(item.id);
    container.append(itemCard(item, owned ? 'Уже в рюкзаке' : 'Постоянное улучшение', buy, owned ? 'Куплено' : `${item.price} ≈`, owned));
  }
  const baitHeading = document.createElement('h3'); baitHeading.className = 'fish-store-section-title'; baitHeading.textContent = 'Прикормка';
  container.append(baitHeading);
  for (const item of catalog.baits) {
    const count = game.inventory.baits[item.id] || 0;
    container.append(itemCard(item, `В рюкзаке: ${count}`, buy, `${item.price} ≈`));
  }
}

export function renderLoadout(container, catalog, game, equip) {
  container.replaceChildren();
  const rodHeading = document.createElement('h3'); rodHeading.className = 'fish-store-section-title'; rodHeading.textContent = 'Активная удочка';
  container.append(rodHeading);
  for (const item of catalog.rods.filter(item => game.inventory.rods.includes(item.id))) {
    const active = game.equipped.rod === item.id;
    container.append(itemCard(item, active ? 'Сейчас в руках' : 'Куплена', id => equip('rod', id), active ? 'Выбрана' : 'Выбрать', active));
  }
  const baitHeading = document.createElement('h3'); baitHeading.className = 'fish-store-section-title'; baitHeading.textContent = 'Прикормка';
  container.append(baitHeading);
  const none = { id: 'none', kind: 'bait', name: 'Без прикормки', description: 'Сохранить все порции для другого заброса.' };
  const noBait = game.equipped.bait === null;
  container.append(itemCard(none, '', () => equip('bait', null), noBait ? 'Выбрано' : 'Выбрать', noBait));
  for (const item of catalog.baits.filter(item => (game.inventory.baits[item.id] || 0) > 0)) {
    const active = game.equipped.bait === item.id, count = game.inventory.baits[item.id] || 0;
    container.append(itemCard(item, `Осталось порций: ${count}`, id => equip('bait', id), active ? 'Выбрана' : 'Использовать', active));
  }
}

export const devRodOptions = [['', 'Купленная · авто'], ['twig', 'Ивовая ветка'], ['reed', 'Камышовая'], ['lake', 'Озёрная'], ['moon', 'Лунная'], ['auto', 'Тихий автомат']];
export const devBaitOptions = [['', 'Выбранная · авто'], ['crumbs', 'Хлебные крошки'], ['berries', 'Ягодная смесь'], ['glow', 'Светящаяся пыльца']];
export const devCatchOptions = [['', 'Случайный'], ['small', 'Обычная рыбка'], ['rare', 'Редкий улов']];
export function optionsMarkup(options) {
  return options.map(([value, label]) => `<option value="${value}">${label}</option>`).join('');
}
