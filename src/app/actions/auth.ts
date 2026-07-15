"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { authenticateCredentials } from "@/server/auth/credentials";
import {
  createSessionToken,
  getSessionCookieConfiguration,
  SESSION_COOKIE_NAME,
} from "@/server/auth/session";
import { GENERIC_LOGIN_ERROR, type LoginState } from "./auth-state";

const loginSchema = z.object({
  username: z.string().trim().min(1).max(80),
  password: z.string().min(1).max(256),
});

export async function loginAction(
  _previousState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    username: formData.get("username"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: GENERIC_LOGIN_ERROR };

  let authenticated = false;
  try {
    authenticated = await authenticateCredentials(parsed.data.username, parsed.data.password);
  } catch {
    authenticated = false;
  }
  if (!authenticated) return { error: GENERIC_LOGIN_ERROR };

  (await cookies()).set(
    SESSION_COOKIE_NAME,
    await createSessionToken(),
    getSessionCookieConfiguration(),
  );
  redirect("/dashboard");
}

export async function logoutAction(): Promise<never> {
  (await cookies()).set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
    expires: new Date(0),
  });
  redirect("/login");
}
