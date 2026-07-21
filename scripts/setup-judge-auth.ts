import { access, chmod, mkdir, readFile, rm, writeFile } from "node:fs/promises";
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

function readUniqueValues(
  content: string,
  expression: RegExp,
  requiredKeys: readonly string[],
): Readonly<Record<string, string>> {
  const values: Record<string, string> = {};
  for (const line of content.split(/\r?\n/)) {
    const match = expression.exec(line);
    if (!match?.[1] || match[2] === undefined) continue;
    if (values[match[1]] !== undefined)
      throw new JudgeAuthSetupError("AO011_AUTH_VERIFICATION_FAILED");
    values[match[1]] = match[2].trim();
  }
  if (requiredKeys.some((key) => !values[key]))
    throw new JudgeAuthSetupError("AO011_AUTH_VERIFICATION_FAILED");
  return values;
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
  await mkdir(directory, { recursive: true, mode: 0o700 });
  if (
    !options.force &&
    ((await exists(envFile)) || (await exists(credentialsFile)) || (await exists(markerFile)))
  ) {
    throw new JudgeAuthSetupError("AO011_AUTH_EXISTS");
  }

  await rm(markerFile, { force: true });
  let result: DemoSetupResult;
  try {
    result = await (dependencies.setupAuthentication ?? setupDemoAuthentication)({
      envFile,
      credentialsFile,
      force: options.force,
    });
  } catch {
    throw new JudgeAuthSetupError("AO011_AUTH_GENERATION_FAILED");
  }

  try {
    const [environmentContent, credentialContent] = await Promise.all([
      readFile(envFile, "utf8"),
      readFile(credentialsFile, "utf8"),
    ]);
    const environmentValues = readUniqueValues(
      environmentContent,
      /^(DEMO_USERNAME|DEMO_PASSWORD_HASH|SESSION_SECRET)=(.*)$/,
      ["DEMO_USERNAME", "DEMO_PASSWORD_HASH", "SESSION_SECRET"],
    );
    const credentialValues = readUniqueValues(credentialContent, /^(Username|Password): (.*)$/, [
      "Username",
      "Password",
    ]);
    const passwordValid = await (dependencies.verify ?? verifyPassword)(
      credentialValues.Password!,
      environmentValues.DEMO_PASSWORD_HASH!,
    );
    if (
      result.username !== JUDGE_USERNAME ||
      environmentValues.DEMO_USERNAME !== JUDGE_USERNAME ||
      credentialValues.Username !== JUDGE_USERNAME ||
      result.password !== credentialValues.Password ||
      Buffer.byteLength(environmentValues.SESSION_SECRET!, "utf8") < 32 ||
      !passwordValid
    ) {
      throw new JudgeAuthSetupError("AO011_AUTH_VERIFICATION_FAILED");
    }
    await writeFile(markerFile, JUDGE_COMPLETION_MARKER_CONTENT, {
      encoding: "utf8",
      mode: 0o600,
    });
    await Promise.all([envFile, credentialsFile, markerFile].map(restrictFile));
  } catch (error) {
    await rm(markerFile, { force: true });
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
