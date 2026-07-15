import { jwtVerify } from "jose";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

async function hasOptimisticallyValidSession(request: NextRequest): Promise<boolean> {
  const token = request.cookies.get("ai_orchestra_session")?.value;
  const secret = process.env.SESSION_SECRET;
  if (!token || !secret || new TextEncoder().encode(secret).length < 32) return false;
  try {
    await jwtVerify(token, new TextEncoder().encode(secret), {
      algorithms: ["HS256"],
      issuer: "ai-orchestra",
      audience: "ai-orchestra-demo",
    });
    return true;
  } catch {
    return false;
  }
}

export async function proxy(request: NextRequest) {
  const authenticated = await hasOptimisticallyValidSession(request);
  const pathname = request.nextUrl.pathname;
  if (pathname === "/")
    return NextResponse.redirect(new URL(authenticated ? "/dashboard" : "/login", request.url));
  if (pathname === "/login" && authenticated)
    return NextResponse.redirect(new URL("/dashboard", request.url));
  if (pathname.startsWith("/dashboard") && !authenticated)
    return NextResponse.redirect(new URL("/login", request.url));
  return NextResponse.next();
}

export const config = { matcher: ["/", "/login", "/dashboard/:path*"] };
