import { FastifyInstance } from "fastify";
import { pingDatabase } from "../db/pool.js";
import { pingRedis } from "../cache/redis.js";

export default async function healthRoutes(app: FastifyInstance) {
  app.get("/healthz", async () => ({ status: "ok" }));

  app.get("/readyz", async () => {
    await Promise.all([pingDatabase(), pingRedis()]);
    return { status: "ready" };
  });
}
