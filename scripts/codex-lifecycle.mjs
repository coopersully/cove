import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import {
  LOCAL,
  execFile,
  isWithinRoot,
  loadLocalEnv,
  parseEnvFile,
  portsForSlot,
} from "./local-env.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const action = process.argv[2] ?? "help";
const localDatabaseUser = "cove";

function fail(message) {
  throw new Error(message);
}

async function command(commandName, args, options = {}) {
  try {
    return await execFile(commandName, args, {
      cwd: root,
      encoding: "utf8",
      ...options,
    });
  } catch (error) {
    const stderr = error.stderr?.trim();
    const stdout = error.stdout?.trim();
    throw new Error(
      [`${commandName} ${args.join(" ")} failed.`, stderr || stdout].filter(Boolean).join("\n"),
    );
  }
}

async function gitWorktrees() {
  const { stdout } = await command("git", ["worktree", "list", "--porcelain"]);
  return stdout
    .split("\n")
    .filter((line) => line.startsWith("worktree "))
    .map((line) => line.slice("worktree ".length));
}

async function primaryRoot() {
  const [primary] = await gitWorktrees();
  if (!primary) fail("Could not identify the primary Git checkout.");
  return path.resolve(primary);
}

function environmentFor(slot) {
  const ports = portsForSlot(slot);
  return {
    CODEX_WORKTREE_SLOT: String(slot),
    PORT: String(ports.api),
    WS_PORT: String(ports.ws),
    WEB_PORT: String(ports.web),
    POSTGRES_PORT: String(ports.postgres),
    REDIS_PORT: String(ports.redis),
    DATABASE_URL: `postgresql://${localDatabaseUser}:${localDatabaseUser}@localhost:${String(ports.postgres)}/cove`,
    REDIS_URL: `redis://localhost:${String(ports.redis)}`,
    FRONTEND_URL: `http://localhost:${String(ports.web)}`,
    VITE_API_URL: `http://localhost:${String(ports.api)}`,
    VITE_WS_URL: `ws://localhost:${String(ports.ws)}`,
  };
}

async function listeners(port) {
  try {
    const { stdout } = await execFile("lsof", [
      "-nP",
      `-iTCP:${String(port)}`,
      "-sTCP:LISTEN",
      "-Fpc",
    ]);
    return [...new Set([...stdout.matchAll(/^p(\d+)$/gm)].map((match) => Number(match[1])))];
  } catch (error) {
    if (error.code === 1) return [];
    throw error;
  }
}

async function processDetails(pid) {
  const [{ stdout: commandLine }, { stdout: cwdOutput }] = await Promise.all([
    execFile("ps", ["-p", String(pid), "-o", "command="]),
    execFile("lsof", ["-a", "-p", String(pid), "-d", "cwd", "-Fn"]),
  ]);
  const cwd =
    cwdOutput
      .split("\n")
      .find((line) => line.startsWith("n"))
      ?.slice(1) ?? "unknown";
  return { command: commandLine.trim(), cwd };
}

async function isOwnedProcess(pid) {
  try {
    const details = await processDetails(pid);
    return {
      ...details,
      owned:
        details.command.includes(root) ||
        (details.cwd !== "unknown" && isWithinRoot(details.cwd, root)),
    };
  } catch {
    return { command: "unknown", cwd: "unknown", owned: false };
  }
}

async function isManagedContainerPort(service, internalPort, composeArgs) {
  try {
    const { stdout: ids } = await command("docker", [...composeArgs, "ps", "-q", service]);
    const id = ids.trim();
    if (!id) return false;
    const { stdout } = await command("docker", ["port", id, `${String(internalPort)}/tcp`]);
    return (
      stdout.includes(`${String(internalPort)}/tcp ->`) &&
      (stdout.includes("0.0.0.0:") || stdout.includes("[::]:"))
    );
  } catch {
    return false;
  }
}

async function stopPid(pid) {
  process.kill(-pid, "SIGTERM");
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try {
      process.kill(pid, 0);
      await new Promise((resolve) => setTimeout(resolve, 250));
    } catch {
      return;
    }
  }
  process.kill(-pid, "SIGKILL");
}

function overlayPath() {
  return path.join(root, ".env.codex.local");
}

