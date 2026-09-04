import { buildKeyboard, courseKeyboard, groupsKeyboard, helpText, onboardingKeyboard, settingsKeyboard } from "./content.js";
import { telegramRequest } from "./telegram.js";
import { getUser, setGroup, skipGroup, toggleNotifications, upsertUser } from "./users.js";

const botNameFor = (env) => env.BOT_NAME?.trim() || "ScheduleBot";

async function configError(chatId, env, message) {
  console.error(message);
  try { await telegramRequest(env.TELEGRAM_BOT_TOKEN, "sendMessage", { chat_id: chatId, text: `❌ Ошибка конфигурации: ${message}` }); }
  catch (error) { console.error("Failed to send error message", error); }
}

export async function handleMessage(message, env) {
  const chatId = message.chat?.id;
  const text = (message.text || "").trim();
  if (!chatId) return console.error("No chatId in message", message);
  await upsertUser(env.DB, message.from, chatId);
  const user = await getUser(env.DB, message.from.id);
  const botName = botNameFor(env);
  const miniAppUrl = env.MINI_APP_URL?.trim();
  if (!miniAppUrl) return configError(chatId, env, "MINI_APP_URL не установлен в Cloudflare");
  if (!miniAppUrl.startsWith("https://")) return configError(chatId, env, "URL должен начинаться с https://");
  try {
    if (text.startsWith("/start")) {
      await telegramRequest(env.TELEGRAM_BOT_TOKEN, "sendMessage", { chat_id: chatId, text: `Вы попали в ${botName}!\n\nЖмите кнопку ниже для открытия расписания\nФидбеку буду рад в лс @lexanachile`, reply_markup: buildKeyboard(miniAppUrl, user) });
      if (!user?.group_name) await telegramRequest(env.TELEGRAM_BOT_TOKEN, "sendMessage", { chat_id: chatId, text: "Хотите получать уведомления об изменениях расписания? Выберите свою группу или пропустите этот шаг.", reply_markup: onboardingKeyboard });
    }
    else if (text.startsWith("/help")) await telegramRequest(env.TELEGRAM_BOT_TOKEN, "sendMessage", { chat_id: chatId, text: helpText(botName), parse_mode: "Markdown" });
    else if (text.startsWith("/id")) await telegramRequest(env.TELEGRAM_BOT_TOKEN, "sendMessage", { chat_id: chatId, text: `Ваш Telegram ID: ${message.from.id}` });
    else if (text.startsWith("/settings")) await showSettings(chatId, user, env);
    else await telegramRequest(env.TELEGRAM_BOT_TOKEN, "sendMessage", { chat_id: chatId, text: "Неизвестная команда\n\nНажмите на кнопку ниже, чтобы открыть расписание, или используйте /help для справки", reply_markup: buildKeyboard(miniAppUrl, user) });
  } catch (error) { console.error("Error handling message:", error); throw error; }
}

async function showSettings(chatId, user, env) {
  const state = user?.group_name
    ? `Текущая группа: ${user.group_name} (${user.course} курс)\nУведомления: ${user.notifications_enabled ? "включены" : "отключены"}`
    : "Группа пока не выбрана.";
  await telegramRequest(env.TELEGRAM_BOT_TOKEN, "sendMessage", { chat_id: chatId, text: state, reply_markup: settingsKeyboard(user) });
}

