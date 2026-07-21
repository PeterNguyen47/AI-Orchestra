import { readdir, readFile } from "node:fs/promises";
import { extname, join, relative } from "node:path";
import { pathToFileURL } from "node:url";

const ignoredDirectories = new Set([
  ".git",
  ".next",
  "coverage",
  "node_modules",
  "playwright-report",
  "test-results",
]);
const ignoredLocalFiles = new Set([".demo-credentials.txt", ".env.local"]);
const binaryExtensions = new Set([
  ".gif",
  ".ico",
  ".jpeg",
  ".jpg",
  ".pdf",
  ".png",
  ".webp",
  ".woff",
  ".woff2",
]);

export const secretDetectors = Object.freeze([
  {
    name: "private key",
    expression: /-----BEGIN (?:ENCRYPTED |(?:DSA|EC|OPENSSH|RSA) )?PRIVATE KEY-----/i,
  },
  {
    name: "OpenAI API key",
    expression: /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/,
  },
  {
    name: "GitHub token",
    expression: /\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,})\b/,
  },
  {
    name: "AWS access key",
    expression: /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/,
  },
  {
    name: "bearer credential",
    expression:
      /\bbearer[ \t]+(?!(?:example|fixture|placeholder|synthetic|test)[_-])[A-Za-z0-9._~+/-]{20,}={0,2}\b/i,
  },
  {
    name: "credential literal",
    expression:
      /\b(?:api[_-]?key|authorization|credential|password|passphrase|secret|session|token)[ \t]*:[ \t]*["'](?!\$\{|<redacted>|example|placeholder|replace-with|test-value)[A-Za-z0-9/+_=.-]{20,}["']/i,
  },
  {
    name: "credential environment assignment",
    expression:
      /^(?:[A-Z0-9_]*(?:API[_-]?KEY|AUTHORIZATION|CREDENTIAL|PASSWORD|PASSPHRASE|SECRET|SESSION|TOKEN)[A-Z0-9_]*)[ \t]*=[ \t]*(?!\$\{|<redacted>|example|placeholder|replace-with|test-value)[A-Za-z0-9/+_=.-]{20,}[ \t]*$/im,
  },
]);

export async function collectSecretScanFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (entry.isSymbolicLink()) continue;

    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      if (!ignoredDirectories.has(entry.name)) {
        files.push(...(await collectSecretScanFiles(path)));
      }
      continue;
    }

    if (
      entry.isFile() &&
      !ignoredLocalFiles.has(entry.name) &&
      !binaryExtensions.has(extname(entry.name).toLowerCase())
    ) {
      files.push(path);
    }
  }

  return files;
}

export function detectSecretNames(content) {
  if (content.includes("\0")) return [];
  return secretDetectors
    .filter((detector) => detector.expression.test(content))
    .map((detector) => detector.name);
}

export async function scanRepositoryForSecrets(root = process.cwd()) {
  const files = await collectSecretScanFiles(root);
  const findings = [];

  for (const file of files) {
    const content = await readFile(file, "utf8");
    for (const detectorName of detectSecretNames(content)) {
      findings.push(`${relative(root, file)}: ${detectorName}`);
    }
  }

  return { filesChecked: files.length, findings };
}

export async function main(root = process.cwd()) {
  const result = await scanRepositoryForSecrets(root);
  if (result.findings.length > 0) {
    console.error("Potential committed secrets detected:");
    for (const finding of result.findings) console.error(`- ${finding}`);
    process.exitCode = 1;
    return result;
  }

  console.log(`Secret scan passed (${result.filesChecked} text files checked).`);
  return result;
}

const executedPath = process.argv[1];
if (executedPath && import.meta.url === pathToFileURL(executedPath).href) {
  void main().catch(() => {
    console.error("Secret scan failed safely.");
    process.exitCode = 1;
  });
}
