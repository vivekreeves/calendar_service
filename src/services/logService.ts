import fs from "node:fs";
import path from "node:path";

export type ProjectLogEntry = {
  timestamp: string;
  project_id: string;
  date: string;
  country_code: string;
  status: number;
  duration_ms: number;
  is_working_day?: boolean;
  holiday_name?: string | null;
  reason?: string;
  error?: string;
};

export type QueueLogEntry = {
  timestamp: string;
  action: "enqueue" | "dequeue";
  project_id: string;
  date: string;
  country_code: string;
};

const LOG_ROOT = path.resolve(process.cwd(), "logs");

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

export function logProjectRequest(entry: ProjectLogEntry): void {
  const projectDir = path.join(LOG_ROOT, safeProjectId(entry.project_id));
  const filePath = path.join(projectDir, "requests.log");
  appendLine(filePath, entry);
}

export function logQueueEvent(entry: QueueLogEntry): void {
  const filePath = path.join(LOG_ROOT, "queue", "queue.log");
  appendLine(filePath, entry);
}
