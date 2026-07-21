import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const JUDGE_APP_CREDENTIAL_DIRECTORY = "/run/ai-orchestra-credentials";
export const JUDGE_APP_MARKER_CONTENT = "AI_ORCHESTRA_JUDGE_AUTH_V1";
export const JUDGE_APP_CREDENTIAL_FAILURE_CODE = "AO011_APP_CREDENTIALS_INVALID";
export const JUDGE_APP_START_FAILURE_CODE = "AO011_APP_START_FAILED";

const REQUIRED_KEYS = ["DEMO_USERNAME", "DEMO_PASSWORD_HASH", "SESSION_SECRET"];
const MAX_ENVIRONMENT_BYTES = 1_024;
const CONTROL_CHARACTER = /[\u0000-\u0009\u000b-\u001f\u007f]/;
const BASE64URL = /^[A-Za-z0-9_-]+$/;
const PASSWORD_HASH_PREFIX = "ai-orchestra-scrypt-v1:N=16384,r=8,p=1,l=32";
const requireModule = createRequire(import.meta.url);
const applicationDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

class JudgeAppCredentialError extends Error {
  constructor() {
    super(JUDGE_APP_CREDENTIAL_FAILURE_CODE);
    this.name = "JudgeAppCredentialError";
  }
}

class JudgeAppStartError extends Error {
  constructor() {
    super(JUDGE_APP_START_FAILURE_CODE);
    this.name = "JudgeAppStartError";
  }
}

function failCredentials() {
  throw new JudgeAppCredentialError();
}

function isCanonicalBase64url(value, minimumBytes, maximumBytes) {
  if (!BASE64URL.test(value)) return false;
  const decoded = Buffer.from(value, "base64url");
  return (
    decoded.length >= minimumBytes &&
    decoded.length <= maximumBytes &&
    decoded.toString("base64url") === value
  );
}

function passwordHashIsValid(value) {
  const parts = value.split(":");
  return (
    parts.length === 4 &&
    `${parts[0]}:${parts[1]}` === PASSWORD_HASH_PREFIX &&
    isCanonicalBase64url(parts[2] ?? "", 16, 64) &&
    isCanonicalBase64url(parts[3] ?? "", 32, 32)
  );
}

export function parseCanonicalJudgeEnvironment(content) {
  if (
    typeof content !== "string" ||
    Buffer.byteLength(content, "utf8") > MAX_ENVIRONMENT_BYTES ||
    CONTROL_CHARACTER.test(content)
  ) {
    failCredentials();
  }

  const body = content.endsWith("\n") ? content.slice(0, -1) : content;
  const lines = body.split("\n");
  if (lines.length !== REQUIRED_KEYS.length || lines.some((line) => line.length === 0))
    failCredentials();

  const values = {};
  for (const [index, key] of REQUIRED_KEYS.entries()) {
    const prefix = `${key}=`;
    const line = lines[index];
    if (!line?.startsWith(prefix)) failCredentials();
    const value = line.slice(prefix.length);
    if (!value) failCredentials();
    values[key] = value;
  }

  if (
    values.DEMO_USERNAME !== "judge-demo" ||
    !passwordHashIsValid(values.DEMO_PASSWORD_HASH) ||
    !isCanonicalBase64url(values.SESSION_SECRET, 32, 64)
  ) {
    failCredentials();
  }

  return Object.freeze(values);
}

export async function loadJudgeStartupCredentials(options = {}) {
  const directory = options.credentialDirectory ?? JUDGE_APP_CREDENTIAL_DIRECTORY;
  const read = options.readFileImpl ?? readFile;
  try {
    const [marker, environment] = await Promise.all([
      read(path.join(directory, "credentials.ready"), "utf8"),
      read(path.join(directory, "app.env"), "utf8"),
    ]);
    if (marker !== JUDGE_APP_MARKER_CONTENT) failCredentials();
    return parseCanonicalJudgeEnvironment(environment);
  } catch {
    failCredentials();
  }
}

export async function loadStandaloneServer(options = {}) {
  const environment = options.environment ?? process.env;
  const read = options.readFileImpl ?? readFile;
  const requiredFilesDocument = await read(
    path.join(applicationDirectory, ".next", "required-server-files.json"),
    "utf8",
  );
  const requiredFiles = JSON.parse(requiredFilesDocument);
  const config = requiredFiles?.config;
  if (!config || typeof config !== "object" || Array.isArray(config)) {
    throw new JudgeAppStartError();
  }

  const portText = environment.PORT ?? "3000";
  if (!/^[0-9]{1,5}$/.test(portText)) throw new JudgeAppStartError();
  const port = Number(portText);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) throw new JudgeAppStartError();

  const keepAliveText = environment.KEEP_ALIVE_TIMEOUT;
  let keepAliveTimeout;
  if (keepAliveText !== undefined) {
    if (!/^[0-9]+$/.test(keepAliveText)) throw new JudgeAppStartError();
    keepAliveTimeout = Number(keepAliveText);
    if (!Number.isSafeInteger(keepAliveTimeout)) throw new JudgeAppStartError();
  }

  environment.NODE_ENV = "production";
  environment.__NEXT_PRIVATE_STANDALONE_CONFIG = JSON.stringify(config);
  let startServer = options.startServerImpl;
  if (!startServer) {
    requireModule("next");
    ({ startServer } = requireModule("next/dist/server/lib/start-server"));
  }
  if (typeof startServer !== "function") throw new JudgeAppStartError();
  await startServer({
    dir: applicationDirectory,
    isDev: false,
    config,
    hostname: environment.HOSTNAME || "0.0.0.0",
    port,
    allowRetry: false,
    keepAliveTimeout,
  });
}

export async function startJudgeApplication(options = {}) {
  const environment = options.environment ?? process.env;
  const credentials = await loadJudgeStartupCredentials(options);
  for (const key of REQUIRED_KEYS) environment[key] = credentials[key];

  try {
    await (options.serverLoader ?? (() => loadStandaloneServer({ environment })))();
  } catch {
    throw new JudgeAppStartError();
  }
}

export async function main(options = {}) {
  try {
    await startJudgeApplication(options);
  } catch (error) {
    const code =
      error instanceof JudgeAppStartError
        ? JUDGE_APP_START_FAILURE_CODE
        : JUDGE_APP_CREDENTIAL_FAILURE_CODE;
    process.stderr.write(`${code}\n`);
    process.exitCode = 1;
  }
}

const executedPath = process.argv[1];
if (executedPath && import.meta.url === pathToFileURL(path.resolve(executedPath)).href) {
  void main();
}
