import type { Context, Hono } from "hono";
import { readManifest } from "../schedule/repository";
import type { AppEnvironment } from "../types";

export function registerSystemRoutes(app: Hono<AppEnvironment>) {
  const health = async (c: Context<AppEnvironment>) => {
    const manifests = await Promise.all([1, 2, 3, 4, 5].map((course) => readManifest(c.env.SCHEDULE_KV, course)));
    return c.json({
      status: "ok",
      storage: "cloudflare-kv",
      timestamp: new Date().toISOString(),
      courses: manifests.filter(Boolean).map((item) => ({
        course: item!.course,
        updatedAt: item!.updatedAt,
        records: item!.recordCount,
        groups: item!.groupCount,
      })),
    });
  };

  app.get("/api/health", health);
  app.get("/api/healt", health);

  app.get("/api/admin/storage-check", async (c) => {
    if (!c.env.AUTH_TOKEN || c.req.header("Authorization") !== `Bearer ${c.env.AUTH_TOKEN}`) {
      return c.json({ success: false, error: "Unauthorized" }, 401);
    }
    const manifests = await Promise.all([1, 2, 3, 4, 5].map((course) => readManifest(c.env.SCHEDULE_KV, course)));
    return c.json({ success: true, storage: "cloudflare-kv", manifests });
  });
}
