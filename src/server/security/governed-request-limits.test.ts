import { describe, expect, it } from "vitest";

import {
  MAXIMUM_ACTION_QUESTION_CHARACTERS,
  MAXIMUM_SERIALIZED_WORKFLOW_BYTES,
  validateGovernedRequestBoundary,
} from "./governed-request-limits";

describe("governed request limits", () => {
  it("accepts only the strict workflow and question envelope", () => {
    expect(validateGovernedRequestBoundary({ workflow: {}, question: "safe" })).toEqual({
      success: true,
      workflow: {},
      question: "safe",
    });
    for (const input of [null, [], "request", { workflow: {}, question: "safe", extra: true }]) {
      expect(validateGovernedRequestBoundary(input)).toEqual({
        success: false,
        code: "REQUEST_INVALID",
      });
    }
  });

  it("accepts eight thousand characters but rejects larger questions", () => {
    expect(
      validateGovernedRequestBoundary({
        workflow: {},
        question: "q".repeat(MAXIMUM_ACTION_QUESTION_CHARACTERS),
      }).success,
    ).toBe(true);
    expect(
      validateGovernedRequestBoundary({
        workflow: {},
        question: "q".repeat(MAXIMUM_ACTION_QUESTION_CHARACTERS + 1),
      }),
    ).toEqual({ success: false, code: "REQUEST_INVALID" });
  });

  it("measures workflow size as UTF-8 bytes and blocks above one million", () => {
    const overhead = new TextEncoder().encode(JSON.stringify({ value: "" })).byteLength;
    const exact = "a".repeat(MAXIMUM_SERIALIZED_WORKFLOW_BYTES - overhead);
    expect(
      validateGovernedRequestBoundary({ workflow: { value: exact }, question: "safe" }).success,
    ).toBe(true);
    expect(
      validateGovernedRequestBoundary({
        workflow: { value: exact + "\u00e9" },
        question: "safe",
      }),
    ).toEqual({ success: false, code: "REQUEST_INVALID" });
  });

  it("fails closed for undefined, circular, and BigInt workflow serialization", () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    for (const workflow of [undefined, circular, { value: BigInt(1) }]) {
      const result = validateGovernedRequestBoundary({ workflow, question: "safe" });
      expect(result).toEqual({ success: false, code: "REQUEST_INVALID" });
      expect(result).not.toHaveProperty("serialized");
    }
  });
});
