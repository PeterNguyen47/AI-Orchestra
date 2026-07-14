import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import { generateWorkflowJsonSchemaText } from "../src/domain/workflow/workflow-json-schema";

const schemaPath = resolve(process.cwd(), "schemas", "workflow.v1.schema.json");

async function writeSchema(expected: string): Promise<void> {
  await mkdir(dirname(schemaPath), { recursive: true });
  await writeFile(schemaPath, expected, "utf8");
  console.log(`Generated ${schemaPath}`);
}

async function checkSchema(expected: string): Promise<void> {
  let actual: string;

  try {
    actual = await readFile(schemaPath, "utf8");
  } catch {
    throw new Error("The committed workflow JSON Schema is missing. Run npm run schema:generate.");
  }

  if (actual !== expected) {
    throw new Error(
      "The committed workflow JSON Schema differs from the Zod source. Run npm run schema:generate and commit the result.",
    );
  }

  console.log("Committed workflow JSON Schema matches the canonical Zod source.");
}

async function main(): Promise<void> {
  const [mode, ...unexpectedArguments] = process.argv.slice(2);

  if (unexpectedArguments.length > 0 || (mode !== "--write" && mode !== "--check")) {
    throw new Error("Usage: tsx scripts/workflow-json-schema.ts --write|--check");
  }

  const expected = generateWorkflowJsonSchemaText();

  if (mode === "--write") {
    await writeSchema(expected);
    return;
  }

  await checkSchema(expected);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "JSON Schema command failed.");
  process.exitCode = 1;
});