async function loadGroups(env, course) {
  if (!Number.isInteger(course) || course < 1 || course > 5) {
    throw new Error(`Invalid course: ${course}`);
  }
  const configuredUrl = env.API_BASE_URL?.trim();
  if (!env.SCHEDULE_API && !configuredUrl) {
    throw new Error("Neither SCHEDULE_API nor API_BASE_URL is configured");
  }
  // A service binding only uses the path/query from this URL. Keep a valid
  // synthetic origin so the bot can work even without the public fallback.
  const apiBaseUrl = configuredUrl
    ? configuredUrl.replace(/\/+$/, "").replace(/\/api$/, "")
    : "https://schedule-api";
  const groupsUrl = `${apiBaseUrl}/api/groups?course=${course}`;
  const request = new Request(groupsUrl, {
    headers: { Accept: "application/json" },
  });
  let response;
  try {
    response = env.SCHEDULE_API
      ? await env.SCHEDULE_API.fetch(request)
      : await fetch(request);
  } catch (error) {
    const transport = env.SCHEDULE_API ? "service binding" : "public URL";
    throw new Error(`Groups API request failed via ${transport}: ${error.message}`, { cause: error });
  }
  if (!response.ok) {
    const details = (await response.text()).slice(0, 300);
    throw new Error(`Groups API error ${response.status}: ${groupsUrl}; ${details}`);
  }
  const payload = await response.json().catch((error) => {
    throw new Error(`Groups API returned invalid JSON: ${error.message}`);
  });
  if (!payload?.success || !Array.isArray(payload?.data?.groups)) {
    throw new Error(`Groups API returned an invalid payload: ${JSON.stringify(payload).slice(0, 300)}`);
  }
  return payload.data.groups
    .map((item) => item?.groupName)
    .filter((groupName) => typeof groupName === "string" && groupName.length > 0);
}

export async function handleCallbackQuery(query, env) {
  const chatId = query.message?.chat?.id || query.from?.id;
  if (!chatId || !query.id) return console.error("No chatId or query.id in callback", query);
  // Stop Telegram's loading spinner immediately. D1/API work and sending the
  // resulting message may take noticeably longer on a cold Worker instance.
  await telegramRequest(env.TELEGRAM_BOT_TOKEN, "answerCallbackQuery", {
    callback_query_id: query.id,
    show_alert: false,
  }).catch((error) => console.warn("Callback acknowledgement skipped", error));
  try {
    await upsertUser(env.DB, query.from, chatId);
    if (query.data === "help") {
      await telegramRequest(env.TELEGRAM_BOT_TOKEN, "sendMessage", { chat_id: chatId, text: helpText(botNameFor(env)), parse_mode: "Markdown" });
    } else if (query.data === "settings") {
      await showSettings(chatId, await getUser(env.DB, query.from.id), env);
    } else if (query.data === "choose_course") {
      await telegramRequest(env.TELEGRAM_BOT_TOKEN, "sendMessage", { chat_id: chatId, text: "Выберите курс:", reply_markup: courseKeyboard });
    } else if (query.data?.startsWith("course:")) {
      const course = Number(query.data.split(":")[1]);
      const groups = await loadGroups(env, course);
      await telegramRequest(env.TELEGRAM_BOT_TOKEN, "sendMessage", { chat_id: chatId, text: groups.length ? "Выберите группу:" : "Для этого курса группы пока не найдены.", reply_markup: groups.length ? groupsKeyboard(groups, course) : undefined });
    } else if (query.data?.startsWith("group:")) {
      const [, courseText, ...parts] = query.data.split(":");
      const course = Number(courseText);
      const group = parts.join(":");
      const groups = await loadGroups(env, course);
      if (!groups.includes(group)) throw new Error("Selected group is no longer available");
      await setGroup(env.DB, query.from.id, course, group);
      await telegramRequest(env.TELEGRAM_BOT_TOKEN, "sendMessage", { chat_id: chatId, text: `Группа ${group} сохранена. Тестовые уведомления включены.` });
    } else if (query.data === "skip_group") {
      await skipGroup(env.DB, query.from.id);
      await telegramRequest(env.TELEGRAM_BOT_TOKEN, "sendMessage", { chat_id: chatId, text: "Группа удалена. Вы сможете настроить её позже через /settings." });
    } else if (query.data === "toggle_notifications") {
      const user = await toggleNotifications(env.DB, query.from.id);
      await telegramRequest(env.TELEGRAM_BOT_TOKEN, "sendMessage", { chat_id: chatId, text: `Уведомления ${user?.notifications_enabled ? "включены" : "отключены"}.` });
    } else {
      await telegramRequest(env.TELEGRAM_BOT_TOKEN, "sendMessage", { chat_id: chatId, text: "Эта кнопка устарела. Откройте /settings ещё раз." });
    }
  } catch (error) {
    console.error("Error handling callback query:", error);
    await telegramRequest(env.TELEGRAM_BOT_TOKEN, "sendMessage", { chat_id: chatId, text: "Не удалось выполнить действие. Попробуйте ещё раз." }).catch(() => {});
  }
}
