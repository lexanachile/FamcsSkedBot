import { Hono } from "hono";
import { cors } from "hono/cors";

// Типизация переменных окружения (Environment Bindings)
type Bindings = {
  DB: D1Database;
  AUTH_TOKEN: string;
};

// Создаём новое приложение Hono со строгой типизацией
const app = new Hono<{ Bindings: Bindings }>();

// Время жизни кэша в секундах (5 минут = 300 секунд)
const CACHE_TTL = 300;

/**
 * Вспомогательная функция для преобразования дня недели
 */
function getDayOfWeekName(dayOfWeekNum: number): string {
  const days: { [key: number]: string } = {
    1: "Понедельник",
    2: "Вторник",
    3: "Среда",
    4: "Четверг",
    5: "Пятница",
    6: "Суббота",
  };
  return days[dayOfWeekNum] || "Неизвестно";
}

/**
 * Вспомогательная функция для извлечения фамилии из полной строки преподавателя.
 */
function extractLastName(fullName: string): string {
  if (!fullName) return "";
  const trimmed = fullName.trim();

  const match = trimmed.match(/\s+([А-ЯЁA-Z])\.\s*([А-ЯЁA-Z])\./u);

  if (match && match.index !== undefined) {
    const before = trimmed.substring(0, match.index);
    const words = before.split(/\s+/).filter(w => w.length > 0);
    if (words.length > 0) {
      return words[words.length - 1];
    }
  }

  return trimmed;
}

// Массив временных интервалов для пар (по номеру пары)
const TIME_SLOTS: { start: string; end: string }[] = [
  { start: "8:15", end: "9:40" },    // 1
  { start: "9:50", end: "11:15" },   // 2
  { start: "11:25", end: "12:50" },  // 3
  { start: "13:15", end: "14:40" },  // 4
  { start: "14:50", end: "16:15" },  // 5
  { start: "16:25", end: "17:50" },  // 6
  { start: "18:10", end: "19:35" },  // 7
  { start: "19:45", end: "21:10" },  // 8
];

/**
 * Работа с кэшем
 */
async function getCached(key: string): Promise<Response | null> {
  // ИСПРАВЛЕНО: Обернуто в try/catch для предотвращения падений в dev-окружении
  // ИСПРАВЛЕНО: Клонирование ответа, чтобы Hono мог мутировать заголовки CORS (избегаем ошибки 500)
  try {
    const cache = caches.default;
    const request = new Request(key);
    const cached = await cache.match(request);
    return cached ? new Response(cached.body, cached) : null;
  } catch (e) {
    console.warn("Cache API Error (Match):", e);
    return null;
  }
}

async function setCached(key: string, data: any, ttl: number): Promise<void> {
  // ИСПРАВЛЕНО: Обернуто в try/catch для предотвращения падений в dev-окружении
  try {
    const cache = caches.default;
    const response = new Response(JSON.stringify(data), {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": `public, max-age=${ttl}`,
      },
    });
    await cache.put(new Request(key), response);
  } catch (e) {
    console.warn("Cache API Error (Put):", e);
  }
}

/**
 * Middleware для обработки CORS
 */
app.use(
  "*",
  cors({
    origin: "*",
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
    maxAge: 600,
  })
);

/**
 * Middleware для логирования входящих запросов
 */
app.use("*", async (c, next) => {
  console.log(`📥 ${c.req.method} ${c.req.path}`);
  await next();
});


// ===== МАРШРУТЫ API =====

/**
 * GET /api/health
 */
const handleHealth = (c: any) => {
  return c.json(
    {
      status: "ok",
      timestamp: new Date().toISOString(),
      message: "Backend сервер работает корректно",
    },
    200
  );
};

app.get("/api/health", handleHealth);
app.get("/api/healt", handleHealth); // алиас для опечатки

/**
 * GET /api/schedule
 */
