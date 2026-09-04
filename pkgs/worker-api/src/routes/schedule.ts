import type { Hono } from "hono";
import { TIME_SLOTS } from "../constants";
import { extractLastName, getDayOfWeekName } from "../formatters";
import { finalizeCourse, publishCourse, readAllCourses, readGroup, readGroupDocument, readGroups, readManifest, readManifestFresh, uploadGroup } from "../schedule/repository";
import { toScheduleClass } from "../schedule/records";
import type { AppEnvironment, GroupManifestEntry, ScheduleRecord } from "../types";

const validCourse = (value: string | undefined) => {
  const course = Number.parseInt(value || "", 10);
  return Number.isInteger(course) && course >= 1 && course <= 5 ? course : null;
};

export function registerScheduleRoutes(app: Hono<AppEnvironment>) {
  app.get("/api/schedule", async (c) => {
    const course = validCourse(c.req.query("course"));
    const group = c.req.query("group");
    if (!course || !group) return c.json({ success: false, error: "Missing or invalid required parameters" }, 400);
    try {
      const document = await readGroupDocument(c.env.SCHEDULE_KV, course, group);
      const records = document?.records || await readGroup(c.env.SCHEDULE_KV, course, group);
      if (!records?.length) return c.json({ success: true, data: { course, group, classes: [], message: "Расписание не найдено" } });
      const classes = records.map(toScheduleClass);
      const manifest = document ? null : await readManifest(c.env.SCHEDULE_KV, course);
      return c.json({ success: true, data: { course, group, totalClasses: classes.length, classes, updatedAt: document?.updatedAt || manifest?.updatedAt || null } });
    } catch (error) {
      console.error("KV schedule read failed", error);
      return c.json({ success: false, error: "Internal server error" }, 500);
    }
  });

  app.get("/api/groups", async (c) => {
    const course = validCourse(c.req.query("course"));
    if (!course) return c.json({ success: false, error: "Missing or invalid parameter: course" }, 400);
    try {
      const groups = await readGroups(c.env.SCHEDULE_KV, course);
      return c.json({ success: true, data: { course, groups: (groups || []).map((groupName) => ({ groupName })) } });
    } catch (error) {
      console.error("KV groups read failed", error);
      return c.json({ success: false, error: "Internal server error" }, 500);
    }
  });

  app.get("/api/teachers", async (c) => {
    try {
      const records = await readAllCourses(c.env.SCHEDULE_KV);
      const teachers = new Set<string>();
      for (const record of records) {
        for (const name of [record.professorNameA, record.professorNameB]) {
          const lastName = extractLastName(name || "");
          if (lastName) teachers.add(lastName);
        }
      }
      return c.json({ success: true, data: { teachers: [...teachers].sort((a, b) => a.localeCompare(b, "ru")) } });
    } catch (error) {
      console.error("KV teachers read failed", error);
      return c.json({ success: false, error: "Internal server error" }, 500);
    }
  });

  app.get("/api/teacher", async (c) => {
    const name = c.req.query("name")?.trim();
    if (!name) return c.json({ success: false, error: "Missing parameter: name" }, 400);
    try {
      const query = name.toLocaleLowerCase("ru");
      const records = (await readAllCourses(c.env.SCHEDULE_KV)).filter((record) =>
        [record.professorNameA, record.professorNameB].some((value) => value?.toLocaleLowerCase("ru").includes(query)),
      );
      const classes = records.map((record) => ({
        ...record,
        dayOfWeekName: getDayOfWeekName(record.dayOfWeek),
        isCommon: record.isCommon === true || record.isCommon === 1,
        isLecture: record.isLecture === true || record.isLecture === 1,
      }));
      return c.json({ success: true, data: { teacher: name, classes } });
    } catch (error) {
      console.error("KV teacher read failed", error);
      return c.json({ success: false, error: "Internal server error" }, 500);
    }
  });

  app.get("/api/rooms/free", async (c) => {
    const day = Number.parseInt(c.req.query("dayOfWeek") || "", 10);
    const pair = Number.parseInt(c.req.query("pairNumber") || "", 10);
    const slot = TIME_SLOTS[pair - 1];
    if (!Number.isInteger(day) || day < 1 || day > 6 || !slot) return c.json({ success: false, error: "Missing or invalid required parameters" }, 400);
    try {
      const records = await readAllCourses(c.env.SCHEDULE_KV);
      const allRooms = new Set<string>();
      const busy = new Set<string>();
      for (const record of records) {
        const rooms = [record.classroomA, record.classroomB].filter((room): room is string => Boolean(room?.trim()));
        rooms.forEach((room) => allRooms.add(room));
        if (record.dayOfWeek === day && record.startTime === slot.start && record.endTime === slot.end) rooms.forEach((room) => busy.add(room));
      }
      const busyRooms = [...busy].sort((a, b) => a.localeCompare(b, "ru", { numeric: true }));
      const freeRooms = [...allRooms].filter((room) => !busy.has(room)).sort((a, b) => a.localeCompare(b, "ru", { numeric: true }));
      return c.json({ success: true, data: { dayOfWeek: day, pairNumber: pair, startTime: slot.start, endTime: slot.end, freeRooms, busyRooms, totalRooms: allRooms.size } });
    } catch (error) {
      console.error("KV rooms read failed", error);
      return c.json({ success: false, error: "Internal server error" }, 500);
    }
  });

  app.post("/api/schedule/import", async (c) => {
    if (!c.env.AUTH_TOKEN || c.req.header("Authorization") !== `Bearer ${c.env.AUTH_TOKEN}`) return c.json({ success: false, error: "Unauthorized" }, 401);
    try {
      const body = await c.req.json<{
        course?: unknown;
        classes?: unknown;
        mode?: unknown;
        group?: unknown;
        fingerprint?: unknown;
        previousVersion?: unknown;
        importId?: unknown;
        groups?: unknown;
      }>();
      const course = validCourse(String(body.course ?? ""));
      if (!course) return c.json({ success: false, error: "Invalid payload" }, 400);

      if (body.mode === "state") {
        const manifest = await readManifestFresh(c.env.SCHEDULE_KV, course);
        return c.json({ success: true, data: { course, groups: manifest?.groups || {} } });
      }

      if (body.mode === "group") {
        if (typeof body.group !== "string" || !body.group.trim() || !Array.isArray(body.classes) ||
            typeof body.fingerprint !== "string" || !/^[a-f0-9]{64}$/.test(body.fingerprint)) {
          return c.json({ success: false, error: "Invalid group payload" }, 400);
        }
        const classes = body.classes as ScheduleRecord[];
        if (classes.some((item) => !item || item.course !== course || item.groupName !== body.group)) {
          return c.json({ success: false, error: "Invalid schedule record" }, 400);
        }
        const previousVersion = typeof body.previousVersion === "string" ? body.previousVersion : null;
        const entry = await uploadGroup(c.env.SCHEDULE_KV, course, body.group, classes, body.fingerprint, previousVersion);
        return c.json({ success: true, data: { group: body.group, entry } });
      }

      if (body.mode === "finalize") {
        if (typeof body.importId !== "string" || !body.importId || !body.groups || typeof body.groups !== "object" || Array.isArray(body.groups)) {
          return c.json({ success: false, error: "Invalid finalize payload" }, 400);
        }
        const groups = body.groups as Record<string, GroupManifestEntry>;
        const validEntries = Object.entries(groups).every(([group, entry]) => group.trim() && entry &&
          typeof entry.version === "string" && typeof entry.updatedAt === "string" &&
          typeof entry.fingerprint === "string" && typeof entry.recordCount === "number");
        if (!validEntries) return c.json({ success: false, error: "Invalid group manifest" }, 400);
        const manifest = await finalizeCourse(c.env.SCHEDULE_KV, course, body.importId, groups);
        return c.json({ success: true, imported: manifest.recordCount, version: manifest.current, groups: manifest.groupCount, message: `Расписание для курса ${course} обновлено` });
      }

      if (!Array.isArray(body.classes)) return c.json({ success: false, error: "Invalid payload" }, 400);
      const classes = body.classes as ScheduleRecord[];
      if (classes.some((item) => !item || item.course !== course || typeof item.groupName !== "string" || !item.groupName.trim())) {
        return c.json({ success: false, error: "Invalid schedule record" }, 400);
      }
      const manifest = await publishCourse(c.env.SCHEDULE_KV, course, classes);
      return c.json({ success: true, imported: classes.length, version: manifest.current, groups: manifest.groupCount, message: `Расписание для курса ${course} обновлено` });
    } catch (error) {
      console.error("KV schedule import failed", error);
      return c.json({ success: false, error: "Internal server error" }, 500);
    }
  });
}
