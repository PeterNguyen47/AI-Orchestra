import { randomBytes, scrypt as nodeScrypt, timingSafeEqual } from "node:crypto";

const FORMAT = "ai-orchestra-scrypt-v1";
const KEY_LENGTH = 32;
const COST = 16_384;
const BLOCK_SIZE = 8;
const PARALLELIZATION = 1;
const MAX_PASSWORD_LENGTH = 256;

function deriveKey(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    nodeScrypt(
      password,
      salt,
      KEY_LENGTH,
      { N: COST, r: BLOCK_SIZE, p: PARALLELIZATION, maxmem: 64 * 1024 * 1024 },
      (error, derivedKey) => (error ? reject(error) : resolve(derivedKey)),
    );
  });
}

export async function createPasswordHash(
  password: string,
  salt = randomBytes(16),
): Promise<string> {
  if (password.length === 0 || password.length > MAX_PASSWORD_LENGTH || salt.length < 16) {
    throw new Error("Password or salt does not meet the demonstration hash bounds.");
  }

  const derivedKey = await deriveKey(password, salt);

  return [
    FORMAT,
    `N=${COST},r=${BLOCK_SIZE},p=${PARALLELIZATION},l=${KEY_LENGTH}`,
    salt.toString("base64url"),
    derivedKey.toString("base64url"),
  ].join(":");
}

export async function verifyPassword(password: string, serializedHash: string): Promise<boolean> {
  if (password.length === 0 || password.length > MAX_PASSWORD_LENGTH) return false;

  try {
    const parts = serializedHash.split(":");
    if (
      parts.length !== 4 ||
      parts[0] !== FORMAT ||
      parts[1] !== `N=${COST},r=${BLOCK_SIZE},p=${PARALLELIZATION},l=${KEY_LENGTH}`
    ) {
      return false;
    }

    const salt = Buffer.from(parts[2]!, "base64url");
    const expected = Buffer.from(parts[3]!, "base64url");
    if (salt.length < 16 || expected.length !== KEY_LENGTH) return false;

    const actual = await deriveKey(password, salt);

    return actual.length === expected.length && timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}
