export const rods = [
  { id: 'twig', kind: 'rod', name: 'Ивовая ветка', price: 0, description: 'Быстрая проверка: 1,4 секунды и небольшой сектор.', reactionMs: 1400, quickZone: .12, zoneScale: .8, divisions: 12, driftScale: 1, shakeScale: 1, autoSmall: false },
  { id: 'reed', kind: 'rod', name: 'Камышовая удочка', price: 25, description: 'Больше времени и хорошо заметный сектор.', reactionMs: 1800, quickZone: .15, zoneScale: 1, divisions: 9, driftScale: .94, shakeScale: .9, autoSmall: false },
  { id: 'lake', kind: 'rod', name: 'Озёрная удочка', price: 80, description: 'Спокойная реакция и широкие деления.', reactionMs: 2300, quickZone: .18, zoneScale: 1.2, divisions: 7, driftScale: .84, shakeScale: .78, autoSmall: false },
  { id: 'moon', kind: 'rod', name: 'Лунная удочка', price: 200, description: 'Широкие сектора и мягкие рывки редкого улова.', reactionMs: 2900, quickZone: .23, zoneScale: 1.45, divisions: 5, driftScale: .68, shakeScale: .58, autoSmall: false },
  { id: 'auto', kind: 'rod', name: 'Тихий автомат', price: 500, description: 'Обычная рыбка ловится сама. Редкий улов остаётся вашей задачей.', reactionMs: 3000, quickZone: .22, zoneScale: 1.5, divisions: 4, driftScale: .58, shakeScale: .48, autoSmall: true },
] as const;

export const baits = [
  { id: 'crumbs', kind: 'bait', name: 'Хлебные крошки', price: 8, description: 'Клёв на 15% быстрее, +2% к редкому улову.', waitScale: .85, rareBonus: .02 },
  { id: 'berries', kind: 'bait', name: 'Ягодная смесь', price: 20, description: 'Клёв на 30% быстрее, +5% к редкому улову.', waitScale: .7, rareBonus: .05 },
  { id: 'glow', kind: 'bait', name: 'Светящаяся пыльца', price: 45, description: 'Клёв вдвое быстрее, +10% к редкому улову.', waitScale: .5, rareBonus: .1 },
] as const;

export type RodId = typeof rods[number]['id'];
export type BaitId = typeof baits[number]['id'];
export const rodById = (id: unknown) => rods.find(item => item.id === id);
export const baitById = (id: unknown) => baits.find(item => item.id === id);

export function publicShop() {
  return {
    rods: rods.map(({ reactionMs, quickZone, zoneScale, divisions, driftScale, shakeScale, autoSmall, ...item }) => item),
    baits: baits.map(({ waitScale, rareBonus, ...item }) => ({ ...item, effects: { waitPercent: Math.round((1 - waitScale) * 100), rarePercent: Math.round(rareBonus * 100) } })),
  };
}
