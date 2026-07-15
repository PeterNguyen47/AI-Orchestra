import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { setupDemoAuthentication } from "./demo-setup";

const directories: string[] = [];
async function paths() {
  const directory = await mkdtemp(path.join(tmpdir(), "ai-orchestra-auth-"));
  directories.push(directory);
  return {
    envFile: path.join(directory, ".env.local"),
    credentialsFile: path.join(directory, ".demo-credentials.txt"),
  };
}
afterEach(async () =>
  Promise.all(
    directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })),
  ),
);

describe("demo authentication setup", () => {
  it("creates separated runtime and plaintext credential files", async () => {
    const files = await paths();
    const result = await setupDemoAuthentication(files);
    const environment = await readFile(files.envFile, "utf8");
    const credentials = await readFile(files.credentialsFile, "utf8");
    expect(environment).toContain("DEMO_USERNAME=judge-demo");
    expect(environment).toContain("DEMO_PASSWORD_HASH=ai-orchestra-scrypt-v1:");
    expect(environment).toContain("SESSION_SECRET=");
    expect(environment).not.toContain(result.password);
    expect(credentials).toContain(`Password: ${result.password}`);
    expect(credentials).not.toContain("SESSION_SECRET");
  });

  it("preserves unrelated values, refuses overwrite, and replaces only with force", async () => {
    const files = await paths();
    await writeFile(files.envFile, "UNRELATED=preserve\n", "utf8");
    const first = await setupDemoAuthentication(files);
    await expect(setupDemoAuthentication(files)).rejects.toThrow("--force");
    const second = await setupDemoAuthentication({ ...files, force: true });
    const environment = await readFile(files.envFile, "utf8");
    expect(environment).toContain("UNRELATED=preserve");
    expect(second.password).not.toBe(first.password);
  });
});
