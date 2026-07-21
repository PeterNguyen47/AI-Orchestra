import path from "node:path";
import { pathToFileURL } from "node:url";

import { setupDemoAuthentication } from "../src/server/auth/demo-setup";

export async function setupHostDemoAuthentication(
  force: boolean,
  environment: NodeJS.ProcessEnv = process.env,
) {
  return setupDemoAuthentication({
    envFile: environment.DEMO_SETUP_ENV_FILE ?? path.join(process.cwd(), ".env.local"),
    credentialsFile:
      environment.DEMO_SETUP_CREDENTIALS_FILE ?? path.join(process.cwd(), ".demo-credentials.txt"),
    force,
  });
}

export async function main(argv: readonly string[] = process.argv.slice(2)): Promise<void> {
  const unknown = argv.filter((argument) => argument !== "--force");
  if (unknown.length > 0) {
    process.stderr.write("DEMO_SETUP_ARGUMENT_INVALID\n");
    process.exitCode = 1;
    return;
  }
  try {
    const result = await setupHostDemoAuthentication(argv.includes("--force"));
    process.stdout.write(
      [
        "Generated host-development demonstration credentials. They are not production identity.",
        `Username: ${result.username}`,
        `Password: ${result.password}`,
        "The session secret was written only to the ignored host-development environment file.",
        "",
      ].join("\n"),
    );
  } catch {
    process.stderr.write("DEMO_SETUP_FAILED\n");
    process.exitCode = 1;
  }
}

const executedPath = process.argv[1];
if (executedPath && import.meta.url === pathToFileURL(executedPath).href) void main();
