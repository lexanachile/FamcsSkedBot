import { broadcast, debugConfig, health, processWebhook, setupWebhook, webhookInfo } from "./src/routes.js";
import { processNotifications } from "./src/notifications.js";

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    if (request.method === "GET" && pathname === "/setup-webhook") return setupWebhook(request, env);
    if (request.method === "GET" && pathname === "/webhook-info") return webhookInfo(request, env);
    if (request.method === "POST" && pathname === "/webhook") return processWebhook(request, env);
    if (request.method === "POST" && pathname === "/broadcast") return broadcast(request, env);
    if (request.method === "GET" && pathname === "/debug-config") return debugConfig(request, env);
    if (request.method === "GET") return health(request);
    return new Response("Not found", { status: 404 });
  },
  queue: processNotifications,
};
