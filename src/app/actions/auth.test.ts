import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const { cookieSet, cookieGet, redirectMock } = vi.hoisted(() => ({
  cookieSet: vi.fn(),
  cookieGet: vi.fn(),
  redirectMock: vi.fn((destination: string) => {
    throw new Error(`REDIRECT:${destination}`);
  }),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({ get: cookieGet, set: cookieSet })),
}));
vi.mock("next/navigation", () => ({ redirect: redirectMock }));

import { loginAction, logoutAction } from "./auth";
import { GENERIC_LOGIN_ERROR, initialLoginState } from "./auth-state";
import { createPasswordHash } from "@/server/auth/password-core";

beforeAll(async () => {
  vi.stubEnv("DEMO_USERNAME", "judge-demo");
  vi.stubEnv("DEMO_PASSWORD_HASH", await createPasswordHash("test-password"));
  vi.stubEnv("SESSION_SECRET", "0123456789abcdef0123456789abcdef");
  vi.stubEnv("NODE_ENV", "test");
});

beforeEach(() => {
  cookieGet.mockReset();
  cookieSet.mockReset();
  redirectMock.mockClear();
});

function loginForm(username: string, password: string): FormData {
  const data = new FormData();
  data.set("username", username);
  data.set("password", password);
  return data;
}

describe("authentication actions", () => {
  it("returns the same generic failure for invalid fields, user, and password", async () => {
    await expect(loginAction(initialLoginState, new FormData())).resolves.toEqual({
      error: GENERIC_LOGIN_ERROR,
    });
    await expect(
      loginAction(initialLoginState, loginForm("unknown", "test-password")),
    ).resolves.toEqual({ error: GENERIC_LOGIN_ERROR });
    await expect(loginAction(initialLoginState, loginForm("judge-demo", "wrong"))).resolves.toEqual(
      { error: GENERIC_LOGIN_ERROR },
    );
    expect(cookieSet).not.toHaveBeenCalled();
  });

  it("creates a server cookie only after valid credential verification", async () => {
    await expect(
      loginAction(initialLoginState, loginForm("judge-demo", "test-password")),
    ).rejects.toThrow("REDIRECT:/dashboard");
    expect(cookieSet).toHaveBeenCalledWith(
      "ai_orchestra_session",
      expect.any(String),
      expect.objectContaining({ httpOnly: true, sameSite: "lax", path: "/", secure: false }),
    );
  });

  it("deletes the cookie safely during logout", async () => {
    await expect(logoutAction()).rejects.toThrow("REDIRECT:/login");
    expect(cookieSet).toHaveBeenCalledWith(
      "ai_orchestra_session",
      "",
      expect.objectContaining({ httpOnly: true, maxAge: 0, path: "/" }),
    );
  });
});
