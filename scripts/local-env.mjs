import { execFile as execFileCallback } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";

export const execFile = promisify(execFileCallback);
const ENV_ASSIGNMENT = /^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/;
const LINE_ENDING = /\r?\n/;

export const LOCAL = {
  basePort: 25601,
  services: {
    api: 0,
    ws: 1,
    web: 2,
    postgres: 3,
    redis: 4,
  },
};

export function parseEnvFile(file) {
  const values = {};
  if (!fs.existsSync(file)) {
    return values;
  }

  for (const rawLine of fs.readFileSync(file, "utf8").split(LINE_ENDING)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }
    const match = ENV_ASSIGNMENT.exec(line);
    if (!match) {
      continue;
    }
    let [, key, value] = match;
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    values[key] = value;
  }
  return values;
}

export function loadLocalEnv(root) {
  const base = path.join(root, ".env");
  if (!fs.existsSync(base)) {
    throw new Error(`Missing ${base}. Copy .env.example to .env and set a real JWT_SECRET.`);
  }
  const overlay = path.join(root, ".env.codex.local");
  const values = { ...parseEnvFile(base), ...parseEnvFile(overlay) };
  Object.assign(process.env, values);
  return values;
}

export function portsForSlot(slot) {
  const start = LOCAL.basePort + slot;
  return Object.fromEntries(
    Object.entries(LOCAL.services).map(([name, offset]) => [name, start + offset]),
  );
}

export function isWithinRoot(candidate, root) {
  const relative = path.relative(root, candidate);
  return relative === "" || !(relative.startsWith("..") || path.isAbsolute(relative));
}
