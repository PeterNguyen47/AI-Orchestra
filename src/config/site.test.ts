import { describe, expect, it } from "vitest";

import { siteConfig } from "./site";

describe("siteConfig", () => {
  it("publishes only the bounded foundation metadata", () => {
    expect(siteConfig).toEqual({
      name: "AI Orchestra",
      status: "Foundation",
      track: "Developer Tools",
      description:
        "A low-code, governance-first workspace for composing and validating AI architecture blueprints.",
      implementationStatus: "executable",
    });
  });

  it("is immutable", () => {
    expect(Object.isFrozen(siteConfig)).toBe(true);
  });
});
