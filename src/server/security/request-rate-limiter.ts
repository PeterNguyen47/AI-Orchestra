import "server-only";

export const GOVERNED_RATE_WINDOW_SECONDS = 60 as const;
export const GOVERNED_RATE_REQUESTS_PER_WINDOW = 6 as const;
export const GOVERNED_RATE_MAXIMUM_ENTRIES = 1_024 as const;

type SubjectHasher = (subject: string) => Promise<string>;
type Clock = () => number;
type RateEntry = { windowStartedAtMs: number; count: number };

export type GovernedRateLimitResult =
  | Readonly<{ allowed: true }>
  | Readonly<{
      allowed: false;
      code: "RATE_LIMIT_EXCEEDED";
      retryAfterSeconds: number;
    }>;

export async function deriveSubjectDigest(subject: string): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(subject),
  );
  return Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, "0")).join(
    "",
  );
}

export class GovernedRequestRateLimiter {
  readonly #clock: Clock;
  readonly #hasher: SubjectHasher;
  readonly #entries = new Map<string, RateEntry>();

  constructor(options: Readonly<{ clock?: Clock; hasher?: SubjectHasher }> = {}) {
    this.#clock = options.clock ?? Date.now;
    this.#hasher = options.hasher ?? deriveSubjectDigest;
  }

  get entryCount(): number {
    return this.#entries.size;
  }

  #now(): number {
    const value = this.#clock();
    return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
  }

  #pruneExpired(now: number): void {
    const windowMs = GOVERNED_RATE_WINDOW_SECONDS * 1_000;
    for (const [digest, entry] of this.#entries) {
      if (now - entry.windowStartedAtMs >= windowMs) this.#entries.delete(digest);
    }
  }

  #blocked(entry: RateEntry | undefined, now: number): GovernedRateLimitResult {
    const remainingMs = entry
      ? entry.windowStartedAtMs + GOVERNED_RATE_WINDOW_SECONDS * 1_000 - now
      : GOVERNED_RATE_WINDOW_SECONDS * 1_000;
    const retryAfterSeconds = Math.min(
      GOVERNED_RATE_WINDOW_SECONDS,
      Math.max(1, Math.ceil(remainingMs / 1_000)),
    );
    return { allowed: false, code: "RATE_LIMIT_EXCEEDED", retryAfterSeconds };
  }

  async consume(subject: string): Promise<GovernedRateLimitResult> {
    const now = this.#now();
    this.#pruneExpired(now);

    let digest: string;
    try {
      digest = await this.#hasher(subject);
    } catch {
      return this.#blocked(undefined, now);
    }
    if (!/^[0-9a-f]{64}$/.test(digest)) return this.#blocked(undefined, now);

    const current = this.#entries.get(digest);
    if (current) {
      if (current.count >= GOVERNED_RATE_REQUESTS_PER_WINDOW) {
        return this.#blocked(current, now);
      }
      current.count += 1;
      return { allowed: true };
    }

    if (this.#entries.size >= GOVERNED_RATE_MAXIMUM_ENTRIES) {
      return this.#blocked(undefined, now);
    }
    this.#entries.set(digest, { windowStartedAtMs: now, count: 1 });
    return { allowed: true };
  }
}

export const governedRequestRateLimiter = new GovernedRequestRateLimiter();
