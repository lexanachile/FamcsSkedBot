export const rods = [
  { id: 'twig', kind: 'rod', name: 'Ивовая ветка', price: 0, description: 'Медленный клёв, быстрая проверка на 1,4 секунды и небольшой сектор. Без бонуса к редкому улову.', reactionMs: 1400, quickZone: .12, zoneScale: .8, divisions: 12, driftScale: 1, shakeScale: 1, waitScale: 1.2, rareBonus: 0, autoSmall: false },
  { id: 'reed', kind: 'rod', name: 'Камышовая удочка', price: 25, description: 'Обычная скорость клёва, больше времени на проверку и +1% к редкому улову.', reactionMs: 1800, quickZone: .15, zoneScale: 1, divisions: 9, driftScale: .94, shakeScale: .9, waitScale: 1, rareBonus: .01, autoSmall: false },
  { id: 'lake', kind: 'rod', name: 'Озёрная удочка', price: 80, description: 'Клёв на 22% быстрее, спокойная реакция, широкие деления и +2% к редкому улову.', reactionMs: 2300, quickZone: .18, zoneScale: 1.2, divisions: 7, driftScale: .84, shakeScale: .78, waitScale: .78, rareBonus: .02, autoSmall: false },
  { id: 'moon', kind: 'rod', name: 'Лунная удочка', price: 200, description: 'Клёв на 45% быстрее, широкие сектора, мягкие рывки и +4% к редкому улову.', reactionMs: 2900, quickZone: .23, zoneScale: 1.45, divisions: 5, driftScale: .68, shakeScale: .58, waitScale: .55, rareBonus: .04, autoSmall: false },
  { id: 'auto', kind: 'rod', name: 'Тихий автомат', price: 500, description: 'Клёв на 65% быстрее, обычная рыбка ловится сама, +6% к редкому улову.', reactionMs: 3000, quickZone: .22, zoneScale: 1.5, divisions: 4, driftScale: .58, shakeScale: .48, waitScale: .35, rareBonus: .06, autoSmall: true },
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
    rods: rods.map(({ reactionMs, quickZone, zoneScale, divisions, driftScale, shakeScale, waitScale, rareBonus, autoSmall, ...item }) => ({ ...item, effects: { waitPercent: Math.round((1 - waitScale) * 100), rarePercent: Math.round(rareBonus * 100) } })),
    baits: baits.map(({ waitScale, rareBonus, ...item }) => ({ ...item, effects: { waitPercent: Math.round((1 - waitScale) * 100), rarePercent: Math.round(rareBonus * 100) } })),
  };
}
