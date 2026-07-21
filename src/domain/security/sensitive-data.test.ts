import { describe, expect, it } from "vitest";

import { containsSensitiveText } from "./sensitive-data";

describe("sensitive text detection", () => {
  it("rejects private-key and credential shapes without returning detector metadata", () => {
    const values = [
      ["-----BEGIN ", "PRIVATE KEY-----"].join(""),
      ["-----BEGIN ENCRYPTED ", "PRIVATE KEY-----"].join(""),
      ["Bearer ", "synthetic-token-value"].join(""),
      ["api_key=", "synthetic-secret-value"].join(""),
    ];
    expect(values.map(containsSensitiveText)).toEqual([true, true, true, true]);
    expect(typeof containsSensitiveText(values[0]!)).toBe("boolean");
  });

  it("rejects provider-key shapes and session material", () => {
    const values = [
      ["sk", "-proj-syntheticvalue1234567890"].join(""),
      ["gh", "p_abcdefghijklmnopqrstuvwxyz123456"].join(""),
      ["AKIA", "ABCDEFGHIJKLMNOP"].join(""),
      ["AIza", "abcdefghijklmnopqrstuvwxyz123456"].join(""),
      ["session=", "synthetic-session"].join(""),
    ];
    expect(values.every(containsSensitiveText)).toBe(true);
  });

  it("rejects connection URLs, absolute paths, and prohibited controls", () => {
    expect(
      [
        "postgresql://example.invalid/database",
        "https://synthetic-user:synthetic-pass@example.invalid/resource",
        "Z:\\SyntheticFixture\\workflow.json",
        "\\\\synthetic-host\\share\\workflow.json",
        "/home/synthetic-user/workflow.json",
        "safe\u0001unsafe",
      ].every(containsSensitiveText),
    ).toBe(true);
  });

  it("allows schema-style reference names and ordinary safe text deterministically", () => {
    const values = ["OPENAI_API_KEY", "SESSION_SECRET", "safe workflow label"];
    expect(values.map(containsSensitiveText)).toEqual([false, false, false]);
    expect(values.map(containsSensitiveText)).toEqual(values.map(containsSensitiveText));
  });
});
