import { access, chmod, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { setupDemoAuthentication, type DemoSetupResult } from "../src/server/auth/demo-setup";
import { verifyPassword } from "../src/server/auth/password-core";

export const JUDGE_CREDENTIAL_DIRECTORY = "/run/ai-orchestra-credentials";
export const JUDGE_ENV_FILE = "app.env";
export const JUDGE_PLAINTEXT_FILE = "judge-credentials.txt";
export const JUDGE_COMPLETION_MARKER = "credentials.ready";
export const JUDGE_COMPLETION_MARKER_CONTENT = "AI_ORCHESTRA_JUDGE_AUTH_V1";
export const JUDGE_USERNAME = "judge-demo";
export const JUDGE_AUTH_SUCCESS_CODE = "AO011_AUTH_READY";

const JUDGE_ENVIRONMENT_HEADER = "# Local demonstration authentication only.";
const JUDGE_PLAINTEXT_HEADERS = [
  "AI Orchestra local demonstration credentials",
  "These credentials are for local prototype use only.",
] as const;
const JUDGE_ENVIRONMENT_KEYS = ["DEMO_USERNAME", "DEMO_PASSWORD_HASH", "SESSION_SECRET"] as const;
const CONTROL_CHARACTER = /[\u0000-\u0009\u000b-\u001f\u007f]/;
const BASE64URL = /^[A-Za-z0-9_-]+$/;
const PASSWORD_HASH_PREFIX = "ai-orchestra-scrypt-v1:N=16384,r=8,p=1,l=32";

export type CanonicalJudgeEnvironment = Readonly<{
  DEMO_USERNAME: string;
  DEMO_PASSWORD_HASH: string;
  SESSION_SECRET: string;
}>;

export type CanonicalJudgePlaintextCredentials = Readonly<{
  Username: string;
  Password: string;
}>;

type SetupDependencies = Readonly<{
  setupAuthentication?: typeof setupDemoAuthentication;
  verify?: typeof verifyPassword;
}>;

export class JudgeAuthSetupError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = "JudgeAuthSetupError";
  }
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function restrictFile(filePath: string): Promise<void> {
  try {
    await chmod(filePath, 0o600);
  } catch {
    // Windows bind-host semantics may not implement POSIX modes; Docker volumes use Linux modes.
  }
}

function verificationFailure(): never {
  throw new JudgeAuthSetupError("AO011_AUTH_VERIFICATION_FAILED");
}

function exactLines(content: string, count: number): readonly string[] {
  if (Buffer.byteLength(content, "utf8") > 4_096 || CONTROL_CHARACTER.test(content))
    verificationFailure();
  const body = content.endsWith("\n") ? content.slice(0, -1) : content;
  const lines = body.split("\n");
  if (lines.length !== count || lines.some((line) => line.length === 0)) verificationFailure();
  return lines;
}

function isCanonicalBase64url(value: string, minimumBytes: number, maximumBytes: number): boolean {
  if (!BASE64URL.test(value)) return false;
  const decoded = Buffer.from(value, "base64url");
  return (
    decoded.length >= minimumBytes &&
    decoded.length <= maximumBytes &&
    decoded.toString("base64url") === value
  );
}

function passwordHashIsValid(value: string): boolean {
  const parts = value.split(":");
  return (
    parts.length === 4 &&
    `${parts[0]}:${parts[1]}` === PASSWORD_HASH_PREFIX &&
    isCanonicalBase64url(parts[2] ?? "", 16, 64) &&
    isCanonicalBase64url(parts[3] ?? "", 32, 32)
  );
}

