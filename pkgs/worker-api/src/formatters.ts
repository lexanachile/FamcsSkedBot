const DAY_NAMES: Record<number, string> = {
  1: "Понедельник", 2: "Вторник", 3: "Среда", 4: "Четверг", 5: "Пятница", 6: "Суббота",
};

export function getDayOfWeekName(day: number): string {
  return DAY_NAMES[day] || "Неизвестно";
}

export function extractLastName(fullName: string): string {
  if (!fullName) return "";
  const trimmed = fullName.trim();
  const match = trimmed.match(/\s+([А-ЯЁA-Z])\.\s*([А-ЯЁA-Z])\./u);
  if (match?.index !== undefined) {
    const words = trimmed.substring(0, match.index).split(/\s+/).filter(Boolean);
    if (words.length) return words[words.length - 1];
  }
  return trimmed;
}
