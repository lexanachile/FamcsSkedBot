import { createHash, randomUUID } from "node:crypto";

const options = Object.fromEntries(
  process.argv.slice(2).map((argument) => {
    const [name, ...valueParts] = argument.replace(/^--/, "").split("=");
    return [name, valueParts.join("=")];
  }),
);

const course = Number(options.course || 3);
const group = options.group || "6";
const startTime = options.start || "18.10";
const endTime = options.end || "19.35";
const testDay = 6;
const testTitle = "ТЕСТ УДАЛЕНИЯ";
const backendUrl = (process.env.BACKEND_URL || "https://famcsschedulebot.yarashsei.workers.dev")
  .replace(/\/+$/, "");
const authToken = process.env.BACKEND_AUTH_TOKEN;

if (!Number.isInteger(course) || course < 1 || course > 5) {
  throw new Error("--course must be an integer from 1 to 5");
}
if (!authToken) {
  throw new Error("Set BACKEND_AUTH_TOKEN in the environment before running this script");
}

async function importSchedule(payload) {
  const response = await fetch(`${backendUrl}/api/schedule/import`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${authToken}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify(payload),
  });
  const text = await response.text();
  let result;
  try {
    result = JSON.parse(text);
  } catch {
    throw new Error(`Backend returned invalid JSON (${response.status}): ${text}`);
  }
  if (!response.ok || result.success === false) {
    throw new Error(`Backend rejected the request (${response.status}): ${result.error || text}`);
  }
  return result;
}

console.log(`Loading course ${course} manifest and group ${group} schedule...`);

const [state, groupState] = await Promise.all([
  importSchedule({ mode: "state", course }),
  importSchedule({ mode: "group-state", course, group }),
]);

const oldEntry = state.data?.groups?.[group];
if (!oldEntry) {
  throw new Error(`Group ${group} is absent from the course ${course} manifest`);
}

const records = Array.isArray(groupState.data?.records) ? groupState.data.records : [];
const testAlreadyExists = records.some(
  (record) => record.classTitleA === testTitle || record.classTitleB === testTitle,
);
if (testAlreadyExists) {
  throw new Error(`The test lesson already exists in group ${group}. Run the parser to remove it first`);
}

const slotIsOccupied = records.some(
  (record) => record.dayOfWeek === testDay &&
    record.startTime === startTime && record.endTime === endTime,
);
if (slotIsOccupied) {
  throw new Error(
    `Saturday slot ${startTime}-${endTime} is already occupied. ` +
    "Choose another slot with --start=HH.MM and --end=HH.MM",
  );
}

const testLesson = {
  groupName: group,
  course,
  dayOfWeek: testDay,
  startTime,
  endTime,
  isCommon: true,
  isLecture: false,
  classTitleA: testTitle,
  professorNameA: "Тестовый преподаватель",
  classroomA: "999",
  classTitleB: null,
  professorNameB: null,
  classroomB: null,
  comments: null,
};

const newRecords = [...records, testLesson];
const fingerprint = createHash("sha256")
  .update(JSON.stringify(newRecords), "utf8")
  .digest("hex");

const upload = await importSchedule({
  mode: "group",
  course,
  group,
  classes: newRecords,
  fingerprint,
  previousVersion: oldEntry.version,
});

const nextGroups = {
  ...state.data.groups,
  [group]: upload.data.entry,
};

// No notifications are included here: only the subsequent parser removal
// should produce a Telegram notification.
const result = await importSchedule({
  mode: "finalize",
  course,
  importId: randomUUID(),
  groups: nextGroups,
});

console.log(`Added "${testTitle}" to group ${group} on Saturday, ${startTime}-${endTime}.`);
console.log(`Published course version: ${result.version}`);
console.log("Now run the regular parser. It should remove this lesson and enqueue a notification.");
