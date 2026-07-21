import { describe, expect, it } from "vitest";

import { CIRCULAR_VALUE, createLogRecord, REDACTED_VALUE, SAFE_ERROR_VALUE } from "./log-record";

describe("createLogRecord", () => {
  it("creates deterministic structured JSON data", () => {
    expect(
      createLogRecord({
        level: "info",
        event: "foundation.ready",
        service: "AI Orchestra",
        version: "0.1.0",
        context: { status: "ok" },
        now: new Date("2026-07-13T12:00:00.000Z"),
      }),
    ).toEqual({
      timestamp: "2026-07-13T12:00:00.000Z",
      level: "info",
      event: "foundation.ready",
      service: "AI Orchestra",
      version: "0.1.0",
      context: { status: "ok" },
    });
  });

  it("redacts sensitive values recursively", () => {
    const record = createLogRecord({
      level: "warn",
      event: "security.redaction",
      service: "AI Orchestra",
      version: "0.1.0",
      context: {
        apiKey: "should-not-appear",
        nested: { sessionToken: "also-private", safe: "visible" },
      },
    });

    expect(record.context).toEqual({
      apiKey: REDACTED_VALUE,
      nested: { sessionToken: REDACTED_VALUE, safe: "visible" },
    });
    expect(JSON.stringify(record)).not.toContain("should-not-appear");
    expect(JSON.stringify(record)).not.toContain("also-private");
  });

  it("redacts every authentication field family", () => {
    const record = createLogRecord({
      level: "warn",
      event: "auth.redaction",
      service: "AI Orchestra",
      version: "0.1.0",
      context: {
        password: "private",
        passwordHash: "private",
        session: "private",
        token: "private",
        authorization: "private",
        cookie: "private",
        sessionSecret: "private",
        credentials: "private",
      },
    });

    expect(new Set(Object.values(record.context))).toEqual(new Set([REDACTED_VALUE]));
  });

  it("serializes errors without stack data", () => {
    const record = createLogRecord({
      level: "error",
      event: "foundation.failure",
      service: "AI Orchestra",
      version: "0.1.0",
      context: { error: new Error("expected failure") },
    });

    expect(record.context.error).toEqual(SAFE_ERROR_VALUE);
    expect(JSON.stringify(record)).not.toContain("expected failure");
    expect(record.context.error).not.toHaveProperty("stack");
  });

  it("redacts sensitive arbitrary string values in nested objects and arrays", () => {
    const privateKey = ["-----BEGIN ENCRYPTED ", "PRIVATE KEY-----"].join("");
    const rawError = new Error("raw error sentinel");
    rawError.name = "attacker-controlled-name";
    const record = createLogRecord({
      level: "warn",
      event: "security.value-redaction",
      service: "AI Orchestra",
      version: "0.1.0",
      context: {
        nested: {
          values: [
            ["Bearer ", "synthetic-token-value"].join(""),
            "postgresql://example.invalid/database",
            "Z:\\SyntheticFixture\\secret.txt",
            "session=synthetic-session",
            privateKey,
            rawError,
          ],
        },
      },
    });
    expect(record.context).toEqual({
      nested: {
        values: [
          REDACTED_VALUE,
          REDACTED_VALUE,
          REDACTED_VALUE,
          REDACTED_VALUE,
          REDACTED_VALUE,
          SAFE_ERROR_VALUE,
        ],
      },
    });
    const serialized = JSON.stringify(record);
    for (const sentinel of [
      privateKey,
      "synthetic-token-value",
      "example.invalid",
      "SyntheticFixture",
      "synthetic-session",
      "raw error sentinel",
      "attacker-controlled-name",
    ]) {
      expect(serialized).not.toContain(sentinel);
    }
  });

  it("sanitizes dates and nested array values", () => {
    const record = createLogRecord({
      level: "info",
      event: "foundation.array",
      service: "AI Orchestra",
      version: "0.1.0",
      context: {
        attemptedAt: new Date("2026-07-13T18:00:00.000Z"),
        values: [1, { password: "private-password", safe: true }],
      },
    });

    expect(record.context).toEqual({
      attemptedAt: "2026-07-13T18:00:00.000Z",
      values: [1, { password: REDACTED_VALUE, safe: true }],
    });
  });

  it("handles circular data safely", () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;

    const record = createLogRecord({
      level: "info",
      event: "foundation.circular",
      service: "AI Orchestra",
      version: "0.1.0",
      context: circular,
    });

    expect(record.context.self).toBe(CIRCULAR_VALUE);
  });

  it("handles circular arrays safely", () => {
    const circular: unknown[] = [];
    circular.push(circular);

    const record = createLogRecord({
      level: "info",
      event: "foundation.circular-array",
      service: "AI Orchestra",
      version: "0.1.0",
      context: { circular },
    });

    expect(record.context.circular).toEqual([CIRCULAR_VALUE]);
  });

  it("uses an empty context by default", () => {
    const record = createLogRecord({
      level: "debug",
      event: "foundation.empty",
      service: "AI Orchestra",
      version: "0.1.0",
    });

    expect(record.context).toEqual({});
  });

  it("rejects unstructured event names", () => {
    expect(() =>
      createLogRecord({
        level: "info",
        event: "Not a stable event",
        service: "AI Orchestra",
        version: "0.1.0",
      }),
    ).toThrow("Invalid structured log event name");
  });
});
