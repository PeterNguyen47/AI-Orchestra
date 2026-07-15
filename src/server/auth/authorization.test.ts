import { beforeEach, describe, expect, it, vi } from "vitest";

const { cookieGet, redirectMock } = vi.hoisted(() => ({
  cookieGet: vi.fn(),
  redirectMock: vi.fn((destination: string) => {
    throw new Error(`REDIRECT:${destination}`);
  }),
}));
vi.mock("next/headers", () => ({ cookies: vi.fn(async () => ({ get: cookieGet })) }));
vi.mock("next/navigation", () => ({ redirect: redirectMock }));

import { requireSession, verifySession } from "./authorization";

describe("server authorization", () => {
  beforeEach(() => {
    cookieGet.mockReset();
    redirectMock.mockClear();
  });

  it("returns null for a missing session", async () => {
    cookieGet.mockReturnValue(undefined);
    await expect(verifySession()).resolves.toBeNull();
  });

  it("redirects when authoritative protected-layout verification has no session", async () => {
    cookieGet.mockReturnValue(undefined);
    await expect(requireSession()).rejects.toThrow("REDIRECT:/login");
  });
});
