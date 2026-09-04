import { buildKeyboard, helpText } from "./content.js";
import { telegramRequest } from "./telegram.js";

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
  const botName = botNameFor(env);
  const miniAppUrl = env.MINI_APP_URL?.trim();
  if (!miniAppUrl) return configError(chatId, env, "MINI_APP_URL не установлен в Cloudflare");
  if (!miniAppUrl.startsWith("https://")) return configError(chatId, env, "URL должен начинаться с https://");
  try {
    if (text.startsWith("/start")) await telegramRequest(env.TELEGRAM_BOT_TOKEN, "sendMessage", { chat_id: chatId, text: `Вы попали в ${botName}!\n\nЖмите кнопку ниже для открытия расписания\nФидбеку буду рад в лс @lexanachile`, reply_markup: buildKeyboard(miniAppUrl) });
    else if (text.startsWith("/help")) await telegramRequest(env.TELEGRAM_BOT_TOKEN, "sendMessage", { chat_id: chatId, text: helpText(botName), parse_mode: "Markdown" });
    else await telegramRequest(env.TELEGRAM_BOT_TOKEN, "sendMessage", { chat_id: chatId, text: "Неизвестная команда\n\nНажмите на кнопку ниже, чтобы открыть расписание, или используйте /help для справки", reply_markup: buildKeyboard(miniAppUrl) });
  } catch (error) { console.error("Error handling message:", error); }
}

export async function handleCallbackQuery(query, env) {
  const chatId = query.message?.chat?.id || query.from?.id;
  if (!chatId || !query.id) return console.error("No chatId or query.id in callback", query);
  try {
    if (query.data === "help") {
      await telegramRequest(env.TELEGRAM_BOT_TOKEN, "sendMessage", { chat_id: chatId, text: helpText(botNameFor(env)), parse_mode: "Markdown" });
      await telegramRequest(env.TELEGRAM_BOT_TOKEN, "answerCallbackQuery", { callback_query_id: query.id, text: "Справка открыта", show_alert: false });
    }
  } catch (error) { console.error("Error handling callback query:", error); }
}
