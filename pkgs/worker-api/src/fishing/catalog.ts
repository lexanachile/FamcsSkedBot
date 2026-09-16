// Server-only catalog. Never copy this module into the static frontend.
//
// Вероятность:
//   weight — относительный вес конкретной фразы. Чем меньше, тем она реже.
//
// Сложность fight:
//   passScale  — скорость индикатора; меньше = быстрее и сложнее.
//   zoneScale  — ширина зон; меньше = уже и сложнее.
//   drift      — потеря прогресса в секунду.
//   shake      — амплитуда визуальной тряски.
//   shakeSpeed — скорость визуальной тряски.
//
// Пока есть закрытые фразы, выбор идёт только среди них. После заполнения
// коллекции в выбор возвращаются все фразы с теми же weight.

export const TEACHER_CHANCE = 0.04;

export type PhraseSettings = {
  text: string;
  weight: number;
  fight: {
    passScale: number;
    zoneScale: number;
    drift: number;
    shake: number;
    shakeSpeed: number;
  };
};

export type FishingTeacher = {
  id: string;
  name: string;
  image: string | null;
  spots: string[];
  periods: string[];
  rain: boolean | null;
  phrases: PhraseSettings[];
};

export const fishingCatalog: FishingTeacher[] = [
  {
    id: 'kalinin',
    name: 'Калинин А.И.',
    image: '/src/fishing/fishing-photos/kalinin.webp',
    spots: ['deep'],
    periods: ['morning', 'day', 'evening', 'night'],
    rain: null,
    phrases: [
      {
        text: 'Жирнее.',
        weight: 1,
        fight: { passScale: 1.08, zoneScale: 1.08, drift: 0.12, shake: 2.5, shakeSpeed: 1.8 },
      },
    ],
  },
  {
    id: 'grekova',
    name: 'Грекова А.В.',
    image: '/src/fishing/fishing-photos/grekova.webp',
    spots: ['deep'],
    periods: ['morning', 'day', 'evening', 'night'],
    rain: null,
    phrases: [
      {
        text: 'Глазками',
        weight: 0.75,
        fight: { passScale: 1, zoneScale: 1, drift: 0.28, shake: 4.5, shakeSpeed: 2.7 },
      },
      {
        text: 'Мальчик думает бабушка не видит.',
        weight: 0.45,
        fight: { passScale: 0.9, zoneScale: 0.86, drift: 0.46, shake: 5.8, shakeSpeed: 3.5 },
      },
    ],
  },
  {
    id: 'kastrica',
    name: 'Кастрица О.А.',
    image: '/src/fishing/fishing-photos/kastrica.webp',
    spots: ['deep'],
    periods: ['morning', 'day', 'evening', 'night'],
    rain: null,
    phrases: [
      {
        text: 'Вы опустились до уровня ваших штанов',
        weight: 0.55,
        fight: { passScale: 0.94, zoneScale: 0.92, drift: 0.4, shake: 5.2, shakeSpeed: 3.2 },
      },
    ],
  },
  {
    id: 'orlovich',
    name: 'Орлович Ю.Л.',
    image: '/src/fishing/fishing-photos/orlovich.webp',
    spots: ['deep'],
    periods: ['morning', 'day', 'evening', 'night'],
    rain: null,
    phrases: [
      {
        text: 'Граф.',
        weight: 0.35,
        fight: { passScale: 0.88, zoneScale: 0.84, drift: 0.52, shake: 6.1, shakeSpeed: 3.7 },
      },
    ],
  },
  {
    id: 'vaskovsky',
    name: 'Васьковский М.М.',
    image: '/src/fishing/fishing-photos/vaskovsky.webp',
    spots: ['deep'],
    periods: ['morning', 'day', 'evening', 'night'],
    rain: null,
    phrases: [
      {
        text: 'Неочевидно',
        weight: 0.1,
        fight: { passScale: 0.7, zoneScale: 0.7, drift: 0.88, shake: 7.6, shakeSpeed: 4.6 },
      },
      {
        text: 'ИСУ жил, жив и будет жить.',
        weight: 0.05,
        fight: { passScale: 0.62, zoneScale: 0.6, drift: 1, shake: 8, shakeSpeed: 5 },
      },
    ],
  },
];

export type FishingVariant = { fish: FishingTeacher; phrase: PhraseSettings; phraseId: number };

export function fishingVariants(catalog: FishingTeacher[] = fishingCatalog): FishingVariant[] {
  return catalog.flatMap(fish => fish.phrases.map((phrase, phraseId) => ({ fish, phrase, phraseId })));
}

export function pickFishingVariant(candidates: FishingVariant[], roll: number) {
  const total = candidates.reduce((sum, candidate) => sum + Math.max(0, candidate.phrase.weight), 0);
  if (!candidates.length || total <= 0) return null;
  let target = Math.max(0, Math.min(1 - Number.EPSILON, roll)) * total;
  for (const candidate of candidates) {
    target -= Math.max(0, candidate.phrase.weight);
    if (target < 0) return candidate;
  }
  return candidates[candidates.length - 1] || null;
}
