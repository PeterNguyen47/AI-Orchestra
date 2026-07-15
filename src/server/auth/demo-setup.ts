import { randomBytes } from "node:crypto";
import { chmod, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { createPasswordHash } from "./password-core";

const AUTH_KEYS = ["DEMO_USERNAME", "DEMO_PASSWORD_HASH", "SESSION_SECRET"] as const;
const DEFAULT_USERNAME = "judge-demo";

export type DemoSetupResult = Readonly<{ username: string; password: string }>;

async function readOptional(filePath: string): Promise<string> {
  try {
    return await readFile(filePath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return "";
    throw error;
  }
}

function hasAuthenticationValue(content: string): boolean {
  return content.split(/\r?\n/).some((line) => AUTH_KEYS.some((key) => line.startsWith(`${key}=`)));
}

function mergeAuthenticationValues(
  content: string,
  values: Readonly<Record<(typeof AUTH_KEYS)[number], string>>,
): string {
  const retained = content
    .split(/\r?\n/)
    .filter((line) => !AUTH_KEYS.some((key) => line.startsWith(`${key}=`)))
    .join("\n")
    .trimEnd();
  const authentication = AUTH_KEYS.map((key) => `${key}=${values[key]}`).join("\n");
  return `${retained ? `${retained}\n\n` : ""}# Local demonstration authentication only.\n${authentication}\n`;
}

async function restrictFile(filePath: string): Promise<void> {
  try {
    await chmod(filePath, 0o600);
  } catch {
    // Windows may not implement POSIX modes; ignored files remain the required boundary there.
  }
}

export async function setupDemoAuthentication(options: {
  envFile: string;
  credentialsFile: string;
  force?: boolean;
}): Promise<DemoSetupResult> {
  const envPath = path.resolve(options.envFile);
  const credentialsPath = path.resolve(options.credentialsFile);
  const existing = await readOptional(envPath);
  if (!options.force && hasAuthenticationValue(existing)) {
    throw new Error("Authentication values already exist. Re-run with --force to replace them.");
  }

  const password = randomBytes(18).toString("base64url");
  const sessionSecret = randomBytes(32).toString("base64url");
  const passwordHash = await createPasswordHash(password, randomBytes(16));

  await writeFile(
    envPath,
    mergeAuthenticationValues(existing, {
      DEMO_USERNAME: DEFAULT_USERNAME,
      DEMO_PASSWORD_HASH: passwordHash,
      SESSION_SECRET: sessionSecret,
    }),
    { encoding: "utf8", mode: 0o600 },
  );
  await writeFile(
    credentialsPath,
    [
      "AI Orchestra local demonstration credentials",
      "These credentials are for local prototype use only.",
      `Username: ${DEFAULT_USERNAME}`,
      `Password: ${password}`,
      "",
    ].join("\n"),
    { encoding: "utf8", mode: 0o600 },
  );
  await Promise.all([restrictFile(envPath), restrictFile(credentialsPath)]);

  return { username: DEFAULT_USERNAME, password };
}
