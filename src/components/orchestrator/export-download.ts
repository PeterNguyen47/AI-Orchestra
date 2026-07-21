"use client";

import {
  downloadableTextArtifactSchema,
  exportFailure,
  type DownloadableTextArtifact,
  type ExportFailure,
} from "@/domain/exports/export-contracts";

export type DownloadBoundary = Readonly<{
  Blob: typeof Blob;
  URL: Pick<typeof URL, "createObjectURL" | "revokeObjectURL">;
  document: Pick<Document, "body" | "createElement">;
}>;

export type DownloadResult = Readonly<{ success: true }> | ExportFailure;

function defaultBoundary(): DownloadBoundary | undefined {
  if (
    typeof globalThis.Blob !== "function" ||
    typeof globalThis.URL?.createObjectURL !== "function" ||
    typeof globalThis.URL?.revokeObjectURL !== "function" ||
    typeof globalThis.document?.createElement !== "function" ||
    !globalThis.document.body
  )
    return undefined;
  return { Blob: globalThis.Blob, URL: globalThis.URL, document: globalThis.document };
}

export function downloadTextArtifact(
  input: DownloadableTextArtifact,
  injectedBoundary?: DownloadBoundary,
): DownloadResult {
  const artifact = downloadableTextArtifactSchema.safeParse(input);
  const boundary = injectedBoundary ?? defaultBoundary();
  if (!artifact.success || !boundary) return exportFailure("EXPORT_DOWNLOAD_UNAVAILABLE");

  let anchor: HTMLAnchorElement | undefined;
  let objectUrl: string | undefined;
  let appended = false;
  let result: DownloadResult = exportFailure("EXPORT_DOWNLOAD_UNAVAILABLE");
  try {
    const blob = new boundary.Blob([artifact.data.text], { type: artifact.data.mimeType });
    objectUrl = boundary.URL.createObjectURL(blob);
    anchor = boundary.document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = artifact.data.filename;
    boundary.document.body.appendChild(anchor);
    appended = true;
    anchor.click();
    result = { success: true };
  } catch {
    result = exportFailure("EXPORT_DOWNLOAD_UNAVAILABLE");
  } finally {
    if (appended && anchor) {
      try {
        boundary.document.body.removeChild(anchor);
      } catch {
        result = exportFailure("EXPORT_DOWNLOAD_UNAVAILABLE");
      }
    }
    if (objectUrl) {
      try {
        boundary.URL.revokeObjectURL(objectUrl);
      } catch {
        result = exportFailure("EXPORT_DOWNLOAD_UNAVAILABLE");
      }
    }
  }
  return result;
}
