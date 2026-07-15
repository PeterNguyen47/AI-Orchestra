import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { SESSION_COOKIE_NAME, verifySessionToken, type DemoSession } from "./session";

export async function verifySession(): Promise<DemoSession | null> {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

export async function requireSession(): Promise<DemoSession> {
  const session = await verifySession();
  if (!session) redirect("/login");
  return session;
}
