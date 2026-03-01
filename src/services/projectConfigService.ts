import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";

type ProjectsConfig = {
  projects: Record<string, "active" | "inactive">;
};

function resolveConfigPath(): string {
  const envPath = process.env.PROJECT_CONFIG_PATH;
  const candidates = [
    envPath,
    path.resolve(process.cwd(), "src/config/projects.yaml"),
    path.resolve(process.cwd(), "config/projects.yaml"),
  ].filter(Boolean) as string[];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error("projects.yaml not found. Set PROJECT_CONFIG_PATH or place it in src/config or config.");
}

export function loadProjectsConfig(): ProjectsConfig {
  const configPath = resolveConfigPath();
  const raw = fs.readFileSync(configPath, "utf8");
  const parsed = yaml.load(raw) as ProjectsConfig;

  if (!parsed || typeof parsed !== "object" || !parsed.projects) {
    throw new Error("Invalid projects.yaml format");
  }

  return parsed;
}

export function isProjectActive(projectId: string): boolean {
  const config = loadProjectsConfig();
  return config.projects?.[projectId] === "active";
}
