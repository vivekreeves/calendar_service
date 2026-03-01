import fastify from "fastify";
import healthRoutes from "./routes/health.js";
import holidayRoutes from "./routes/holidays.js";
import { config } from "./config.js";

async function buildServer() {
  const app = fastify({ logger: true });

  app.register(healthRoutes);
  app.register(holidayRoutes);

  return app;
}

async function start() {
  const app = await buildServer();
  try {
    await app.listen({ port: config.port, host: "0.0.0.0" });
    app.log.info(`Server listening on port ${config.port}`);
  } catch (err) {
    app.log.error(err, "Failed to start server");
    process.exit(1);
  }
}

start();
