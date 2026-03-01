import { getRedis } from "../cache/redis.js";
import { logQueueEvent } from "./logService.js";

export type HolidayRequest = {
  project_id: string;
  date: string;
  country_code: string;
};

const QUEUE_KEY = "holiday_requests";

async function ensureConnected() {
  const redis = getRedis();
  if (redis.status === "ready") {
    return redis;
  }
  if (redis.status === "connecting") {
    await new Promise((resolve) => redis.once("ready", resolve));
    return redis;
  }
  await redis.connect();
  return redis;
}

export async function enqueueRequest(request: HolidayRequest): Promise<void> {
  const redis = await ensureConnected();
  await redis.lpush(QUEUE_KEY, JSON.stringify(request));
  logQueueEvent({
    timestamp: new Date().toISOString(),
    action: "enqueue",
    project_id: request.project_id,
    date: request.date,
    country_code: request.country_code,
  });
}

export async function dequeueRequest(): Promise<HolidayRequest | null> {
  const redis = await ensureConnected();
  const payload = await redis.rpop(QUEUE_KEY);
  if (!payload) {
    return null;
  }
  const request = JSON.parse(payload) as HolidayRequest;
  logQueueEvent({
    timestamp: new Date().toISOString(),
    action: "dequeue",
    project_id: request.project_id,
    date: request.date,
    country_code: request.country_code,
  });
  return request;
}
