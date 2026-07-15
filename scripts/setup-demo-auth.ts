import path from "node:path";

import { setupDemoAuthentication } from "../src/server/auth/demo-setup";

const force = process.argv.slice(2).includes("--force");
const envFile = process.env.DEMO_SETUP_ENV_FILE ?? path.join(process.cwd(), ".env.local");
const credentialsFile =
  process.env.DEMO_SETUP_CREDENTIALS_FILE ?? path.join(process.cwd(), ".demo-credentials.txt");

async function main(): Promise<void> {
  try {
    const result = await setupDemoAuthentication({ envFile, credentialsFile, force });
    process.stdout.write(
      [
        "Generated local demonstration credentials. They are not production identity.",
        `Username: ${result.username}`,
        `Password: ${result.password}`,
        `Credentials file: ${credentialsFile}`,
        "The session secret was written only to the ignored environment file.",
        "",
      ].join("\n"),
    );
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : "Demo setup failed."}\n`);
    process.exitCode = 1;
  }
}

void main();
