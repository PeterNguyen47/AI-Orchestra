import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { parseWorkflowJson } from "./workflow-parser";
import type { Workflow } from "./workflow-types";

const templatePath = resolve(process.cwd(), "templates", "enterprise-rag.v1.json");

function template(): Workflow {
  const parsed = parseWorkflowJson(readFileSync(templatePath, "utf8"));
  if (!parsed.success) throw new Error(JSON.stringify(parsed.issues));
  return parsed.data;
}

describe("Enterprise RAG template contract", () => {
  it("uses the approved identity, deterministic node set, and positions", () => {
    const workflow = template();

    expect(workflow.template).toEqual({
      id: "enterprise-rag-question-answer",
      version: "1.0.0",
    });
    expect(workflow.name).toBe("Enterprise RAG Question-and-Answer Assistant");
    expect(workflow.nodes.map((node) => [node.id, node.position])).toEqual([
      ["user-input", { x: 0, y: 0 }],
      ["input-guardrail", { x: 260, y: 0 }],
      ["document-source", { x: 260, y: 220 }],
      ["retrieval", { x: 520, y: 80 }],
      ["gpt-agent", { x: 780, y: 80 }],
      ["output-guardrail", { x: 1040, y: 80 }],
      ["evaluator", { x: 1300, y: 80 }],
      ["response-output", { x: 1560, y: 80 }],
      ["simulated-relational-database", { x: 260, y: 420 }],
    ]);
  });

  it("contains exactly the approved runtime and advisory topology", () => {
    const workflow = template();
    const topology = (mode: "runtime" | "advisory") =>
      workflow.edges
        .filter((edge) => edge.mode === mode)
        .map((edge) => `${edge.sourceNodeId}->${edge.targetNodeId}`)
        .sort();

    expect(topology("runtime")).toEqual(
      [
        "user-input->input-guardrail",
        "input-guardrail->retrieval",
        "document-source->retrieval",
        "retrieval->gpt-agent",
        "gpt-agent->output-guardrail",
        "output-guardrail->evaluator",
        "evaluator->response-output",
      ].sort(),
    );
    expect(topology("advisory")).toEqual(["simulated-relational-database->retrieval"]);
  });

  it("fixes the GPT, citation, evaluation, and no-tool policy requirements", () => {
    const workflow = template();
    const agent = workflow.nodes.find((node) => node.type === "gpt_agent")!;
    const retrieval = workflow.nodes.find((node) => node.type === "retrieval")!;
    const outputGuardrail = workflow.nodes.find((node) => node.type === "output_guardrail")!;
    const evaluator = workflow.nodes.find((node) => node.type === "evaluator")!;
    const requiredMetrics = {
      groundedness: true,
      relevance: true,
      citation_coverage: true,
    } as const;

    expect(agent.configuration.model).toBe("qwen3:4b");
    expect(agent.configuration.allowedTools).toEqual([]);
    expect(workflow.policies.toolPolicy.allowedTools).toEqual([]);
    expect(retrieval.configuration.citationsRequired).toBe(true);
    expect(outputGuardrail.configuration.citationsRequired).toBe(true);
    expect(evaluator.configuration.requiredMetrics).toEqual(requiredMetrics);
    expect(workflow.evaluation.requiredMetrics).toEqual(requiredMetrics);
    expect(Object.keys(workflow.evaluation.metricThresholds).sort()).toEqual([
      "citation_coverage",
      "groundedness",
      "relevance",
    ]);
  });

  it("keeps the enterprise database visibly simulated, read-only, and advisory", () => {
    const workflow = template();
    const database = workflow.nodes.find((node) => node.type === "relational_database")!;

    expect(database.label).toContain("Simulated");
    expect(database.description).toContain("non-executing");
    expect(database.implementationStatus).toBe("simulated");
    expect(database.configuration.accessMode).toBe("read_only");
    expect(database.configuration.simulationNotice).toContain("does not open this connection");
    expect(database.configuration.connectionReference).toEqual({
      environmentVariableName: "ENTERPRISE_RAG_DATABASE_URL",
    });
    expect(database.documentationRef).toContain("relational-database-simulated");
    expect(workflow.edges.find((edge) => edge.sourceNodeId === database.id)?.mode).toBe("advisory");
  });

  it("contains no changing timestamps or secret values", () => {
    const json = readFileSync(templatePath, "utf8");

    expect(json).not.toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    expect(json).not.toMatch(/:\/\/[^\s/:]+:[^\s/@]+@/);
    expect(json).not.toMatch(/-----BEGIN/);
  });
});
