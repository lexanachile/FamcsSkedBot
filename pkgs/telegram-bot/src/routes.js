import { handleCallbackQuery, handleMessage } from "./handlers.js";
import { telegramMethod } from "./telegram.js";

const json = (value, status = 200) => new Response(JSON.stringify(value, null, 2), { status, headers: { "Content-Type": "application/json" } });

export async function setupWebhook(request, env) {
  if (!env.TELEGRAM_BOT_TOKEN) return new Response("Missing TELEGRAM_BOT_TOKEN", { status: 500 });
  const webhookUrl = `${new URL(request.url).origin}/webhook`;
  try {
    const response = await fetch(telegramMethod(env.TELEGRAM_BOT_TOKEN, "setWebhook"), {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: webhookUrl, allowed_updates: ["message", "callback_query"], secret_token: env.WEBHOOK_SECRET || "default_secret_123_please_change" }),
    });
    const result = await response.json();
    return json({ ok: result.ok, webhook_url: webhookUrl, result });
  } catch (error) { return json({ error: error.message }, 500); }
}

export async function webhookInfo(env) {
  if (!env.TELEGRAM_BOT_TOKEN) return new Response("Missing TELEGRAM_BOT_TOKEN", { status: 500 });
  try {
    const response = await fetch(telegramMethod(env.TELEGRAM_BOT_TOKEN, "getWebhookInfo"), { method: "POST" });
    return json(await response.json());
  } catch (error) { return json({ error: error.message }, 500); }
}

export async function processWebhook(request, env) {
  if (!env.TELEGRAM_BOT_TOKEN || !env.MINI_APP_URL) return new Response("Missing Cloudflare env variables", { status: 500 });
  const secret = request.headers.get("X-Telegram-Bot-Api-Secret-Token");
  if (secret !== (env.WEBHOOK_SECRET || "default_secret_123_please_change")) return new Response("Unauthorized", { status: 403 });
  const body = await request.json().catch(() => null);
  if (!body) return new Response("Invalid JSON", { status: 400 });
  if (body.message) {
    if (body.message.text) await handleMessage(body.message, env);
    return new Response("OK");
  }
  if (body.callback_query) { await handleCallbackQuery(body.callback_query, env); return new Response("OK"); }
  return new Response("No update type");
}

export function debugConfig(env) {
  const miniAppUrl = env.MINI_APP_URL?.trim() || null;
  const botName = env.BOT_NAME?.trim() || null;
  return json({ hasToken: !!env.TELEGRAM_BOT_TOKEN, hasWebhookSecret: !!env.WEBHOOK_SECRET, miniAppUrl, miniAppUrlValid: miniAppUrl ? miniAppUrl.startsWith("https://") : false, botName, miniAppUrlLength: miniAppUrl?.length || 0 });
}

export function health(request) {
  const origin = new URL(request.url).origin;
  return json({ status: "ok", setupWebhook: `${origin}/setup-webhook`, webhookInfo: `${origin}/webhook-info`, debugConfig: `${origin}/debug-config` });
}
