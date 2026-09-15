// Server-only catalog. Never copy this module into the static frontend.
// drift: progress points/second toward fish; shake: cosmetic points around
// actual progress; shakeSpeed: oscillations/second. All phrases stay here.
export const TEACHER_CHANCE = 0.12;
export const fishingCatalog = [
  { id: 'kalinin', name: 'Калинин А.И.', image: '/src/fishing/fishing-photos/kalinin.webp',
    spots: ['deep'], periods: ['morning', 'day', 'evening', 'night'], rain: null,
    rarityWeight: 1, fightPassScale: 1.08, fightZoneScale: 1.08, drift: 0.12, shake: 2.5, shakeSpeed: 1.8,
    phrases: ['Жирнее.'] },
  { id: 'grekova', name: 'Грекова А.В.', image: '/src/fishing/fishing-photos/grekova.webp',
    spots: ['deep'], periods: ['morning', 'day', 'evening', 'night'], rain: null,
    rarityWeight: .75, fightPassScale: 1, fightZoneScale: 1, drift: 0.28, shake: 4.5, shakeSpeed: 2.7,
    phrases: ['Глазками', 'Мальчик думает бабушка не видит.'] },
  { id: 'kastrica', name: 'Кастрица О.А.', image: '/src/fishing/fishing-photos/kastrica.webp',
    spots: ['deep'], periods: ['morning', 'day', 'evening', 'night'], rain: null,
    rarityWeight: .55, fightPassScale: .94, fightZoneScale: .92, drift: .4, shake: 5.2, shakeSpeed: 3.2,
    phrases: ['Вы опустились до уровня ваших штанов'] },
  { id: 'orlovich', name: 'Орлович Ю.Л.', image: '/src/fishing/fishing-photos/orlovich.webp',
    spots: ['deep'], periods: ['morning', 'day', 'evening', 'night'], rain: null,
    rarityWeight: .35, fightPassScale: .88, fightZoneScale: .84, drift: .52, shake: 6.1, shakeSpeed: 3.7,
    phrases: ['Граф.'] },
  { id: 'vaskovsky', name: 'Васьковский М.М.', image: '/src/fishing/fishing-photos/vaskovsky.webp',
    spots: ['deep'], periods: ['morning', 'day', 'evening', 'night'], rain: null,
    rarityWeight: .08, fightPassScale: .68, fightZoneScale: .68, drift: .92, shake: 8, shakeSpeed: 4.8,
    phrases: ['Неочевидно', 'ИСУ жил, жив и будет жить.'] },
] as Array<{ id: string; name: string; image: string | null; spots: string[];
  periods: string[]; rain: boolean | null; rarityWeight: number; fightPassScale: number; fightZoneScale: number; drift: number; shake: number;
  shakeSpeed: number; phrases: string[] }>;

export function pickFishingCandidate(candidates: typeof fishingCatalog, roll: number) {
  const total = candidates.reduce((sum, fish) => sum + Math.max(0, fish.rarityWeight), 0);
  if (!candidates.length || total <= 0) return null;
  let target = Math.max(0, Math.min(1 - Number.EPSILON, roll)) * total;
  for (const fish of candidates) {
    target -= Math.max(0, fish.rarityWeight);
    if (target < 0) return fish;
  }
  return candidates[candidates.length - 1] || null;
}
