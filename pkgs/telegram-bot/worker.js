const TELEGRAM_METHOD = (token, method) =>
  `https://api.telegram.org/bot${token}/${method}`;

// ИСПРАВЛЕНО: аргумент функции BOT_NAME заменен на botName, чтобы не возникала ошибка ReferenceError
const HELP_TEXT = (botName) => `*Справка по ${botName}*

Доступные команды:
/start - Главное меню с кнопкой для открытия расписания
/help - Справка

Как использовать:
1. Нажмите кнопку "Открыть расписание"
2. Выберите необходимый курс и группу
3. Нажмите на нужный день
4. Получите расписаниe

Фидбеку по боту буду очень рад в лс @lexanachile
`;

const buildKeyboard = (miniAppUrl) => ({
  inline_keyboard: [
    [
      {
        text: "Открыть расписание",
        web_app: { url: miniAppUrl },
      },
    ],
    [
      {
        text: "/help",
        callback_data: "help",
      },
    ],
  ],
});

async function telegramRequest(token, method, body) {
  const response = await fetch(TELEGRAM_METHOD(token, method), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    console.error("Telegram API error:", response.status, text);
    throw new Error(`Telegram API error ${response.status}`);
  }

  return response.json();
}

async function handleMessage(message, env) {
  const chatId = message.chat?.id;
  const text = (message.text || "").trim();
  if (!chatId) {
    console.error("No chatId in message", message);
    return;
  }

  const botName = env.BOT_NAME ? env.BOT_NAME.trim() : "ScheduleBot";
  const miniAppUrl = env.MINI_APP_URL ? env.MINI_APP_URL.trim() : null;

  if (!miniAppUrl) {
    console.error("Missing MINI_APP_URL env var");
    try {
      await telegramRequest(env.TELEGRAM_BOT_TOKEN, "sendMessage", {
        chat_id: chatId,
        text: "❌ Ошибка конфигурации: MINI_APP_URL не установлен в Cloudflare",
      });
    } catch (e) {
      console.error("Failed to send error message", e);
    }
    return;
  }

  // Validate HTTPS
  if (!miniAppUrl.startsWith("https://")) {
    console.error("MINI_APP_URL must use HTTPS:", miniAppUrl);
    try {
      await telegramRequest(env.TELEGRAM_BOT_TOKEN, "sendMessage", {
        chat_id: chatId,
        text: "❌ Ошибка конфигурации: URL должен начинаться с https://",
      });
    } catch (e) {
      console.error("Failed to send error message", e);
    }
    return;
  }

  try {
    if (text.startsWith("/start")) {
      await telegramRequest(env.TELEGRAM_BOT_TOKEN, "sendMessage", {
        chat_id: chatId,
        // ИСПРАВЛЕНО: грамматика "откроется".
        // ИСПРАВЛЕНО: убран parse_mode: "Markdown", чтобы избежать ошибок 400 из-за спецсимволов в botName
        text: `Вы попали в ${botName}!\n\nЖмите кнопку ниже для открытия расписания\nФидбеку буду рад в лс @lexanachile`,
        reply_markup: buildKeyboard(miniAppUrl),
      });
    } else if (text.startsWith("/help")) {
      await telegramRequest(env.TELEGRAM_BOT_TOKEN, "sendMessage", {
        chat_id: chatId,
        text: HELP_TEXT(botName),
        parse_mode: "Markdown",
      });
    } else {
      await telegramRequest(env.TELEGRAM_BOT_TOKEN, "sendMessage", {
        chat_id: chatId,
        // ИСПРАВЛЕНО: убран parse_mode
        text: `Неизвестная команда\n\nНажмите на кнопку ниже, чтобы открыть расписание, или используйте /help для справки`,
        reply_markup: buildKeyboard(miniAppUrl),
      });
    }
  } catch (e) {
    console.error("Error handling message:", e);
  }
}

