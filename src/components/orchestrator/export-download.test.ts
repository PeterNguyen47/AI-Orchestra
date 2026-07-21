import { describe, expect, it } from "vitest";
import {
  downloadableTextArtifactSchema,
  WORKFLOW_EXPORT_ARTIFACT_TYPE,
  WORKFLOW_EXPORT_MIME_TYPE,
  WORKFLOW_EXPORT_SCHEMA_VERSION,
} from "@/domain/exports/export-contracts";
import { downloadTextArtifact, type DownloadBoundary } from "./export-download";

const artifact = downloadableTextArtifactSchema.parse({
  artifactType: WORKFLOW_EXPORT_ARTIFACT_TYPE,
  schemaVersion: WORKFLOW_EXPORT_SCHEMA_VERSION,
  filename: "ai-orchestra-enterprise-rag.workflow-export.v1.0.0.json",
  mimeType: WORKFLOW_EXPORT_MIME_TYPE,
  text: "{}\n",
  byteLength: 3,
});

function fakeBoundary(options: { failCreate?: boolean; failClick?: boolean } = {}) {
  const events: string[] = [];
  const blobs: Array<{ parts: BlobPart[]; options?: BlobPropertyBag }> = [];
  const anchor = {
    href: "",
    download: "",
    click: () => {
      events.push("click");
      if (options.failClick) throw new Error("synthetic click failure");
    },
  } as unknown as HTMLAnchorElement;
  class FakeBlob {
    constructor(parts: BlobPart[], blobOptions?: BlobPropertyBag) {
      blobs.push({ parts, ...(blobOptions ? { options: blobOptions } : {}) });
    }
  }
  const boundary = {
    Blob: FakeBlob as unknown as typeof Blob,
    URL: {
      createObjectURL: () => {
        events.push("create-url");
        return "blob:synthetic";
      },
      revokeObjectURL: () => events.push("revoke-url"),
    },
    document: {
      createElement: () => {
        events.push("create-anchor");
        if (options.failCreate) throw new Error("synthetic create failure");
        return anchor;
      },
      body: {
        appendChild: () => events.push("append"),
        removeChild: () => events.push("remove"),
      },
    },
  } as unknown as DownloadBoundary;
  return { boundary, events, blobs, anchor };
}

describe("downloadTextArtifact", () => {
  it("creates one Blob with exact UTF-8 text and MIME type", () => {
    const fake = fakeBoundary();
    expect(downloadTextArtifact(artifact, fake.boundary)).toEqual({ success: true });
    expect(fake.blobs).toEqual([
      { parts: ["{}\n"], options: { type: "application/json;charset=utf-8" } },
    ]);
  });

  it("initiates one anchor download with the exact safe filename", () => {
    const fake = fakeBoundary();
    expect(downloadTextArtifact(artifact, fake.boundary)).toEqual({ success: true });
    expect(fake.events.filter((event) => event === "click")).toHaveLength(1);
    expect(fake.anchor.download).toBe("ai-orchestra-enterprise-rag.workflow-export.v1.0.0.json");
    expect(fake.anchor.href).toBe("blob:synthetic");
    expect(fake.anchor.target).toBeUndefined();
    expect(fake.anchor.rel).toBeUndefined();
  });

  it("removes the anchor and revokes the object URL immediately after initiation", () => {
    const fake = fakeBoundary();
    expect(downloadTextArtifact(artifact, fake.boundary)).toEqual({ success: true });
    expect(fake.events).toEqual([
      "create-url",
      "create-anchor",
      "append",
      "click",
      "remove",
      "revoke-url",
    ]);
  });

  it("fails safely and cleans up when anchor creation or click fails", () => {
    const createFailure = fakeBoundary({ failCreate: true });
    expect(downloadTextArtifact(artifact, createFailure.boundary)).toMatchObject({
      success: false,
      code: "EXPORT_DOWNLOAD_UNAVAILABLE",
    });
    expect(createFailure.events).toEqual(["create-url", "create-anchor", "revoke-url"]);

    const clickFailure = fakeBoundary({ failClick: true });
    expect(downloadTextArtifact(artifact, clickFailure.boundary)).toMatchObject({
      success: false,
      code: "EXPORT_DOWNLOAD_UNAVAILABLE",
    });
    expect(clickFailure.events).toEqual([
      "create-url",
      "create-anchor",
      "append",
      "click",
      "remove",
      "revoke-url",
    ]);
  });
});
