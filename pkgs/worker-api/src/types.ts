export type Bindings = {
  DB: D1Database;
  SCHEDULE_KV: KVNamespace;
  NOTIFICATIONS_QUEUE: Queue;
  AUTH_TOKEN: string;
};

export type AppEnvironment = { Bindings: Bindings };

export type ScheduleRecord = {
  classId?: number | string;
  groupName: string;
  course: number;
  dayOfWeek: number;
  timeSlot?: number;
  startTime?: string;
  endTime?: string;
  isCommon?: boolean | number;
  isLecture?: boolean | number;
  classTitleA?: string | null;
  professorNameA?: string | null;
  classroomA?: string | null;
  commentsA?: string | null;
  classTitleB?: string | null;
  professorNameB?: string | null;
  classroomB?: string | null;
  commentsB?: string | null;
  comments?: string | null;
  [key: string]: unknown;
};

export type CourseManifest = {
  current: string;
  previous: string | null;
  course: number;
  updatedAt: string;
  recordCount: number;
  groupCount: number;
  schemaVersion?: 2;
  groups?: Record<string, GroupManifestEntry>;
};

export type GroupManifestEntry = {
  version: string;
  previousVersion: string | null;
  updatedAt: string;
  fingerprint: string;
  recordCount: number;
};

export type GroupScheduleDocument = {
  group: string;
  course: number;
  updatedAt: string;
  fingerprint: string;
  records: ScheduleRecord[];
};
