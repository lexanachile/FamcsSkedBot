const DAY_NAMES: Record<number, string> = {
  1: "Понедельник", 2: "Вторник", 3: "Среда", 4: "Четверг", 5: "Пятница", 6: "Суббота",
};

export function getDayOfWeekName(day: number): string {
  return DAY_NAMES[day] || "Неизвестно";
}

export function extractLastName(fullName: string): string {
  if (!fullName) return "";
  const trimmed = fullName.normalize("NFC").trim()
    .replace(/^(?:(?:проф|доц|ст\.?\s*преп|преп|ассист)\.?\s+)+/iu, "")
    .replace(/^(?:[А-ЯЁA-Z]\.\s*){1,2}/u, "");
  // Initials may be glued to the surname; dates and notes are not names.
  return trimmed.match(/^[А-ЯЁA-Z][а-яёa-z]+(?:-[А-ЯЁA-Z][а-яёa-z]+)*/u)?.[0] || "";
}

export function extractTeacherNames(value: string): string[] {
  return value.split(/[,;\/\n]+/u).map(extractLastName).filter(Boolean);
}
