import fs from "node:fs";
import path from "node:path";

type MinuteStats = {
  minuteKey: string;
  count: number;
  totalMs: number;
  maxMs: number;
};

const LOG_ROOT = path.resolve(process.cwd(), "logs");
const statsByProject = new Map<string, MinuteStats>();

function ensureDir(dirPath: string): void {
  fs.mkdirSync(dirPath, { recursive: true });
}

function safeProjectId(projectId: string): string {
  return projectId.replace(/[^a-zA-Z0-9_-]/g, "_");
}

function appendLine(filePath: string, payload: object): void {
  ensureDir(path.dirname(filePath));
  fs.appendFileSync(filePath, `${JSON.stringify(payload)}\n`, "utf8");
}

function getMinuteKey(date: Date): string {
  const iso = date.toISOString();
  return iso.slice(0, 16); // YYYY-MM-DDTHH:MM
}

function flush(projectId: string, stats: MinuteStats): void {
  const filePath = path.join(LOG_ROOT, "metrics", `${safeProjectId(projectId)}.log`);
  const avgMs = stats.count === 0 ? 0 : Number((stats.totalMs / stats.count).toFixed(2));
  appendLine(filePath, {
    minute: stats.minuteKey,
    project_id: projectId,
    count: stats.count,
    avg_duration_ms: avgMs,
    max_duration_ms: stats.maxMs,
  });
}

export function recordRequestMetrics(projectId: string, durationMs: number, at: Date = new Date()): void {
  const minuteKey = getMinuteKey(at);
  const current = statsByProject.get(projectId);

  if (!current) {
    statsByProject.set(projectId, { minuteKey, count: 1, totalMs: durationMs, maxMs: durationMs });
    return;
  }

  if (current.minuteKey !== minuteKey) {
    flush(projectId, current);
    statsByProject.set(projectId, { minuteKey, count: 1, totalMs: durationMs, maxMs: durationMs });
    return;
  }

  current.count += 1;
  current.totalMs += durationMs;
  current.maxMs = Math.max(current.maxMs, durationMs);
}
