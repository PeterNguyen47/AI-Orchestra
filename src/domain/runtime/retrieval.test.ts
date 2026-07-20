import { describe, expect, it } from "vitest";
import { chunkDocument, retrieveLexically, validateManifest } from "./retrieval";

describe("knowledge retrieval", () => {
  it("rejects traversal and absolute paths", () => {
    const base = {
      corpusId: "x",
      version: "1.0.0",
      documents: [{ sourceId: "x", title: "X", file: "x.txt" }],
    };
    expect(() =>
      validateManifest({ ...base, documents: [{ ...base.documents[0], file: "../x.txt" }] }),
    ).toThrow();
    expect(() =>
      validateManifest({ ...base, documents: [{ ...base.documents[0], file: "C:\\x.txt" }] }),
    ).toThrow();
  });

  it("chunks and ranks deterministically with stable tie breaking", () => {
    const chunks = [
      ...chunkDocument("z-source", "Governance", "runtime governance controls"),
      ...chunkDocument("a-source", "Governance", "runtime governance controls"),
    ];
    const results = retrieveLexically("runtime governance", chunks, {
      topK: 2,
      minimumRelevance: 0.5,
      maximumContextCharacters: 2_000,
    });
    expect(results.map((item) => item.id)).toEqual(["a-source#chunk-001", "z-source#chunk-001"]);
  });

  it("returns no match for unrelated queries", () => {
    expect(
      retrieveLexically("volcanic geology", chunkDocument("x", "Runtime", "governed workflow"), {
        topK: 5,
        minimumRelevance: 0.1,
        maximumContextCharacters: 500,
      }),
    ).toEqual([]);
  });

  it("rejects duplicate source IDs and deterministically splits long and paragraph content", () => {
    expect(() =>
      validateManifest({
        corpusId: "x",
        version: "1.0.0",
        documents: [
          { sourceId: "same", title: "One", file: "one.txt" },
          { sourceId: "same", title: "Two", file: "two.txt" },
        ],
      }),
    ).toThrow("KNOWLEDGE_SOURCE_DUPLICATE");
    expect(chunkDocument("x", "X", "123456789\n\nabc\n\ndef", 5).map((item) => item.text)).toEqual([
      "12345",
      "6789",
      "abc",
      "def",
    ]);
  });

  it("applies context and top-k bounds after scoring", () => {
    const chunks = [
      { id: "a", sourceId: "a", title: "alpha", text: "alpha one" },
      { id: "b", sourceId: "b", title: "alpha", text: "alpha two" },
    ];
    expect(
      retrieveLexically("alpha", chunks, {
        topK: 1,
        minimumRelevance: 1,
        maximumContextCharacters: 100,
      }).map((item) => item.id),
    ).toEqual(["a"]);
    expect(
      retrieveLexically("alpha", chunks, {
        topK: 2,
        minimumRelevance: 1,
        maximumContextCharacters: 5,
      }),
    ).toEqual([]);
  });
});
