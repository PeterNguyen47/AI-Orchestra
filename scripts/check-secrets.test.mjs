import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { detectSecretNames, scanRepositoryForSecrets } from "./check-secrets.mjs";

const temporaryRoots = [];

afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map((root) => rm(root, { force: true, recursive: true })),
  );
});

describe("committed secret scanner", () => {
  it("detects every supported private-key header without storing key material", () => {
    const begin = ["-----", "BEGIN", " "].join("");
    const end = ["PRIVATE", "KEY-----"].join(" ");
    const headers = ["", "ENCRYPTED ", "DSA ", "EC ", "OPENSSH ", "RSA "].map(
      (kind) => `${begin}${kind}${end}`,
    );

    for (const header of headers) {
      const result = detectSecretNames(header);
      expect(result).toContain("private key");
      expect(JSON.stringify(result)).not.toContain(header);
    }
  });

  it("detects bounded bearer and credential assignments by detector name only", () => {
    const bearerValue = ["Bearer", "scanvalue".repeat(3)].join(" ");
    const literalValue = ["api", "key"].join("_") + ': "' + "a".repeat(24) + '"';
    const assignmentValue = ["SESSION", "TOKEN"].join("_") + "=" + "b".repeat(24);

    expect(detectSecretNames(bearerValue)).toEqual(["bearer credential"]);
    expect(detectSecretNames(literalValue)).toEqual(["credential literal"]);
    expect(detectSecretNames(assignmentValue)).toEqual(["credential environment assignment"]);
    expect(
      JSON.stringify(detectSecretNames(`${bearerValue}\n${literalValue}\n${assignmentValue}`)),
    ).not.toContain("scanvalue");
  });

  it("preserves ignored directories, local files, binary files, and NUL-file exclusions", async () => {
    const root = await mkdtemp(join(tmpdir(), "ao010-secret-scan-"));
    temporaryRoots.push(root);
    await mkdir(join(root, ".git"));
    const runtimeValue = ["Bearer", "scanruntimevalue".repeat(2)].join(" ");
    await writeFile(join(root, ".git", "ignored.txt"), runtimeValue);
    await writeFile(join(root, ".env.local"), runtimeValue);
    await writeFile(join(root, "ignored.png"), runtimeValue);
    await writeFile(join(root, "nul.txt"), `${runtimeValue}\0`);
    await writeFile(join(root, "safe.txt"), "schema reference only");
    await writeFile(join(root, "detected.txt"), runtimeValue);

    const result = await scanRepositoryForSecrets(root);

    expect(result).toEqual({ filesChecked: 3, findings: ["detected.txt: bearer credential"] });
    expect(JSON.stringify(result)).not.toContain("scanruntimevalue");
  });
});