async function selectSlot(primary) {
  if (primary === root) return 0;

  const existing = Number(parseEnvFile(overlayPath()).CODEX_WORKTREE_SLOT);
  if (Number.isInteger(existing) && existing > 0 && existing < 10) return existing;

  const highestServiceOffset = Math.max(...Object.values(LOCAL.services));
  for (
    let slot = 1;
    LOCAL.basePort + slot + highestServiceOffset <= 65_535;
    slot += 1
  ) {
    const candidate = portsForSlot(slot);
    const used = await Promise.all(Object.values(candidate).map(listeners));
    if (used.every((pids) => pids.length === 0)) return slot;
  }
  fail("No completely free incremented Cove worktree port set is available.");
}

async function synchronizeEnvironment() {
  const primary = await primaryRoot();
  const base = path.join(root, ".env");
  const source = path.join(primary, ".env");
  if (!fs.existsSync(source)) {
    fail(
      `The primary checkout has no .env (${source}). Copy .env.example to it and set a real JWT_SECRET.`,
    );
  }
  if (primary !== root) fs.copyFileSync(source, base);

  const slot = await selectSlot(primary);
  if (slot === 0) {
    fs.rmSync(overlayPath(), { force: true });
  } else {
    const overlay = environmentFor(slot);
    fs.writeFileSync(
      overlayPath(),
      `# Generated by pnpm local:setup. Keep secrets in the primary checkout's .env.\n${Object.entries(
        overlay,
      )
        .map(([key, value]) => `${key}=${value}`)
        .join("\n")}\n`,
    );
  }
  return { primary, slot };
}

function validateEnvironment(slot) {
  const env = loadLocalEnv(root);
  const expected = environmentFor(slot);
  if (!env.JWT_SECRET || env.JWT_SECRET === "change-me-to-a-random-secret") {
    fail("JWT_SECRET must be set to a non-placeholder value in the primary checkout's .env.");
  }
  for (const key of [
    "PORT",
    "WS_PORT",
    "WEB_PORT",
    "POSTGRES_PORT",
    "REDIS_PORT",
    "DATABASE_URL",
    "REDIS_URL",
    "FRONTEND_URL",
    "VITE_API_URL",
    "VITE_WS_URL",
  ]) {
    if (env[key] !== expected[key]) {
      fail(
        `${key} must be ${expected[key]} for Cove worktree slot ${String(slot)}. Run pnpm local:setup to regenerate the worktree overlay.`,
      );
    }
  }
  return env;
}

async function checkTools() {
  const major = Number(process.versions.node.split(".")[0]);
  if (!Number.isInteger(major) || major < 24)
    fail(`Node.js 24+ is required; found ${process.version}.`);
  await command("pnpm", ["--version"]);
  await command("docker", ["info", "--format", "{{.ServerVersion}}"]).catch(() => {
    fail("Docker Desktop must be running before starting Cove.");
  });
}

function composeArguments(slot) {
  const args = ["compose", "--env-file", ".env"];
  if (fs.existsSync(overlayPath())) args.push("--env-file", ".env.codex.local");
  args.push("--project-name", `cove-slot-${String(slot)}`);
  return args;
}

async function prepare() {
  await checkTools();
  const { primary, slot } = await synchronizeEnvironment();
  const env = validateEnvironment(slot);
  return { primary, slot, env, composeArgs: composeArguments(slot) };
}

async function preflightPorts({ slot, composeArgs }) {
  const ports = portsForSlot(slot);
  const containerPorts = new Map([
    [ports.postgres, ["postgres", 5432]],
    [ports.redis, ["redis", 6379]],
  ]);

  for (const port of Object.values(ports)) {
    const pids = await listeners(port);
    if (pids.length === 0) continue;
    const container = containerPorts.get(port);
    if (container && (await isManagedContainerPort(container[0], container[1], composeArgs)))
      continue;

    for (const pid of pids) {
      const details = await isOwnedProcess(pid);
      if (!details.owned) {
        fail(
          `Refusing to stop foreign listener on port ${String(port)} (PID ${String(pid)}, command: ${details.command}, cwd: ${details.cwd}).`,
        );
      }
      console.info(`Stopping prior Cove listener on port ${String(port)} (PID ${String(pid)}).`);
      await stopPid(pid);
    }
  }
}

function runtimeDirectory(slot) {
  return path.join(root, ".codex", "runtime", `cove-slot-${String(slot)}`);
}