function parseEnvironmentLines(lines: readonly string[]): CanonicalJudgeEnvironment {
  const values: Record<string, string> = {};
  for (const [index, key] of JUDGE_ENVIRONMENT_KEYS.entries()) {
    const prefix = `${key}=`;
    const line = lines[index];
    if (!line?.startsWith(prefix)) verificationFailure();
    const value = line.slice(prefix.length);
    if (!value) verificationFailure();
    values[key] = value;
  }
  if (
    values.DEMO_USERNAME !== JUDGE_USERNAME ||
    !passwordHashIsValid(values.DEMO_PASSWORD_HASH!) ||
    !isCanonicalBase64url(values.SESSION_SECRET!, 32, 64)
  ) {
    verificationFailure();
  }
  return Object.freeze({
    DEMO_USERNAME: values.DEMO_USERNAME!,
    DEMO_PASSWORD_HASH: values.DEMO_PASSWORD_HASH!,
    SESSION_SECRET: values.SESSION_SECRET!,
  });
}

export function parseCanonicalJudgeEnvironment(content: string): CanonicalJudgeEnvironment {
  return parseEnvironmentLines(exactLines(content, JUDGE_ENVIRONMENT_KEYS.length));
}

export function serializeCanonicalJudgeEnvironment(values: CanonicalJudgeEnvironment): string {
  return `${JUDGE_ENVIRONMENT_KEYS.map((key) => `${key}=${values[key]}`).join("\n")}\n`;
}

export function parseGeneratedJudgeEnvironment(content: string): CanonicalJudgeEnvironment {
  const lines = exactLines(content, JUDGE_ENVIRONMENT_KEYS.length + 1);
  if (lines[0] !== JUDGE_ENVIRONMENT_HEADER) verificationFailure();
  return parseEnvironmentLines(lines.slice(1));
}

export function parseCanonicalJudgePlaintextCredentials(
  content: string,
): CanonicalJudgePlaintextCredentials {
  const lines = exactLines(content, 4);
  if (lines[0] !== JUDGE_PLAINTEXT_HEADERS[0] || lines[1] !== JUDGE_PLAINTEXT_HEADERS[1])
    verificationFailure();
  const usernamePrefix = "Username: ";
  const passwordPrefix = "Password: ";
  if (!lines[2]?.startsWith(usernamePrefix) || !lines[3]?.startsWith(passwordPrefix))
    verificationFailure();
  const Username = lines[2].slice(usernamePrefix.length);
  const Password = lines[3].slice(passwordPrefix.length);
  if (Username !== JUDGE_USERNAME || !isCanonicalBase64url(Password, 18, 18)) verificationFailure();
  return Object.freeze({ Username, Password });
}

export function parseJudgeAuthArguments(argv: readonly string[]) {
  if (argv.some((argument) => argument !== "--force" && argument !== "--quiet"))
    throw new JudgeAuthSetupError("AO011_AUTH_ARGUMENT_INVALID");
  return Object.freeze({ force: argv.includes("--force"), quiet: argv.includes("--quiet") });
}

