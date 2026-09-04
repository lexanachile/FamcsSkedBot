import type { CourseManifest, GroupManifestEntry, GroupScheduleDocument, ScheduleRecord } from "../types";
import { bundleKey, groupKey, groupsKey, manifestKey } from "./keys";
import { normalizeRecord } from "./records";

const CACHE_TTL_SECONDS = 60;

async function readJson<T>(kv: KVNamespace, key: string): Promise<T | null> {
  return kv.get<T>(key, { type: "json", cacheTtl: CACHE_TTL_SECONDS });
}

async function readVersioned<T>(kv: KVNamespace, course: number, keyFor: (version: string) => string): Promise<T | null> {
  const manifest = await readJson<CourseManifest>(kv, manifestKey(course));
  if (!manifest) return null;
  const current = await readJson<T>(kv, keyFor(manifest.current));
  if (current !== null || !manifest.previous) return current;
  return readJson<T>(kv, keyFor(manifest.previous));
}

export const readGroups = async (kv: KVNamespace, course: number) => {
  const manifest = await readJson<CourseManifest>(kv, manifestKey(course));
  if (!manifest) return null;
  if (manifest.groups) return Object.keys(manifest.groups).sort((a, b) => a.localeCompare(b, "ru", { numeric: true }));
  return readVersioned<string[]>(kv, course, (version) => groupsKey(version, course));
};

export async function readGroup(kv: KVNamespace, course: number, group: string): Promise<ScheduleRecord[] | null> {
  const manifest = await readJson<CourseManifest>(kv, manifestKey(course));
  if (!manifest) return null;
  const entry = manifest.groups?.[group];
  if (entry) {
    const document = await readJson<GroupScheduleDocument>(kv, groupKey(entry.version, course, group));
    if (document) return document.records;
    if (!entry.previousVersion) return null;
    return (await readJson<GroupScheduleDocument>(kv, groupKey(entry.previousVersion, course, group)))?.records || null;
  }
  const current = await readJson<ScheduleRecord[]>(kv, groupKey(manifest.current, course, group));
  if (current !== null) return current;

  // A missing group can mean either that it was removed or that a new KV key
  // has not propagated to this edge yet. The immutable course bundle lets us
  // distinguish those cases without returning a removed group from old data.
  const bundle = await readJson<ScheduleRecord[]>(kv, bundleKey(manifest.current, course));
  if (bundle !== null) return bundle.filter((record) => record.groupName === group);
  if (!manifest.previous) return null;
  return readJson<ScheduleRecord[]>(kv, groupKey(manifest.previous, course, group));
}

export const readCourse = (kv: KVNamespace, course: number) =>
  readJson<CourseManifest>(kv, manifestKey(course)).then(async (manifest) => {
    if (!manifest) return null;
    if (!manifest.groups) return readVersioned<ScheduleRecord[]>(kv, course, (version) => bundleKey(version, course));
    const documents = await Promise.all(
      Object.entries(manifest.groups).map(async ([group, entry]) => {
        const current = await readJson<GroupScheduleDocument>(kv, groupKey(entry.version, course, group));
        if (current) return current.records;
        if (!entry.previousVersion) return [];
        return (await readJson<GroupScheduleDocument>(kv, groupKey(entry.previousVersion, course, group)))?.records || [];
      }),
    );
    return documents.flat();
  });

export async function readAllCourses(kv: KVNamespace): Promise<ScheduleRecord[]> {
  const courses = await Promise.all([1, 2, 3, 4, 5].map((course) => readCourse(kv, course)));
  return courses.flatMap((records) => records || []);
}

export async function publishCourse(kv: KVNamespace, course: number, input: ScheduleRecord[]) {
  const records = input.map(normalizeRecord).sort((a, b) =>
    a.groupName.localeCompare(b.groupName, "ru", { numeric: true }) ||
    a.dayOfWeek - b.dayOfWeek || String(a.startTime).localeCompare(String(b.startTime)),
  );
  const byGroup = new Map<string, ScheduleRecord[]>();
  for (const record of records) {
    const groupRecords = byGroup.get(record.groupName) || [];
    groupRecords.push(record);
    byGroup.set(record.groupName, groupRecords);
  }
  const groups = [...byGroup.keys()].sort((a, b) => a.localeCompare(b, "ru", { numeric: true }));
  const oldManifest = await readJson<CourseManifest>(kv, manifestKey(course));
  const version = `${Date.now()}-${crypto.randomUUID()}`;

  await Promise.all([
    kv.put(bundleKey(version, course), JSON.stringify(records)),
    kv.put(groupsKey(version, course), JSON.stringify(groups)),
    ...groups.map((group) => kv.put(groupKey(version, course, group), JSON.stringify(byGroup.get(group)))),
  ]);

  const manifest: CourseManifest = {
    current: version,
    previous: oldManifest?.current || null,
    course,
    updatedAt: new Date().toISOString(),
    recordCount: records.length,
    groupCount: groups.length,
  };
  await kv.put(manifestKey(course), JSON.stringify(manifest));
  return manifest;
}

export const readManifest = (kv: KVNamespace, course: number) =>
  readJson<CourseManifest>(kv, manifestKey(course));

// Import requests must not use the edge cache: two parser runs may happen less
// than a minute apart, and comparing against a stale manifest would rewrite
// groups whose content has not changed.
export const readManifestFresh = (kv: KVNamespace, course: number) =>
  kv.get<CourseManifest>(manifestKey(course), { type: "json" });

export async function readGroupDocument(kv: KVNamespace, course: number, group: string) {
  const manifest = await readJson<CourseManifest>(kv, manifestKey(course));
  const entry = manifest?.groups?.[group];
  if (!entry) return null;
  const current = await readJson<GroupScheduleDocument>(kv, groupKey(entry.version, course, group));
  if (current) return current;
  if (!entry.previousVersion) return null;
  return readJson<GroupScheduleDocument>(kv, groupKey(entry.previousVersion, course, group));
}

export async function uploadGroup(
  kv: KVNamespace,
  course: number,
  group: string,
  input: ScheduleRecord[],
  fingerprint: string,
  previousVersion: string | null,
): Promise<GroupManifestEntry> {
  const records = input.map(normalizeRecord).sort((a, b) =>
    a.dayOfWeek - b.dayOfWeek || String(a.startTime).localeCompare(String(b.startTime)) ||
    String(a.endTime).localeCompare(String(b.endTime)),
  );
  const version = `${Date.now()}-${crypto.randomUUID()}`;
  const updatedAt = new Date().toISOString();
  const document: GroupScheduleDocument = { group, course, updatedAt, fingerprint, records };
  await kv.put(groupKey(version, course, group), JSON.stringify(document));
  return { version, previousVersion, updatedAt, fingerprint, recordCount: records.length };
}

export async function finalizeCourse(
  kv: KVNamespace,
  course: number,
  current: string,
  groups: Record<string, GroupManifestEntry>,
) {
  const oldManifest = await readManifestFresh(kv, course);
  const entries = Object.values(groups);
  const manifest: CourseManifest = {
    schemaVersion: 2,
    current,
    previous: oldManifest?.current || null,
    course,
    updatedAt: entries.reduce((latest, entry) => entry.updatedAt > latest ? entry.updatedAt : latest, ""),
    recordCount: entries.reduce((total, entry) => total + entry.recordCount, 0),
    groupCount: entries.length,
    groups,
  };
  await kv.put(manifestKey(course), JSON.stringify(manifest));
  return manifest;
}
