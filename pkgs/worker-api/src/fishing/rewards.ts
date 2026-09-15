export function smallFishAmount(roll: number) {
  if (roll < .55) return 1;
  if (roll < .85) return 2;
  if (roll < .95) return 3;
  if (roll < .99) return 4;
  return 5;
}
