import { z } from "zod";

export const knowledgeManifestSchema = z
  .object({
    corpusId: z.string().min(1),
    version: z.literal("1.0.0"),
    documents: z
      .array(
        z
          .object({
            sourceId: z.string().regex(/^[a-z0-9-]+$/),
            title: z.string().min(1).max(120),
            file: z.string().regex(/^[a-z0-9-]+\.txt$/),
          })
          .strict(),
      )
      .min(1)
      .max(20),
  })
  .strict();

export type KnowledgeManifest = z.infer<typeof knowledgeManifestSchema>;
export type KnowledgeChunk = Readonly<{
  id: string;
  sourceId: string;
  title: string;
  text: string;
}>;
export type RetrievedChunk = KnowledgeChunk & Readonly<{ relevance: number }>;

export function validateManifest(input: unknown): KnowledgeManifest {
  const manifest = knowledgeManifestSchema.parse(input);
  for (const document of manifest.documents) {
    if (document.file.includes("..") || /^[A-Za-z]:|^[\\/]/.test(document.file))
      throw new Error("KNOWLEDGE_PATH_UNSAFE");
  }
  if (new Set(manifest.documents.map((item) => item.sourceId)).size !== manifest.documents.length)
    throw new Error("KNOWLEDGE_SOURCE_DUPLICATE");
  return manifest;
}

export function chunkDocument(
  sourceId: string,
  title: string,
  text: string,
  maximumCharacters = 900,
): KnowledgeChunk[] {
  const paragraphs = text
    .replace(/\r\n/g, "\n")
    .split(/\n\s*\n/)
    .map((part) => part.trim())
    .filter(Boolean);
  const chunks: string[] = [];
  let current = "";
  for (const paragraph of paragraphs) {
    if (paragraph.length > maximumCharacters) {
      if (current) chunks.push(current);
      current = "";
      for (let start = 0; start < paragraph.length; start += maximumCharacters)
        chunks.push(paragraph.slice(start, start + maximumCharacters));
    } else if (!current || current.length + 2 + paragraph.length <= maximumCharacters) {
      current = current ? `${current}\n\n${paragraph}` : paragraph;
    } else {
      chunks.push(current);
      current = paragraph;
    }
  }
  if (current) chunks.push(current);
  return chunks.map((chunk, index) => ({
    id: `${sourceId}#chunk-${String(index + 1).padStart(3, "0")}`,
    sourceId,
    title,
    text: chunk,
  }));
}

const tokenize = (value: string) => [
  ...new Set((value.toLowerCase().match(/[a-z0-9]{3,}/g) ?? []).filter((word) => !STOP.has(word))),
];
const STOP = new Set([
  "the",
  "and",
  "for",
  "with",
  "that",
  "this",
  "from",
  "are",
  "was",
  "what",
  "how",
]);

export function retrieveLexically(
  query: string,
  chunks: ReadonlyArray<KnowledgeChunk>,
  options: Readonly<{ topK: number; minimumRelevance: number; maximumContextCharacters: number }>,
): RetrievedChunk[] {
  const terms = tokenize(query);
  if (terms.length === 0) return [];
  let used = 0;
  return chunks
    .map((chunk) => {
      const haystack = new Set(tokenize(`${chunk.title} ${chunk.text}`));
      const matches = terms.filter((term) => haystack.has(term)).length;
      return { ...chunk, relevance: matches / terms.length };
    })
    .filter((chunk) => chunk.relevance > 0 && chunk.relevance >= options.minimumRelevance)
    .sort((a, b) => b.relevance - a.relevance || a.id.localeCompare(b.id))
    .filter((chunk) => {
      if (used + chunk.text.length > options.maximumContextCharacters) return false;
      used += chunk.text.length;
      return true;
    })
    .slice(0, options.topK);
}