app.get("/api/schedule", async (c) => {
  try {
    const course = c.req.query("course");
    const group = c.req.query("group");

    if (!course || !group) {
      return c.json({ success: false, error: "Missing required parameters" }, 400);
    }

    const courseNum = parseInt(course, 10);
    if (isNaN(courseNum) || courseNum < 1 || courseNum > 5) {
      return c.json({ success: false, error: "Invalid course value" }, 400);
    }

    const db = c.env.DB;
    if (!db) {
      return c.json({ success: false, error: "Database connection error" }, 500);
    }

    const cacheKey = c.req.url;
    const cachedResponse = await getCached(cacheKey);
    if (cachedResponse) {
      return cachedResponse;
    }

    const result = await db
      .prepare(
        `SELECT * FROM schedule WHERE course = ? AND groupName = ? ORDER BY dayOfWeek, startTime`
      )
      .bind(courseNum, group)
      .all();

    let responseData: any;

    if (!result.results || result.results.length === 0) {
      responseData = {
        success: true,
        data: { course: courseNum, group, classes: [], message: "Расписание не найдено" },
      };
    } else {
      const formattedClasses = result.results.map((record: any) => {
        const isCommon = record.isCommon === 1;
        const comments = record.comments || null;

        return {
          classId: record.classId,
          groupName: record.groupName,
          course: record.course,
          dayOfWeek: record.dayOfWeek,
          dayOfWeekName: getDayOfWeekName(record.dayOfWeek),
          startTime: record.startTime,
          endTime: record.endTime,
          isCommon: isCommon,
          isLecture: record.isLecture === 1,
          subgroupA: {
            classTitle: record.classTitleA,
            professorName: record.professorNameA,
            classroom: record.classroomA,
            comments: comments,
          },
          subgroupB: isCommon ? null : {
            classTitle: record.classTitleB,
            professorName: record.professorNameB,
            classroom: record.classroomB,
            comments: comments,
          },
        };
      });

      responseData = {
        success: true,
        data: { course: courseNum, group, totalClasses: formattedClasses.length, classes: formattedClasses, updatedAt: new Date().toISOString() },
      };
    }

    await setCached(cacheKey, responseData, CACHE_TTL);
    return c.json(responseData, 200);
  } catch (error) {
    console.error(error);
    return c.json({ success: false, error: "Internal server error" }, 500);
  }
});

/**
 * GET /api/groups
 */
app.get("/api/groups", async (c) => {
  try {
    const course = c.req.query("course");
    if (!course) return c.json({ success: false, error: "Missing parameter: course" }, 400);

    const courseNum = parseInt(course, 10);
    const db = c.env.DB;

    const cacheKey = c.req.url;
    const cachedResponse = await getCached(cacheKey);
    if (cachedResponse) return cachedResponse;

    const result = await db.prepare(`SELECT DISTINCT groupName FROM schedule WHERE course = ? ORDER BY groupName`).bind(courseNum).all();

    const responseData = {
      success: true,
      data: { course: courseNum, groups: (result.results || []).map((row: any) => ({ groupName: row.groupName })) },
    };

    await setCached(cacheKey, responseData, CACHE_TTL);
    return c.json(responseData, 200);
  } catch (error) {
    return c.json({ success: false, error: "Internal server error" }, 500);
  }
});

/**
 * GET /api/teachers
 */
app.get("/api/teachers", async (c) => {
  try {
    const db = c.env.DB;
    const cacheKey = c.req.url;
    const cachedResponse = await getCached(cacheKey);
    if (cachedResponse) return cachedResponse;

    const result = await db.prepare(`
      SELECT DISTINCT professorNameA AS name FROM schedule WHERE professorNameA IS NOT NULL AND TRIM(professorNameA) != ''
      UNION
      SELECT DISTINCT professorNameB AS name FROM schedule WHERE professorNameB IS NOT NULL AND TRIM(professorNameB) != ''
    `).all();

    const fullNames = (result.results || []).map((row: any) => row.name as string);
    const lastNameSet = new Set<string>();

    for (const fullName of fullNames) {
      const lastName = extractLastName(fullName);
      if (lastName) lastNameSet.add(lastName);
    }

    const teachers = Array.from(lastNameSet).sort((a, b) => a.localeCompare(b, "ru"));

    const responseData = { success: true, data: { teachers } };
    await setCached(cacheKey, responseData, CACHE_TTL);
    return c.json(responseData, 200);
  } catch (error) {
    return c.json({ success: false, error: "Internal server error" }, 500);
  }
});

