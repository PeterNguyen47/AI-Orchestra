import {
  createServer as createHttpServer,
  type IncomingMessage,
  type Server as HttpServer,
  type ServerResponse,
} from "node:http";
import type { AddressInfo } from "node:net";

export const E2E_FIXTURE_LOOPBACK_HOST = "127.0.0.1" as const;
export const E2E_FIXTURE_MAX_BODY_BYTES = 64 * 1024;
export const AO008_FIXTURE_ANSWER =
  "Governed execution keeps input, retrieval, model output, citations, credentials, and logs bounded. [AO008-FIXTURE-ANSWER-SENTINEL]";

export type E2EFixtureCounts = {
  tags: number;
  version: number;
  chat: number;
  unexpected: number;
};
export type E2EFixture = Readonly<{
  server: HttpServer;
  port: number;
  counts: E2EFixtureCounts;
}>;

function writeJson(response: ServerResponse, status: number, value: unknown): void {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(value));
}

async function drainBoundedBody(request: IncomingMessage): Promise<boolean> {
  let bytes = 0;
  for await (const chunk of request) {
    bytes += Buffer.isBuffer(chunk) ? chunk.length : Buffer.byteLength(String(chunk));
    if (bytes > E2E_FIXTURE_MAX_BODY_BYTES) {
      request.resume();
      return false;
    }
  }
  return true;
}

export async function handleE2EFixtureRequest(
  request: IncomingMessage,
  response: ServerResponse,
  counts: E2EFixtureCounts,
): Promise<void> {
  if (!(await drainBoundedBody(request))) {
    counts.unexpected += 1;
    writeJson(response, 413, { error: "fixture_body_too_large" });
    return;
  }

  const url = new URL(request.url ?? "/", `http://${E2E_FIXTURE_LOOPBACK_HOST}`);
  if (url.search || url.hash) {
    counts.unexpected += 1;
    writeJson(response, 404, { error: "unexpected_fixture_request" });
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/tags") {
    counts.tags += 1;
    writeJson(response, 200, {
      models: [
        {
          name: "qwen3:4b",
          model: "qwen3:4b",
          digest: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        },
      ],
    });
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/version") {
    counts.version += 1;
    writeJson(response, 200, { version: "ao008-e2e-fixture-1.0.0" });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/chat") {
    counts.chat += 1;
    if (counts.chat > 1) {
      counts.unexpected += 1;
      writeJson(response, 429, { error: "fixture_generation_limit_exceeded" });
      return;
    }
    writeJson(response, 200, {
      model: "qwen3:4b",
      message: {
        content: JSON.stringify({
          answerMarkdown: AO008_FIXTURE_ANSWER,
          citationIds: ["security-controls#chunk-001"],
          insufficientContext: false,
        }),
      },
      done: true,
      total_duration: 75_000_000,
      prompt_eval_count: 40,
      eval_count: 10,
    });
    return;
  }

  counts.unexpected += 1;
  writeJson(response, 404, { error: "unexpected_fixture_request" });
}

export async function startE2EFixture(): Promise<E2EFixture> {
  const counts: E2EFixtureCounts = { tags: 0, version: 0, chat: 0, unexpected: 0 };
  const server = createHttpServer((request, response) => {
    void handleE2EFixtureRequest(request, response, counts).catch(() => {
      counts.unexpected += 1;
      if (!response.headersSent) writeJson(response, 500, { error: "fixture_request_failed" });
      else response.end();
    });
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, E2E_FIXTURE_LOOPBACK_HOST, resolve);
  });
  const address = server.address() as AddressInfo | null;
  if (!address) throw new Error("The governed fixture did not receive a loopback port.");
  return { server, port: address.port, counts };
}

export async function stopE2EFixture(fixture: E2EFixture): Promise<void> {
  fixture.server.closeIdleConnections();
  fixture.server.closeAllConnections();
  await new Promise<void>((resolve, reject) => {
    fixture.server.close((error) => (error ? reject(error) : resolve()));
  });
}
