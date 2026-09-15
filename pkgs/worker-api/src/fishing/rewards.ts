export function smallFishAmount(roll: number) {
  if (roll < .55) return 1;
  if (roll < .85) return 2;
  if (roll < .95) return 3;
  if (roll < .99) return 4;
  return 5;
}

export function rareCatchChance(baseChance: number, baitBonus: number, commonCatchStreak: number) {
  const streakBonus = Math.max(0, Math.floor(Number(commonCatchStreak) || 0)) * .01;
  return Math.min(.95, Math.max(0, baseChance) + Math.max(0, baitBonus) + streakBonus);
}