/**
 * GET /api/teacher
 */
app.get("/api/teacher", async (c) => {
  try {
    const name = c.req.query("name");
    if (!name || name.trim().length === 0) return c.json({ success: false, error: "Missing parameter: name" }, 400);

    const db = c.env.DB;
    const cacheKey = c.req.url;
    const cachedResponse = await getCached(cacheKey);
    if (cachedResponse) return cachedResponse;

    const searchPattern = `%${name.trim()}%`;
    const result = await db.prepare(`
      SELECT * FROM schedule 
      WHERE professorNameA LIKE ? OR professorNameB LIKE ? 
      ORDER BY dayOfWeek, startTime
    `).bind(searchPattern, searchPattern).all();

    const formatted = (result.results || []).map((record: any) => ({
      classId: record.classId,
      groupName: record.groupName,
      course: record.course,
      dayOfWeek: record.dayOfWeek,
      dayOfWeekName: getDayOfWeekName(record.dayOfWeek),
      startTime: record.startTime,
      endTime: record.endTime,
      isCommon: record.isCommon === 1,
      isLecture: record.isLecture === 1,
      classTitleA: record.classTitleA,
      professorNameA: record.professorNameA,
      classroomA: record.classroomA,
      classTitleB: record.classTitleB,
      professorNameB: record.professorNameB,
      classroomB: record.classroomB,
      comments: record.comments,
    }));

    const responseData = { success: true, data: { teacher: name.trim(), classes: formatted } };
    await setCached(cacheKey, responseData, CACHE_TTL);
    return c.json(responseData, 200);
  } catch (error) {
    return c.json({ success: false, error: "Internal server error" }, 500);
  }
});

/**
 * GET /api/rooms/free
 * ОПТИМИЗИРОВАНО: Использован 1 SQL запрос с CTE вместо N запросов в цикле
 */
app.get("/api/rooms/free", async (c) => {
  try {
    const dayOfWeek = c.req.query("dayOfWeek");
    const pairNumber = c.req.query("pairNumber");

    if (!dayOfWeek || !pairNumber) return c.json({ success: false, error: "Missing required parameters" }, 400);

    const dayNum = parseInt(dayOfWeek, 10);
    const pairNum = parseInt(pairNumber, 10);
    const slot = TIME_SLOTS[pairNum - 1];

    if (!slot) return c.json({ success: false, error: "Invalid pairNumber" }, 400);

    const db = c.env.DB;
    const cacheKey = c.req.url;
    const cachedResponse = await getCached(cacheKey);
    if (cachedResponse) return cachedResponse;

    // Один мощный SQL-запрос вместо цикла for
    const query = `
      WITH AllRooms AS (
        SELECT DISTINCT classroomA AS room FROM schedule WHERE classroomA IS NOT NULL AND TRIM(classroomA) != ''
        UNION
        SELECT DISTINCT classroomB AS room FROM schedule WHERE classroomB IS NOT NULL AND TRIM(classroomB) != ''
      ),
      BusyRooms AS (
        SELECT DISTINCT classroomA AS room FROM schedule 
        WHERE dayOfWeek = ? AND startTime = ? AND endTime = ? AND classroomA IS NOT NULL AND TRIM(classroomA) != ''
        UNION
        SELECT DISTINCT classroomB AS room FROM schedule 
        WHERE dayOfWeek = ? AND startTime = ? AND endTime = ? AND classroomB IS NOT NULL AND TRIM(classroomB) != ''
      )
      SELECT 
        a.room, 
        CASE WHEN b.room IS NOT NULL THEN 1 ELSE 0 END as isBusy
      FROM AllRooms a
      LEFT JOIN BusyRooms b ON a.room = b.room
      ORDER BY a.room;
    `;

    const result = await db
      .prepare(query)
      .bind(dayNum, slot.start, slot.end, dayNum, slot.start, slot.end)
      .all();

    const freeRooms: string[] = [];
    const busyRooms: string[] = [];

    (result.results || []).forEach((row: any) => {
      if (row.isBusy === 1) busyRooms.push(row.room);
      else freeRooms.push(row.room);
    });

    const responseData = {
      success: true,
      data: {
        dayOfWeek: dayNum,
        pairNumber: pairNum,
        startTime: slot.start,
        endTime: slot.end,
        freeRooms,
        busyRooms,
        totalRooms: freeRooms.length + busyRooms.length,
      },
    };

    await setCached(cacheKey, responseData, CACHE_TTL);
    return c.json(responseData, 200);
  } catch (error) {
    console.error(error);
    return c.json({ success: false, error: "Internal server error" }, 500);
  }
});

