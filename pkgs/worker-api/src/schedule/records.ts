import { TIME_SLOTS } from "../constants";
import { getDayOfWeekName } from "../formatters";
import type { ScheduleRecord } from "../types";

export function normalizeRecord(record: ScheduleRecord): ScheduleRecord {
  const slot = record.timeSlot ? TIME_SLOTS[record.timeSlot - 1] : undefined;
  return {
    ...record,
    course: Number(record.course),
    dayOfWeek: Number(record.dayOfWeek),
    startTime: record.startTime || slot?.start || "",
    endTime: record.endTime || slot?.end || "",
    isCommon: record.isCommon === true || record.isCommon === 1,
    isLecture: record.isLecture === true || record.isLecture === 1,
  };
}

export function toScheduleClass(record: ScheduleRecord) {
  const common = record.isCommon === true || record.isCommon === 1;
  const comments = record.comments || record.commentsA || record.commentsB || null;
  return {
    classId: record.classId,
    groupName: record.groupName,
    course: record.course,
    dayOfWeek: record.dayOfWeek,
    dayOfWeekName: getDayOfWeekName(record.dayOfWeek),
    startTime: record.startTime,
    endTime: record.endTime,
    isCommon: common,
    isLecture: record.isLecture === true || record.isLecture === 1,
    subgroupA: { classTitle: record.classTitleA, professorName: record.professorNameA, classroom: record.classroomA, comments },
    subgroupB: common ? null : { classTitle: record.classTitleB, professorName: record.professorNameB, classroom: record.classroomB, comments },
  };
}
