// Server-only catalog. Never copy this module into the static frontend.
// drift: progress points/second toward fish; shake: cosmetic points around
// actual progress; shakeSpeed: oscillations/second. All phrases stay here.
export const fishingCatalog = [
  { id: 'reeds-mystery', name: 'Таинственный преподаватель', image: null,
    spots: ['reeds'], periods: ['morning', 'day', 'evening', 'night'], rain: null,
    drift: 0.12, shake: 2.5, shakeSpeed: 1.8,
    phrases: ['Улов у камышей.'] },
  { id: 'deep-mystery', name: 'Таинственный преподаватель', image: null,
    spots: ['deep'], periods: ['morning', 'day', 'evening', 'night'], rain: null,
    drift: 0.28, shake: 4.5, shakeSpeed: 2.7,
    phrases: ['Улов с глубины.'] },
] as Array<{ id: string; name: string; image: string | null; spots: string[];
  periods: string[]; rain: boolean | null; drift: number; shake: number;
  shakeSpeed: number; phrases: string[] }>;
