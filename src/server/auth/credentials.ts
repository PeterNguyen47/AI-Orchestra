import "server-only";

import { timingSafeEqual } from "node:crypto";

import { getAuthConfig } from "./auth-config";
import { verifyPassword } from "./password";

function equalUsername(actual: string, expected: string): boolean {
  const actualBytes = Buffer.from(actual, "utf8");
  const expectedBytes = Buffer.from(expected, "utf8");
  const size = Math.max(actualBytes.length, expectedBytes.length, 1);
  const paddedActual = Buffer.alloc(size);
  const paddedExpected = Buffer.alloc(size);
  actualBytes.copy(paddedActual);
  expectedBytes.copy(paddedExpected);

  return (
    actualBytes.length === expectedBytes.length && timingSafeEqual(paddedActual, paddedExpected)
  );
}

export async function authenticateCredentials(
  username: string,
  password: string,
): Promise<boolean> {
  const config = getAuthConfig();
  const [usernameMatches, passwordMatches] = await Promise.all([
    Promise.resolve(equalUsername(username, config.username)),
    verifyPassword(password, config.passwordHash),
  ]);
  return usernameMatches && passwordMatches;
}
