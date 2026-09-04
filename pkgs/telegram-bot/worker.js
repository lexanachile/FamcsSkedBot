import { debugConfig, health, processWebhook, setupWebhook, webhookInfo } from "./src/routes.js";

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    if (request.method === "GET" && pathname === "/setup-webhook") return setupWebhook(request, env);
    if (request.method === "GET" && pathname === "/webhook-info") return webhookInfo(request, env);
    if (request.method === "POST" && pathname === "/webhook") return processWebhook(request, env);
    if (request.method === "GET" && pathname === "/debug-config") return debugConfig(request, env);
    if (request.method === "GET") return health(request);
    return new Response("Not found", { status: 404 });
  },
  async queue(batch, env) {
    for (const message of batch.messages) {
      try {
        const { telegramRequest } = await import("./src/telegram.js");
        const text = String(message.body?.text || "");
        const chunks = text.match(/[\s\S]{1,4000}/g) || [];
        for (const chunk of chunks) {
          await telegramRequest(env.TELEGRAM_BOT_TOKEN, "sendMessage", { chat_id: message.body.chat_id, text: chunk });
        }
        message.ack();
      } catch (error) {
        console.error("Notification delivery failed", error);
        message.retry();
      }
    }
  },
};
