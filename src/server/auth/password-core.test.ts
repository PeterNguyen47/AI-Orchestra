import { describe, expect, it } from "vitest";
import { createPasswordHash, verifyPassword } from "./password-core";

describe("demonstration password hashing", () => {
  it("creates a versioned salted scrypt hash and verifies the password", async () => {
    const first = await createPasswordHash("correct horse battery staple");
    const second = await createPasswordHash("correct horse battery staple");
    expect(first).toMatch(/^ai-orchestra-scrypt-v1:N=16384,r=8,p=1,l=32:/);
    expect(first).not.toBe(second);
    await expect(verifyPassword("correct horse battery staple", first)).resolves.toBe(true);
    await expect(verifyPassword("wrong password", first)).resolves.toBe(false);
  });

  it.each([
    "",
    "malformed",
    "ai-orchestra-scrypt-v1:wrong:a:b",
    "ai-orchestra-scrypt-v1:N=16384,r=8,p=1,l=32:YQ:Yg",
  ])("rejects malformed hash %j without throwing", async (value) => {
    await expect(verifyPassword("password", value)).resolves.toBe(false);
  });

  it("rejects out-of-bounds input and different derived-key lengths", async () => {
    await expect(verifyPassword("x".repeat(257), "anything")).resolves.toBe(false);
    await expect(createPasswordHash("", Buffer.alloc(16))).rejects.toThrow("hash bounds");
    const valid = await createPasswordHash("password", Buffer.alloc(16, 1));
    const differentLength = `${valid.slice(0, valid.lastIndexOf(":") + 1)}YQ`;
    await expect(verifyPassword("password", differentLength)).resolves.toBe(false);
  });
});
