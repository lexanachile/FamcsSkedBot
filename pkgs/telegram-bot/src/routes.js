import { handleCallbackQuery, handleMessage } from "./handlers.js";
import { telegramMethod } from "./telegram.js";

const json = (value, status = 200) => new Response(JSON.stringify(value, null, 2), { status, headers: { "Content-Type": "application/json" } });

export async function broadcast(request, env) {
  if (!env.ADMIN_TOKEN || request.headers.get("Authorization") !== `Bearer ${env.ADMIN_TOKEN}`) return new Response("Unauthorized", { status: 401 });
  if (!env.TELEGRAM_BOT_TOKEN) return json({ error: "Missing TELEGRAM_BOT_TOKEN" }, 500);
  const body = await request.json().catch(() => null);
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  if (!text || text.length > 4096) return json({ error: "text must contain 1–4096 characters" }, 400);
  const users = await env.DB.prepare("SELECT telegram_id, chat_id FROM bot_users WHERE telegram_id = chat_id").all();
  let sent = 0;
  let failed = 0;
  for (const user of users.results || []) {
    try {
      const response = await fetch(telegramMethod(env.TELEGRAM_BOT_TOKEN, "sendMessage"), {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: String(user.chat_id), text }),
      });
      if (response.ok) sent += 1; else failed += 1;
    } catch { failed += 1; }
  }
  return json({ ok: true, total: users.results?.length || 0, sent, failed });
}

export async function setupWebhook(request, env) {
  if (!env.ADMIN_TOKEN || request.headers.get("Authorization") !== `Bearer ${env.ADMIN_TOKEN}`) return new Response("Unauthorized", { status: 401 });
  if (!env.TELEGRAM_BOT_TOKEN) return new Response("Missing TELEGRAM_BOT_TOKEN", { status: 500 });
  const webhookUrl = `${new URL(request.url).origin}/webhook`;
  try {
    const response = await fetch(telegramMethod(env.TELEGRAM_BOT_TOKEN, "setWebhook"), {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: webhookUrl, allowed_updates: ["message", "callback_query"], secret_token: env.WEBHOOK_SECRET }),
    });
    const result = await response.json();
    return json({ ok: result.ok, webhook_url: webhookUrl, result });
  } catch (error) { return json({ error: error.message }, 500); }
}

export async function webhookInfo(request, env) {
  if (!env.ADMIN_TOKEN || request.headers.get("Authorization") !== `Bearer ${env.ADMIN_TOKEN}`) return new Response("Unauthorized", { status: 401 });
  if (!env.TELEGRAM_BOT_TOKEN) return new Response("Missing TELEGRAM_BOT_TOKEN", { status: 500 });
  try {
    const response = await fetch(telegramMethod(env.TELEGRAM_BOT_TOKEN, "getWebhookInfo"), { method: "POST" });
    return json(await response.json());
  } catch (error) { return json({ error: error.message }, 500); }
}

export async function processWebhook(request, env) {
  if (!env.TELEGRAM_BOT_TOKEN || !env.MINI_APP_URL || !env.WEBHOOK_SECRET) return new Response("Missing Cloudflare env variables", { status: 500 });
  const secret = request.headers.get("X-Telegram-Bot-Api-Secret-Token");
  if (secret !== env.WEBHOOK_SECRET) return new Response("Unauthorized", { status: 403 });
  const body = await request.json().catch(() => null);
  if (!body) return new Response("Invalid JSON", { status: 400 });
  if (body.message) {
    if (body.message.text) await handleMessage(body.message, env);
    return new Response("OK");
  }
  if (body.callback_query) { await handleCallbackQuery(body.callback_query, env); return new Response("OK"); }
  return new Response("No update type");
}

export function debugConfig(request, env) {
  if (!env.ADMIN_TOKEN || request.headers.get("Authorization") !== `Bearer ${env.ADMIN_TOKEN}`) return new Response("Unauthorized", { status: 401 });
  const miniAppUrl = env.MINI_APP_URL?.trim() || null;
  const botName = env.BOT_NAME?.trim() || null;
  return json({ hasToken: !!env.TELEGRAM_BOT_TOKEN, hasWebhookSecret: !!env.WEBHOOK_SECRET, hasScheduleApiBinding: !!env.SCHEDULE_API, apiBaseUrl: env.API_BASE_URL?.trim() || null, miniAppUrl, miniAppUrlValid: miniAppUrl ? miniAppUrl.startsWith("https://") : false, botName, miniAppUrlLength: miniAppUrl?.length || 0 });
}

export function health(request) {
  const origin = new URL(request.url).origin;
  return json({ status: "ok", setupWebhook: `${origin}/setup-webhook`, webhookInfo: `${origin}/webhook-info`, debugConfig: `${origin}/debug-config` });
}
