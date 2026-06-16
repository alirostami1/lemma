import { mkdir, open, readFile, rm, stat } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";

const cwd = process.cwd();
const lockDirectory = path.join(cwd, "node_modules", ".cache", "lemma");
const lockPath = path.join(lockDirectory, "openapi-generator.lock");

await mkdir(lockDirectory, { recursive: true });
await withPackageLock(lockPath, () => runOrval());

async function withPackageLock(file, run) {
  const lock = await acquireLock(file);
  try {
    await run();
  } finally {
    await lock.close();
    await rm(file, { force: true });
  }
}

async function acquireLock(file) {
  for (;;) {
    try {
      const handle = await open(file, "wx");
      await handle.writeFile(`${process.pid}\n`);
      return handle;
    } catch (error) {
      if (!isAlreadyLocked(error)) {
        throw error;
      }
      if (await removeStaleLock(file)) {
        continue;
      }
      await sleep(100);
    }
  }
}

async function removeStaleLock(file) {
  const ownerPid = await readLockOwnerPid(file);
  if (ownerPid !== null) {
    if (isProcessAlive(ownerPid)) {
      return false;
    }
    await rm(file, { force: true });
    return true;
  }
  if (!(await isOldLock(file))) {
    return false;
  }
  await rm(file, { force: true });
  return true;
}

async function readLockOwnerPid(file) {
  try {
    const value = (await readFile(file, "utf8")).trim();
    if (!/^\d+$/u.test(value)) {
      return null;
    }
    return Number(value);
  } catch {
    return null;
  }
}

function runOrval() {
  return new Promise((resolve, reject) => {
    const child = spawn("pnpm", ["exec", "orval"], {
      cwd,
      stdio: "inherit",
    });

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`orval exited with code ${code ?? "unknown"}`));
    });
  });
}

function isAlreadyLocked(error) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "EEXIST"
  );
}

function isProcessAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function isOldLock(file) {
  try {
    const stats = await stat(file);
    return Date.now() - stats.mtimeMs > 30_000;
  } catch {
    return true;
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
