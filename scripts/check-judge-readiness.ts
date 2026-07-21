import { readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { chunkDocument, validateManifest } from "../src/domain/runtime/retrieval";
import { verifyPassword } from "../src/server/auth/password-core";
import {
  JUDGE_COMPLETION_MARKER,
  JUDGE_COMPLETION_MARKER_CONTENT,
  JUDGE_CREDENTIAL_DIRECTORY,
  JUDGE_ENV_FILE,
  JUDGE_PLAINTEXT_FILE,
} from "./setup-judge-auth";

export const AO011_READY_CODE = "AO011_READY";
export const AO011_READINESS_FAILURE_CODES = [
  "AO011_CREDENTIALS_INCOMPLETE",
  "AO011_CREDENTIALS_INVALID",
  "AO011_MODE_INVALID",
  "AO011_HEALTH_INVALID",
  "AO011_LOGIN_UNAVAILABLE",
  "AO011_PROTECTED_ROUTE_INVALID",
  "AO011_CORPUS_UNAVAILABLE",
  "AO011_READINESS_TIMEOUT",
  "AO011_READINESS_FAILED",
] as const;
type FailureCode = (typeof AO011_READINESS_FAILURE_CODES)[number];

export class JudgeReadinessError extends Error {
  constructor(readonly code: FailureCode) {
    super(code);
    this.name = "JudgeReadinessError";
  }
}

type CredentialMaterial = Readonly<{
  marker: string;
  environment: string;
  plaintext: string;
}>;
export type JudgeReadinessDependencies = Readonly<{
  fetcher?: typeof fetch;
  clock?: () => number;
  wait?: (milliseconds: number) => Promise<void>;
  credentialReader?: (directory: string) => Promise<CredentialMaterial>;
  corpusLoader?: () => Promise<ReadonlyArray<unknown>> | ReadonlyArray<unknown>;
  passwordVerifier?: typeof verifyPassword;
}>;

async function readCredentialMaterial(directory: string): Promise<CredentialMaterial> {
  const [marker, environment, plaintext] = await Promise.all([
    readFile(path.join(directory, JUDGE_COMPLETION_MARKER), "utf8"),
    readFile(path.join(directory, JUDGE_ENV_FILE), "utf8"),
    readFile(path.join(directory, JUDGE_PLAINTEXT_FILE), "utf8"),
  ]);
  return { marker, environment, plaintext };
}

function uniqueValues(
  content: string,
  expression: RegExp,
  required: readonly string[],
): Readonly<Record<string, string>> {
  const values: Record<string, string> = {};
  for (const line of content.split(/\r?\n/)) {
    const match = expression.exec(line);
    if (!match?.[1] || match[2] === undefined) continue;
    if (values[match[1]] !== undefined) throw new JudgeReadinessError("AO011_CREDENTIALS_INVALID");
    values[match[1]] = match[2].trim();
  }
  if (required.some((key) => !values[key]))
    throw new JudgeReadinessError("AO011_CREDENTIALS_INVALID");
  return values;
}

async function loadCanonicalCorpus(): Promise<ReadonlyArray<unknown>> {
  const root = path.resolve(process.cwd(), "knowledge", "enterprise-rag");
  const manifest = validateManifest(
    JSON.parse(await readFile(path.join(root, "manifest.json"), "utf8")),
  );
  return (
    await Promise.all(
      manifest.documents.map(async (document) => {
        const resolved = path.resolve(root, document.file);
        if (path.dirname(resolved) !== root) throw new Error("CORPUS_PATH_INVALID");
        return chunkDocument(document.sourceId, document.title, await readFile(resolved, "utf8"));
      }),
    )
  ).flat();
}

function healthIsValid(response: Response, value: unknown): boolean {
  if (!response.ok || !response.headers.get("cache-control")?.toLowerCase().includes("no-store"))
    return false;
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  if (
    JSON.stringify(Object.keys(record).sort()) !==
    JSON.stringify(["service", "status", "timestamp", "version"])
  )
    return false;
  return (
    record.status === "ok" &&
    typeof record.service === "string" &&
    record.service.length > 0 &&
    typeof record.version === "string" &&
    /^\d+\.\d+\.\d+/.test(record.version) &&
    typeof record.timestamp === "string" &&
    Number.isFinite(Date.parse(record.timestamp))
  );
}

export async function checkJudgeReadiness(
  environment: Readonly<Record<string, string | undefined>> = process.env,
  dependencies: JudgeReadinessDependencies = {},
): Promise<typeof AO011_READY_CODE> {
  const directory = path.resolve(
    environment.AI_ORCHESTRA_JUDGE_CREDENTIAL_DIRECTORY ?? JUDGE_CREDENTIAL_DIRECTORY,
  );
  let material: CredentialMaterial;
  try {
    material = await (dependencies.credentialReader ?? readCredentialMaterial)(directory);
  } catch {
    throw new JudgeReadinessError("AO011_CREDENTIALS_INCOMPLETE");
  }
  if (material.marker !== JUDGE_COMPLETION_MARKER_CONTENT)
    throw new JudgeReadinessError("AO011_CREDENTIALS_INCOMPLETE");

  const environmentValues = uniqueValues(
    material.environment,
    /^(DEMO_USERNAME|DEMO_PASSWORD_HASH|SESSION_SECRET)=(.*)$/,
    ["DEMO_USERNAME", "DEMO_PASSWORD_HASH", "SESSION_SECRET"],
  );
  const plaintextValues = uniqueValues(material.plaintext, /^(Username|Password): (.*)$/, [
    "Username",
    "Password",
  ]);
  if (
    environmentValues.DEMO_USERNAME !== plaintextValues.Username ||
    Buffer.byteLength(environmentValues.SESSION_SECRET!, "utf8") < 32 ||
    !(await (dependencies.passwordVerifier ?? verifyPassword)(
      plaintextValues.Password!,
      environmentValues.DEMO_PASSWORD_HASH!,
    ))
  ) {
    throw new JudgeReadinessError("AO011_CREDENTIALS_INVALID");
  }
  if (environment.AI_ORCHESTRA_EXECUTION_MODE !== "judge_fixture")
    throw new JudgeReadinessError("AO011_MODE_INVALID");

  const fetcher = dependencies.fetcher ?? fetch;
  const clock = dependencies.clock ?? Date.now;
  const wait =
    dependencies.wait ??
    ((milliseconds: number) => new Promise<void>((resolve) => setTimeout(resolve, milliseconds)));
  const deadline = clock() + 120_000;
  let healthResponse: Response | undefined;
  while (clock() <= deadline) {
    try {
      healthResponse = await fetcher("http://app:3000/api/health", {
        redirect: "manual",
        signal: AbortSignal.timeout(3_000),
      });
      break;
    } catch {
      if (clock() >= deadline) throw new JudgeReadinessError("AO011_READINESS_TIMEOUT");
      await wait(250);
    }
  }
  if (!healthResponse) throw new JudgeReadinessError("AO011_READINESS_TIMEOUT");
  let health: unknown;
  try {
    health = await healthResponse.json();
  } catch {
    throw new JudgeReadinessError("AO011_HEALTH_INVALID");
  }
  if (!healthIsValid(healthResponse, health)) throw new JudgeReadinessError("AO011_HEALTH_INVALID");

  const login = await fetcher("http://app:3000/login", {
    redirect: "manual",
    signal: AbortSignal.timeout(3_000),
  }).catch(() => undefined);
  if (!login?.ok) throw new JudgeReadinessError("AO011_LOGIN_UNAVAILABLE");
  const protectedRoute = await fetcher("http://app:3000/orchestrator", {
    redirect: "manual",
    signal: AbortSignal.timeout(3_000),
  }).catch(() => undefined);
  const location = protectedRoute?.headers.get("location");
  if (
    !protectedRoute ||
    ![302, 303, 307, 308].includes(protectedRoute.status) ||
    !location ||
    new URL(location, "http://app:3000").pathname !== "/login"
  ) {
    throw new JudgeReadinessError("AO011_PROTECTED_ROUTE_INVALID");
  }
  try {
    if ((await (dependencies.corpusLoader ?? loadCanonicalCorpus)()).length === 0)
      throw new Error("CORPUS_EMPTY");
  } catch {
    throw new JudgeReadinessError("AO011_CORPUS_UNAVAILABLE");
  }
  return AO011_READY_CODE;
}

export async function main(): Promise<void> {
  try {
    process.stdout.write(`${await checkJudgeReadiness()}\n`);
  } catch (error) {
    const code = error instanceof JudgeReadinessError ? error.code : "AO011_READINESS_FAILED";
    process.stderr.write(`${code}\n`);
    process.exitCode = 1;
  }
}

const executedPath = process.argv[1];
if (executedPath && import.meta.url === pathToFileURL(executedPath).href) void main();
