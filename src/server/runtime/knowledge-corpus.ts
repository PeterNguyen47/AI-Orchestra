import "server-only";

import { readFileSync } from "node:fs";
import path from "node:path";
import { chunkDocument, validateManifest, type KnowledgeChunk } from "@/domain/runtime/retrieval";

const CORPUS_ROOT = path.resolve(process.cwd(), "knowledge", "enterprise-rag");

export function loadEnterpriseRagCorpus(): KnowledgeChunk[] {
  const manifestPath = path.join(CORPUS_ROOT, "manifest.json");
  const manifest = validateManifest(JSON.parse(readFileSync(manifestPath, "utf8")));
  return manifest.documents.flatMap((document) => {
    const resolved = path.resolve(CORPUS_ROOT, document.file);
    if (path.dirname(resolved) !== CORPUS_ROOT) throw new Error("KNOWLEDGE_PATH_UNSAFE");
    return chunkDocument(document.sourceId, document.title, readFileSync(resolved, "utf8"));
  });
}