async function handleCallbackQuery(query, env) {
  const chatId = query.message?.chat?.id || query.from?.id;
  if (!chatId || !query.id) {
    console.error("No chatId or query.id in callback", query);
    return;
  }

  const botName = env.BOT_NAME ? env.BOT_NAME.trim() : "ScheduleBot";

  try {
    if (query.data === "help") {
      await telegramRequest(env.TELEGRAM_BOT_TOKEN, "sendMessage", {
        chat_id: chatId,
        text: HELP_TEXT(botName),
        parse_mode: "Markdown",
      });

      await telegramRequest(env.TELEGRAM_BOT_TOKEN, "answerCallbackQuery", {
        callback_query_id: query.id,
        text: "Справка открыта",
        show_alert: false,
      });
    }
  } catch (e) {
    console.error("Error handling callback query:", e);
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    // GET /setup-webhook - setup webhook
    if (path === "/setup-webhook" && request.method === "GET") {
      if (!env.TELEGRAM_BOT_TOKEN) {
        return new Response("Missing TELEGRAM_BOT_TOKEN", { status: 500 });
      }

      const workerUrl = new URL(request.url).origin;
      const webhookUrl = `${workerUrl}/webhook`;

      try {
        const response = await fetch(
          `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/setWebhook`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            // ИСПРАВЛЕНО: Добавлен Secret Token для защиты webhook
            body: JSON.stringify({
              url: webhookUrl,
              allowed_updates: ["message", "callback_query"],
              secret_token:
                env.WEBHOOK_SECRET || "default_secret_123_please_change",
            }),
          },
        );
        const result = await response.json();
        return new Response(
          JSON.stringify(
            { ok: result.ok, webhook_url: webhookUrl, result },
            null,
            2,
          ),
          {
            headers: { "Content-Type": "application/json" },
          },
        );
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }, null, 2), {
          status: 500,
        });
      }
    }

    // GET /webhook-info - get webhook status
    if (path === "/webhook-info" && request.method === "GET") {
      if (!env.TELEGRAM_BOT_TOKEN) {
        return new Response("Missing TELEGRAM_BOT_TOKEN", { status: 500 });
      }

      try {
        const response = await fetch(
          `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/getWebhookInfo`,
          { method: "POST" },
        );
        const result = await response.json();
        return new Response(JSON.stringify(result, null, 2), {
          headers: { "Content-Type": "application/json" },
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }, null, 2), {
          status: 500,
        });
      }
    }

    // POST /webhook - handle Telegram updates
    if (path === "/webhook" && request.method === "POST") {
      if (!env.TELEGRAM_BOT_TOKEN || !env.MINI_APP_URL) {
        console.error("Missing env:", {
          token: !!env.TELEGRAM_BOT_TOKEN,
          miniApp: !!env.MINI_APP_URL,
        });
        return new Response("Missing Cloudflare env variables", {
          status: 500,
        });
      }

      // ИСПРАВЛЕНО: Защита от поддельных запросов (Security)
      const secretToken = request.headers.get(
        "X-Telegram-Bot-Api-Secret-Token",
      );
      const expectedSecret =
        env.WEBHOOK_SECRET || "default_secret_123_please_change";
      if (secretToken !== expectedSecret) {
        return new Response("Unauthorized", { status: 403 });
      }

      const body = await request.json().catch(() => null);
      if (!body) {
        return new Response("Invalid JSON", { status: 400 });
      }

      if (body.message) {
        // ИСПРАВЛЕНО: Пропускаем стикеры, фото и системные сообщения
        if (body.message.text || text.startsWith("/")) {
          await handleMessage(body.message, env);
        }
        return new Response("OK", { status: 200 });
      }

      if (body.callback_query) {
        await handleCallbackQuery(body.callback_query, env);
        return new Response("OK", { status: 200 });
      }

      return new Response("No update type", { status: 200 });
    }

    // GET /debug-config - show env config (without token)
    if (path === "/debug-config" && request.method === "GET") {
      const miniAppUrl = env.MINI_APP_URL ? env.MINI_APP_URL.trim() : null;
      const botName = env.BOT_NAME ? env.BOT_NAME.trim() : null;

      return new Response(
        JSON.stringify(
          {
            hasToken: !!env.TELEGRAM_BOT_TOKEN,
            hasWebhookSecret: !!env.WEBHOOK_SECRET, // ИСПРАВЛЕНО: добавлено для отладки
            miniAppUrl: miniAppUrl,
            miniAppUrlValid: miniAppUrl
              ? miniAppUrl.startsWith("https://")
              : false,
            botName: botName,
            miniAppUrlLength: miniAppUrl ? miniAppUrl.length : 0,
          },
          null,
          2,
        ),
        { headers: { "Content-Type": "application/json" } },
      );
    }

    // GET / - health check
    if (request.method === "GET") {
      return new Response(
        JSON.stringify(
          {
            status: "ok",
            setupWebhook: `${new URL(request.url).origin}/setup-webhook`,
            webhookInfo: `${new URL(request.url).origin}/webhook-info`,
            debugConfig: `${new URL(request.url).origin}/debug-config`,
          },
          null,
          2,
        ),
        { headers: { "Content-Type": "application/json" } },
      );
    }

    return new Response("Not found", { status: 404 });
  },
};
