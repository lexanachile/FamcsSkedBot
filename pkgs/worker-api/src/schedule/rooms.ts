import type { ScheduleRecord } from "../types";

const normalize = (room: string) => room.trim().replace(/\s+/g, " ").toLocaleLowerCase("ru");
const sortRooms = (rooms: string[]) => rooms.sort((a, b) => a.localeCompare(b, "ru", { numeric: true }));
const minutes = (value: string) => {
  const match = value.trim().match(/^(\d{1,2})[.:](\d{2})$/);
  return match && Number(match[1]) < 24 && Number(match[2]) < 60 ? Number(match[1]) * 60 + Number(match[2]) : NaN;
};

export function configuredRooms(value?: string): string[] {
  if (!value) throw new Error("AVAILABLE_ROOMS is not configured");
  const rooms: unknown = JSON.parse(value);
  if (!Array.isArray(rooms) || rooms.some(room => typeof room !== "string" || !room.trim())) {
    throw new Error("AVAILABLE_ROOMS must be a JSON array of non-empty strings");
  }
  return sortRooms([...new Map(rooms.map(room => [normalize(room), room.trim()])).values()]);
}

export function findRooms(rooms: string[], records: ScheduleRecord[], day: number, start: string, end: string) {
  const busy = new Set<string>();
  const slotStart = minutes(start), slotEnd = minutes(end);
  for (const record of records) {
    // Include all variants conservatively: this endpoint describes a weekly slot.
    if (record.dayOfWeek !== day) continue;
    const lessonStart = minutes(record.startTime || ''), lessonEnd = minutes(record.endTime || '');
    // Unknown/malformed times cannot establish that the room is free.
    if (Number.isFinite(lessonStart) && Number.isFinite(lessonEnd) && lessonStart < lessonEnd &&
        (lessonStart >= slotEnd || lessonEnd <= slotStart)) continue;
    for (const value of [record.classroomA, record.classroomB]) {
      for (const room of (value || "").split(/[,;\/\n]+/)) busy.add(normalize(room));
    }
  }
  return {
    freeRooms: rooms.filter(room => !busy.has(normalize(room))),
    busyRooms: rooms.filter(room => busy.has(normalize(room))),
    totalRooms: rooms.length,
  };
}
