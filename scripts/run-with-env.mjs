#!/usr/bin/env node

import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const [, , envFileArg, command, ...args] = process.argv;

if (!envFileArg || !command) {
  console.error("Usage: node scripts/run-with-env.mjs <env-file> <command> [...args]");
  process.exit(1);
}

const envFilePath = resolve(process.cwd(), envFileArg);

if (!existsSync(envFilePath)) {
  console.error(`Env file not found: ${envFileArg}`);
  process.exit(1);
}

const childEnv = { ...process.env };

for (const [key, value] of parseEnvFile(readFileSync(envFilePath, "utf8"))) {
  if (childEnv[key] === undefined) {
    childEnv[key] = value;
  }
}

const child = spawn(command, args, {
  env: childEnv,
  shell: false,
  stdio: "inherit",
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});

child.on("error", (error) => {
  console.error(error.message);
  process.exit(1);
});

function parseEnvFile(contents) {
  return contents
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .map((line) => line.replace(/^export\s+/, ""))
    .map((line) => {
      const separatorIndex = line.indexOf("=");
      if (separatorIndex === -1) {
        return undefined;
      }

      const key = line.slice(0, separatorIndex).trim();
      const rawValue = line.slice(separatorIndex + 1).trim();

      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
        return undefined;
      }

      return [key, parseValue(rawValue)];
    })
    .filter(Boolean);
}

function parseValue(value) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  const commentIndex = value.indexOf(" #");
  return (commentIndex === -1 ? value : value.slice(0, commentIndex)).trim();
}
