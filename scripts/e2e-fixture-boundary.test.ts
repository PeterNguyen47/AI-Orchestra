import { afterEach, describe, expect, it } from "vitest";

import {
  E2E_FIXTURE_MAX_BODY_BYTES,
  E2E_FIXTURE_LOOPBACK_HOST,
  startE2EFixture,
  stopE2EFixture,
  type E2EFixture,
} from "./e2e-fixture-boundary";

const fixtures: E2EFixture[] = [];

afterEach(async () => {
  await Promise.all(fixtures.splice(0).map(stopE2EFixture));
});

async function createFixture() {
  const fixture = await startE2EFixture();
  fixtures.push(fixture);
  return {
    fixture,
    baseUrl: `http://${E2E_FIXTURE_LOOPBACK_HOST}:${fixture.port}`,
  };
}

describe("bounded E2E fixture", () => {
  it("allows only the exact tags, version, and first chat endpoints", async () => {
    const { fixture, baseUrl } = await createFixture();

    const tags = await fetch(`${baseUrl}/api/tags`);
    const version = await fetch(`${baseUrl}/api/version`);
    const chat = await fetch(`${baseUrl}/api/chat`, { method: "POST", body: "{}" });

    expect([tags.status, version.status, chat.status]).toEqual([200, 200, 200]);
    expect(await tags.json()).toMatchObject({ models: [{ model: "qwen3:4b" }] });
    expect(await version.json()).toEqual({ version: "ao008-e2e-fixture-1.0.0" });
    expect(await chat.json()).toMatchObject({ model: "qwen3:4b", done: true });
    expect(fixture.counts).toEqual({ tags: 1, version: 1, chat: 1, unexpected: 0 });
  });

  it("rejects query strings, unsupported methods, and unsupported paths", async () => {
    const { fixture, baseUrl } = await createFixture();

    const query = await fetch(`${baseUrl}/api/tags?unexpected=true`);
    const method = await fetch(`${baseUrl}/api/version`, { method: "POST" });
    const path = await fetch(`${baseUrl}/api/other`);

    expect([query.status, method.status, path.status]).toEqual([404, 404, 404]);
    expect(fixture.counts).toEqual({ tags: 0, version: 0, chat: 0, unexpected: 3 });
  });

  it("rejects a second model-generation request", async () => {
    const { fixture, baseUrl } = await createFixture();

    const first = await fetch(`${baseUrl}/api/chat`, { method: "POST", body: "{}" });
    const second = await fetch(`${baseUrl}/api/chat`, { method: "POST", body: "{}" });

    expect(first.status).toBe(200);
    expect(second.status).toBe(429);
    expect(await second.json()).toEqual({ error: "fixture_generation_limit_exceeded" });
    expect(fixture.counts).toEqual({ tags: 0, version: 0, chat: 2, unexpected: 1 });
  });

  it("rejects request bodies above the 64 KiB boundary without retaining them", async () => {
    const { fixture, baseUrl } = await createFixture();
    const response = await fetch(`${baseUrl}/api/chat`, {
      method: "POST",
      body: "x".repeat(E2E_FIXTURE_MAX_BODY_BYTES + 1),
    });

    expect(response.status).toBe(413);
    expect(await response.json()).toEqual({ error: "fixture_body_too_large" });
    expect(fixture.counts).toEqual({ tags: 0, version: 0, chat: 0, unexpected: 1 });
  });
});