/**
 * POST /api/schedule/import
 */
app.post("/api/schedule/import", async (c) => {
  try {
    const authHeader = c.req.header("Authorization");
    const expectedToken = c.env.AUTH_TOKEN;

    if (!expectedToken || authHeader !== `Bearer ${expectedToken}`) {
      return c.json({ success: false, error: "Unauthorized" }, 401);
    }

    const body = await c.req.json();
    const { course, classes, clear } = body;

    if (!course || !Array.isArray(classes)) {
      return c.json({ success: false, error: "Invalid payload" }, 400);
    }

    const db = c.env.DB;

    if (clear === true) {
      await db.prepare("DELETE FROM schedule WHERE course = ?").bind(course).run();
    }

    const insertStmt = db.prepare(`
      INSERT INTO schedule (
        groupName, course, dayOfWeek, startTime, endTime, isCommon, isLecture,
        classTitleA, professorNameA, classroomA, classTitleB, professorNameB, classroomB, comments
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const batchSize = 50;
    let importedCount = 0;

    for (let i = 0; i < classes.length; i += batchSize) {
      const chunk = classes.slice(i, i + batchSize);
      const statements = chunk.map((item: any) =>
        insertStmt.bind(
          item.groupName, item.course, item.dayOfWeek, item.startTime, item.endTime,
          item.isCommon ? 1 : 0,  // ИСПРАВЛЕНО: приводим boolean к integer для SQLite
          item.isLecture ? 1 : 0, // ИСПРАВЛЕНО: приводим boolean к integer для SQLite
          item.classTitleA ?? null, item.professorNameA ?? null, item.classroomA ?? null,
          item.classTitleB ?? null, item.professorNameB ?? null, item.classroomB ?? null,
          item.comments ?? null
        )
      );

      await db.batch(statements);
      importedCount += statements.length;
    }

    // ИСПРАВЛЕНО: Правильная, точечная очистка кэша по точным URL с параметрами
    try {
      const cache = caches.default;
      const origin = new URL(c.req.url).origin;
      const deletePromises: Promise<boolean>[] = [];

      // 1. Собираем уникальные группы из присланного JSON
      const uniqueGroups = new Set<string>();
      classes.forEach((item: any) => {
        if (item.groupName) uniqueGroups.add(item.groupName);
      });

      // 2. Очищаем общие списки
      deletePromises.push(cache.delete(new Request(`${origin}/api/groups?course=${course}`)));
      deletePromises.push(cache.delete(new Request(`${origin}/api/teachers`)));

      // 3. Очищаем каждую группу
      uniqueGroups.forEach(groupName => {
        const encodedGroup = encodeURIComponent(groupName);
        deletePromises.push(
          cache.delete(new Request(`${origin}/api/schedule?course=${course}&group=${encodedGroup}`))
        );
      });

      await Promise.allSettled(deletePromises);
    } catch (cacheError) {
      console.warn("Cache deletion error during import:", cacheError);
    }

    return c.json({ success: true, imported: importedCount, message: `Расписание для курса ${course} обновлено` }, 200);
  } catch (error) {
    console.error(error);
    return c.json({ success: false, error: "Internal server error" }, 500);
  }
});

/**
 * 404 Handler
 */
app.all("*", (c) => {
  return c.json({ success: false, error: "Not Found", message: `Маршрут ${c.req.path} не существует` }, 404);
});

export default app;