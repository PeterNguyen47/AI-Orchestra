import { readdir, readFile } from "node:fs/promises";
import { extname, join, relative } from "node:path";

const root = process.cwd();
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

const detectors = [
  {
    name: "private key",
    expression: /-----BEGIN (?:DSA |EC |OPENSSH |RSA )?PRIVATE KEY-----/g,
  },
  {
    name: "OpenAI API key",
    expression: /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/g,
  },
  {
    name: "GitHub token",
    expression: /\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,})\b/g,
  },
  {
    name: "AWS access key",
    expression: /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g,
  },
  {
    name: "credential literal",
    expression:
      /(?:api[_-]?key|password|secret|token)\s*:\s*["'](?!\$\{|<redacted>|example|placeholder|replace-with|test-value)[A-Za-z0-9/+_=.-]{20,}["']/gi,
  },
  {
    name: "credential environment assignment",
    expression:
      /^(?:[A-Z0-9_]*(?:API[_-]?KEY|PASSWORD|SECRET|TOKEN)[A-Z0-9_]*)\s*=\s*(?!\$\{|<redacted>|example|placeholder|replace-with|test-value)[A-Za-z0-9/+_=.-]{20,}\s*$/gim,
  },
];

async function collectFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (entry.isSymbolicLink()) {
      continue;
    }

    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      if (!ignoredDirectories.has(entry.name)) {
        files.push(...(await collectFiles(path)));
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

const findings = [];
const files = await collectFiles(root);

for (const file of files) {
  const content = await readFile(file, "utf8");
  if (content.includes("\0")) {
    continue;
  }

  for (const detector of detectors) {
    detector.expression.lastIndex = 0;
    if (detector.expression.test(content)) {
      findings.push(`${relative(root, file)}: ${detector.name}`);
    }
  }
}

if (findings.length > 0) {
  console.error("Potential committed secrets detected:");
  for (const finding of findings) {
    console.error(`- ${finding}`);
  }
  process.exitCode = 1;
} else {
  console.log(`Secret scan passed (${files.length} text files checked).`);
}
