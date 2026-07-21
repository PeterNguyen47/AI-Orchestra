import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const runbook = readFileSync("docs/deployment/JUDGE_RUNBOOK.md", "utf8");
const platforms = readFileSync("docs/deployment/SUPPORTED_PLATFORMS.md", "utf8");
const rehearsal = readFileSync("docs/deployment/AO011_REHEARSAL_REPORT.md", "utf8");

describe("AO-011 deployment documentation contract", () => {
  it("keeps every primary Compose command exact and copyable", () => {
    for (const command of [
      "docker compose config --quiet",
      "docker compose --profile tools build --pull=false",
      "docker compose --profile tools run --rm credential-bootstrap",
      "docker compose up --detach --wait --wait-timeout 120",
      "docker compose --profile tools run --rm judge-readiness",
      "docker compose down --timeout 15 --volumes --remove-orphans",
      "docker compose restart app",
    ]) {
      expect(runbook).toContain(command);
    }
  });

  it("keeps the primary judge startup free of host runtimes and provider prerequisites", () => {
    const primary = runbook
      .split("## Fastest supported judge path")[1]!
      .split("## Prerequisites")[0]!;
    expect(primary).not.toMatch(/\bnpm\b|\bnode\b|ollama|openai|receipt|api key/i);
    expect(primary).toContain("docker compose");
  });

  it("distinguishes deterministic fixture, native live mode, simulated database, and roadmap", () => {
    expect(runbook).toContain("not Ollama, not an LLM deployment, and not live model inference");
    expect(runbook).toContain("Optional live Ollama mode");
    expect(runbook).toContain("`simulated`: the relational database node");
    expect(runbook).toContain("`roadmap`: tools, handoffs, persistence, uploads, live connectors");
    expect(runbook).toContain("`executable`: authentication, workflow composition");
  });

  it("uses only the governed supported-platform status vocabulary", () => {
    const allowed = new Set(["validated", "expected_compatible", "unsupported", "not_tested"]);
    const statuses = platforms
      .split(/\r?\n/)
      .filter((line) => line.startsWith("|") && !line.includes("---") && !line.includes("Platform"))
      .map((line) => line.split("|")[3]?.trim())
      .filter((value): value is string => Boolean(value));
    expect(statuses.length).toBeGreaterThan(0);
    expect(statuses.every((status) => allowed.has(status))).toBe(true);
  });

  it("forbids unsafe recovery commands and requires sanitized pending evidence fields", () => {
    expect(runbook).not.toMatch(
      /docker system prune|chmod 777|--privileged|docker\.sock|printenv|kubectl|helm install|terraform apply/i,
    );
    for (const section of [
      "## Sanitized environment",
      "## Measured timings",
      "## Vertical-slice results",
      "## Restart results",
      "## Teardown results",
      "## Non-disclosure and provider boundary",
    ]) {
      expect(rehearsal).toContain(section);
    }
    expect(rehearsal).toContain("PENDING_LOCAL_REHEARSAL");
    expect(rehearsal).not.toMatch(/Password:|SESSION_SECRET=|DEMO_PASSWORD_HASH=/);
  });
});