export async function setupJudgeAuthentication(
  argv: readonly string[],
  environment: Readonly<Record<string, string | undefined>> = process.env,
  dependencies: SetupDependencies = {},
): Promise<DemoSetupResult & { quiet: boolean }> {
  const options = parseJudgeAuthArguments(argv);
  const directory = path.resolve(
    environment.AI_ORCHESTRA_JUDGE_CREDENTIAL_DIRECTORY ?? JUDGE_CREDENTIAL_DIRECTORY,
  );
  const envFile = path.join(directory, JUDGE_ENV_FILE);
  const credentialsFile = path.join(directory, JUDGE_PLAINTEXT_FILE);
  const markerFile = path.join(directory, JUDGE_COMPLETION_MARKER);
  const temporaryEnvFile = path.join(directory, `${JUDGE_ENV_FILE}.tmp`);
  await mkdir(directory, { recursive: true, mode: 0o700 });
  if (
    !options.force &&
    ((await exists(envFile)) ||
      (await exists(credentialsFile)) ||
      (await exists(markerFile)) ||
      (await exists(temporaryEnvFile)))
  ) {
    throw new JudgeAuthSetupError("AO011_AUTH_EXISTS");
  }

  await rm(markerFile, { force: true });
  await rm(temporaryEnvFile, { force: true });
  if (options.force)
    await Promise.all([rm(envFile, { force: true }), rm(credentialsFile, { force: true })]);
  let result: DemoSetupResult;
  try {
    result = await (dependencies.setupAuthentication ?? setupDemoAuthentication)({
      envFile,
      credentialsFile,
      force: options.force,
    });
  } catch {
    await Promise.all([rm(markerFile, { force: true }), rm(temporaryEnvFile, { force: true })]);
    throw new JudgeAuthSetupError("AO011_AUTH_GENERATION_FAILED");
  }

  try {
    const [environmentContent, credentialContent] = await Promise.all([
      readFile(envFile, "utf8"),
      readFile(credentialsFile, "utf8"),
    ]);
    const environmentValues = parseGeneratedJudgeEnvironment(environmentContent);
    const credentialValues = parseCanonicalJudgePlaintextCredentials(credentialContent);
    const passwordValid = await (dependencies.verify ?? verifyPassword)(
      credentialValues.Password,
      environmentValues.DEMO_PASSWORD_HASH,
    );
    if (
      result.username !== JUDGE_USERNAME ||
      environmentValues.DEMO_USERNAME !== JUDGE_USERNAME ||
      credentialValues.Username !== JUDGE_USERNAME ||
      result.password !== credentialValues.Password ||
      !passwordValid
    ) {
      throw new JudgeAuthSetupError("AO011_AUTH_VERIFICATION_FAILED");
    }

    const canonicalEnvironment = serializeCanonicalJudgeEnvironment(environmentValues);
    await writeFile(temporaryEnvFile, canonicalEnvironment, { encoding: "utf8", mode: 0o600 });
    parseCanonicalJudgeEnvironment(await readFile(temporaryEnvFile, "utf8"));
    await rm(envFile, { force: true });
    await rename(temporaryEnvFile, envFile);
    const finalEnvironment = parseCanonicalJudgeEnvironment(await readFile(envFile, "utf8"));
    if (
      finalEnvironment.DEMO_USERNAME !== environmentValues.DEMO_USERNAME ||
      finalEnvironment.DEMO_PASSWORD_HASH !== environmentValues.DEMO_PASSWORD_HASH ||
      finalEnvironment.SESSION_SECRET !== environmentValues.SESSION_SECRET
    ) {
      verificationFailure();
    }

    await Promise.all([envFile, credentialsFile].map(restrictFile));
    await writeFile(markerFile, JUDGE_COMPLETION_MARKER_CONTENT, {
      encoding: "utf8",
      mode: 0o600,
    });
    await restrictFile(markerFile);
  } catch (error) {
    await Promise.all([rm(markerFile, { force: true }), rm(temporaryEnvFile, { force: true })]);
    if (error instanceof JudgeAuthSetupError) throw error;
    throw new JudgeAuthSetupError("AO011_AUTH_VERIFICATION_FAILED");
  }

  return { ...result, quiet: options.quiet };
}

export async function main(argv: readonly string[] = process.argv.slice(2)): Promise<void> {
  try {
    const result = await setupJudgeAuthentication(argv);
    process.stdout.write(
      result.quiet
        ? `${JUDGE_AUTH_SUCCESS_CODE}\n`
        : [
            "Local demonstration credential: store it only for this judge session.",
            `Username: ${result.username}`,
            `Password: ${result.password}`,
            "The session secret is retained only in the removable credential volume.",
            "",
          ].join("\n"),
    );
  } catch (error) {
    const code = error instanceof JudgeAuthSetupError ? error.code : "AO011_AUTH_GENERATION_FAILED";
    process.stderr.write(`${code}\n`);
    process.exitCode = 1;
  }
}

const executedPath = process.argv[1];
if (executedPath && import.meta.url === pathToFileURL(executedPath).href) void main();
