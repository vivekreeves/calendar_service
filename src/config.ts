export type ServiceConfig = {
  port: number;
  postgresUri: string;
  redisUrl: string;
};

const port = Number(process.env.PORT ?? 3000);
const postgresUri = process.env.POSTGRES_URI ?? "postgresql://calendar_user:calendar_pass@localhost:5432/calendar_service";
const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379/0";

export const config: ServiceConfig = {
  port,
  postgresUri,
  redisUrl,
};
