import { NextResponse } from "next/server";

import { logger } from "@/server/logger";
import { getRuntimeConfig } from "@/server/runtime-config";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function GET() {
  const config = getRuntimeConfig();
  const response = {
    status: "ok",
    service: config.appName,
    version: config.appVersion,
    timestamp: new Date().toISOString(),
  } as const;

  logger.info("health_check", { status: response.status });

  return NextResponse.json(response, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
