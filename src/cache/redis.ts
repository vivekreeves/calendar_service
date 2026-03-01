import Redis from "ioredis";
import { config } from "../config.js";

let client: Redis | null = null;

export function getRedis(): Redis {
  if (!client) {
    client = new Redis(config.redisUrl, {
      lazyConnect: true,
      maxRetriesPerRequest: 2,
    });
  }
  return client;
}

export async function pingRedis(): Promise<void> {
  const redis = getRedis();
  if (!redis.status || redis.status === "end") {
    await redis.connect();
  }
  await redis.ping();
}