function startService(name, filter, env, slot) {
  const directory = runtimeDirectory(slot);
  fs.mkdirSync(directory, { recursive: true });
  const log = fs.openSync(path.join(directory, `${name}.log`), "a");
  const child = spawn("pnpm", ["--filter", filter, "dev"], {
    cwd: root,
    detached: true,
    env: { ...process.env, ...env },
    stdio: ["ignore", log, log],
  });
  child.unref();
  fs.writeFileSync(path.join(directory, `${name}.pid`), `${String(child.pid)}\n`);
}

async function waitForHttp(url, label) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // Continue while the development server starts.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  fail(`${label} did not become ready. Inspect pnpm logs.`);
}

async function setup() {
  const { primary, slot } = await prepare();
  await command("pnpm", ["install", "--frozen-lockfile"]);
  console.info(`Cove setup complete (primary: ${primary}, worktree slot: ${String(slot)}).`);
}

async function start() {
  const context = await prepare();
  await preflightPorts(context);
  await command("docker", [...context.composeArgs, "up", "-d", "--wait"]);
  await command("pnpm", ["--filter", "@cove/db", "db:migrate"], {
    env: { ...process.env, ...context.env },
  });
  startService("api", "@cove/api", context.env, context.slot);
  startService("ws", "@cove/ws", context.env, context.slot);
  startService("web", "@cove/web", context.env, context.slot);
  const ports = portsForSlot(context.slot);
  await waitForHttp(`http://localhost:${String(ports.api)}/health`, "Cove API");
  await waitForHttp(`http://localhost:${String(ports.web)}`, "Cove web app");
  console.info(
    `Cove is ready: web http://localhost:${String(ports.web)}, API http://localhost:${String(ports.api)}/health, WS ws://localhost:${String(ports.ws)}`,
  );
  console.info("Stop with: pnpm stop");
}

async function stop() {
  const { slot, composeArgs } = await prepare();
  const directory = runtimeDirectory(slot);
  for (const name of ["api", "ws", "web"]) {
    const pidFile = path.join(directory, `${name}.pid`);
    if (!fs.existsSync(pidFile)) continue;
    const pid = Number(fs.readFileSync(pidFile, "utf8").trim());
    if (Number.isInteger(pid) && (await isOwnedProcess(pid)).owned) {
      console.info(`Stopping Cove ${name} (PID ${String(pid)}).`);
      await stopPid(pid);
    }
    fs.rmSync(pidFile, { force: true });
  }
  await command("docker", [...composeArgs, "stop"]);
  console.info("Cove stopped. Database and Redis data volumes were preserved.");
}

async function status() {
  const { slot, composeArgs } = await prepare();
  const ports = portsForSlot(slot);
  console.info(`Cove worktree slot: ${String(slot)}`);
  for (const [name, port] of Object.entries(ports)) {
    const pids = await listeners(port);
    console.info(
      `${name.padEnd(8)} ${String(port)}${pids.length ? ` (PID ${pids.join(", ")})` : " (not listening)"}`,
    );
  }
  const { stdout } = await command("docker", [...composeArgs, "ps"]);
  process.stdout.write(stdout);
}

async function logs() {
  const { slot } = await prepare();
  const directory = runtimeDirectory(slot);
  for (const name of ["api", "ws", "web"]) {
    const file = path.join(directory, `${name}.log`);
    console.info(`\n--- ${name} ---`);
    if (fs.existsSync(file))
      process.stdout.write(fs.readFileSync(file, "utf8").split("\n").slice(-80).join("\n"));
    else console.info("No log file yet.");
  }
}

async function verify() {
  const { slot, composeArgs } = await prepare();
  const ports = portsForSlot(slot);
  await command("docker", [
    ...composeArgs,
    "exec",
    "postgres",
    "pg_isready",
    "-U",
    "cove",
    "-d",
    "cove",
  ]);
  await command("docker", [...composeArgs, "exec", "redis", "redis-cli", "ping"]);
  await waitForHttp(`http://localhost:${String(ports.api)}/health`, "Cove API");
  await waitForHttp(`http://localhost:${String(ports.web)}`, "Cove web app");
  console.info("Cove infrastructure and application readiness checks passed.");
}

const actions = {
  setup,
  start,
  stop,
  restart: async () => {
    await stop();
    await start();
  },
  status,
  logs,
  verify,
};

if (action in actions) {
  actions[action]().catch((error) => {
    console.error(`Cove lifecycle error: ${error.message}`);
    process.exitCode = 1;
  });
} else {
  console.info("Usage: pnpm setup, start, stop, restart, status, logs, or verify");
  process.exitCode = action === "help" ? 0 : 1;
}
