import { debugConfig, health, processWebhook, setupWebhook, webhookInfo } from "./src/routes.js";

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    if (request.method === "GET" && pathname === "/setup-webhook") return setupWebhook(request, env);
    if (request.method === "GET" && pathname === "/webhook-info") return webhookInfo(env);
    if (request.method === "POST" && pathname === "/webhook") return processWebhook(request, env);
    if (request.method === "GET" && pathname === "/debug-config") return debugConfig(env);
    if (request.method === "GET") return health(request);
    return new Response("Not found", { status: 404 });
  },
};
