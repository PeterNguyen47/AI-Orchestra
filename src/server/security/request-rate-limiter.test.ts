import { describe, expect, it } from "vitest";

import {
  deriveSubjectDigest,
  GOVERNED_RATE_MAXIMUM_ENTRIES,
  GovernedRequestRateLimiter,
} from "./request-rate-limiter";

const digestFor = (value: number) => value.toString(16).padStart(64, "0");

describe("governed request rate limiter", () => {
  it("allows six attempts and blocks the seventh with bounded retry metadata", async () => {
    const limiter = new GovernedRequestRateLimiter({
      clock: () => 0,
      hasher: async () => digestFor(1),
    });
    for (let attempt = 0; attempt < 6; attempt += 1) {
      await expect(limiter.consume("synthetic-subject")).resolves.toEqual({ allowed: true });
    }
    await expect(limiter.consume("synthetic-subject")).resolves.toEqual({
      allowed: false,
      code: "RATE_LIMIT_EXCEEDED",
      retryAfterSeconds: 60,
    });
  });

  it("resets the fixed window and prunes expired entries", async () => {
    let now = 0;
    const limiter = new GovernedRequestRateLimiter({
      clock: () => now,
      hasher: async () => digestFor(2),
    });
    for (let attempt = 0; attempt < 7; attempt += 1) await limiter.consume("subject");
    now = 60_000;
    await expect(limiter.consume("subject")).resolves.toEqual({ allowed: true });
    expect(limiter.entryCount).toBe(1);
  });

  it("isolates subjects through lower-case SHA-256 digests", async () => {
    const first = await deriveSubjectDigest("subject-one");
    const second = await deriveSubjectDigest("subject-two");
    expect(first).toMatch(/^[0-9a-f]{64}$/);
    expect(first).not.toBe(second);
    const limiter = new GovernedRequestRateLimiter();
    await limiter.consume("subject-one");
    await limiter.consume("subject-two");
    expect(limiter.entryCount).toBe(2);
  });

  it("fails closed at bounded capacity while existing subjects continue", async () => {
    let subjectNumber = 0;
    const limiter = new GovernedRequestRateLimiter({
      clock: () => 0,
      hasher: async () => digestFor(subjectNumber),
    });
    for (subjectNumber = 1; subjectNumber <= GOVERNED_RATE_MAXIMUM_ENTRIES; subjectNumber += 1) {
      expect((await limiter.consume("subject")).allowed).toBe(true);
    }
    subjectNumber = GOVERNED_RATE_MAXIMUM_ENTRIES + 1;
    await expect(limiter.consume("new-subject")).resolves.toMatchObject({
      allowed: false,
      code: "RATE_LIMIT_EXCEEDED",
      retryAfterSeconds: 60,
    });
    subjectNumber = 1;
    await expect(limiter.consume("existing-subject")).resolves.toEqual({ allowed: true });
    expect(limiter.entryCount).toBe(GOVERNED_RATE_MAXIMUM_ENTRIES);
  });

  it("fails closed without disclosing subjects when hashing fails or is invalid", async () => {
    for (const hasher of [
      async () => {
        throw new Error("synthetic hasher detail");
      },
      async () => "not-a-digest",
    ]) {
      const result = await new GovernedRequestRateLimiter({ hasher }).consume(
        "sensitive-subject-sentinel",
      );
      expect(result).toEqual({
        allowed: false,
        code: "RATE_LIMIT_EXCEEDED",
        retryAfterSeconds: 60,
      });
      expect(JSON.stringify(result)).not.toContain("sensitive-subject-sentinel");
      expect(JSON.stringify(result)).not.toContain("synthetic hasher detail");
    }
  });
});
