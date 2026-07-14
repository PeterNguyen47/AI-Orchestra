import "server-only";

import { parseRuntimeConfig, type RuntimeConfig } from "./runtime-config.schema";

export function getRuntimeConfig(): RuntimeConfig {
  return parseRuntimeConfig(process.env);
}
