import { Hono } from "hono";
import { cors } from "hono/cors";
import { registerScheduleRoutes } from "./routes/schedule";
import { registerSystemRoutes } from "./routes/system";
import type { AppEnvironment } from "./types";

const app = new Hono<AppEnvironment>();

app.use("*", cors({
  origin: ["https://famcs.online"],
  allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowHeaders: ["Content-Type", "Authorization"],
  maxAge: 600,
}));

app.use("*", async (c, next) => {
  console.log(`📥 ${c.req.method} ${c.req.path}`);
  await next();
});

registerSystemRoutes(app);
registerScheduleRoutes(app);

app.all("*", (c) => c.json({ success: false, error: "Not Found", message: `Маршрут ${c.req.path} не существует` }, 404));

export default app;
