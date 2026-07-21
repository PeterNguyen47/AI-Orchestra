import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { runDeterministicEvaluators } from "@/domain/runtime/evaluations";
import { DIAGNOSTIC_EXPLANATIONS, type RunEvidence } from "@/domain/runtime/run-evidence";
import { validateCanonicalWorkflowArchitecture } from "@/domain/validation/architecture-validator";
import { parseWorkflow } from "@/domain/workflow/workflow-parser";
import { RunEvidenceRecorder } from "@/server/runtime/run-evidence-recorder";
import { generateArchitectureAssurance, type AssuranceRunBinding } from "./architecture-assurance";
import { createCanonicalWorkflowSnapshot } from "./workflow-export";

function canonicalWorkflow() {
  const parsed = parseWorkflow(
    JSON.parse(readFileSync("templates/enterprise-rag.v1.json", "utf8")),
  );
  if (!parsed.success) throw new Error("Canonical workflow fixture is invalid.");
  return structuredClone(parsed.data);
}

const target = {
  provider: "synthetic-provider",
  model: "synthetic-model",
  deploymentMode: "test_only",
} as const;

function evidenceRecorder(runId: string) {
  let now = 0;
  const recorder = new RunEvidenceRecorder({ runIdFactory: () => runId, clock: () => now });
  now = 90;
  return recorder;
}

function completedEvidence(runId = "run_00000000-0000-4000-8000-000000000009"): RunEvidence {
  const recorder = evidenceRecorder(runId);
  recorder
    .markPlanValid(target)
    .passStage("user-input")
    .passStage("input-guardrail")
    .recordInputGuardrailDecision({
      status: "passed",
      code: "INPUT_GUARDRAIL_PASSED",
      explanation: DIAGNOSTIC_EXPLANATIONS.INPUT_GUARDRAIL_PASSED,
      inputCharacterCount: 80,
      maximumInputCharacters: 4_000,
      promptInjectionDetectionEnabled: true,
    })
    .passStage("document-source")
    .passStage("retrieval")
    .recordRetrievalEvidence({
      status: "passed",
      code: "RETRIEVAL_COMPLETED",
      explanation: DIAGNOSTIC_EXPLANATIONS.RETRIEVAL_COMPLETED,
      requestedTopK: 5,
      returnedChunkCount: 1,
      minimumRelevanceThreshold: 0.72,
      maximumContextCharacters: 24_000,
      relevance: { minimum: 0.8, maximum: 0.9, mean: 0.85 },
    })
    .passStage("gpt-agent")
    .recordModelEvidence({
      target,
      observed: {
        model: "synthetic-model",
        modelDigest: "sha256:synthetic-digest",
        runtime: "SyntheticRuntime",
        runtimeVersion: "1.0.0-test",
      },
      invocationReached: true,
      toolsUsed: false,
      thinkingUsed: false,
      handoffsUsed: false,
      persistenceUsed: false,
    })
    .passStage("output-guardrail")
    .recordOutputGuardrailDecision({
      status: "passed",
      code: "OUTPUT_GUARDRAIL_PASSED",
      explanation: DIAGNOSTIC_EXPLANATIONS.OUTPUT_GUARDRAIL_PASSED,
      schemaValidated: true,
      citationsRequired: true,
      citationsValidated: true,
      acceptedCitationCount: 1,
      activeContentDetected: false,
      sensitiveDataDetected: false,
      insufficientContext: false,
    })
    .passStage("evaluator")
    .recordEvaluatorResults(
      runDeterministicEvaluators({
        citationsRequired: true,
        citationIds: ["synthetic-citation"],
        acceptedCitationIds: new Set(["synthetic-citation"]),
        meanRelevance: 0.85,
        outputSchemaValid: true,
        citationStructureValid: true,
        thresholds: { citationCoverage: 0.9, retrievalRelevance: 0.75, structuralGrounding: 0.8 },
      }),
    )
    .passStage("response-output")
    .recordMetrics({
      providerDurationMs: 75,
      usage: { inputTokens: 40, outputTokens: 10, totalTokens: 50 },
      estimatedCostUsd: 0,
      externalApiCostUsd: 0,
    });
  return recorder.finalize({ status: "completed", code: "RUN_COMPLETED" });
}

function binding(
  workflow = canonicalWorkflow(),
  evidence = completedEvidence(),
): AssuranceRunBinding {
  const snapshot = createCanonicalWorkflowSnapshot(workflow);
  if (!snapshot.success) throw new Error("Workflow snapshot failed.");
  return {
    evidence,
    submittedWorkflow: snapshot.workflow,
    submittedCanonicalWorkflowBytes: snapshot.canonicalBytes,
  };
}

async function generate(workflow = canonicalWorkflow(), runBinding = binding(workflow)) {
  return generateArchitectureAssurance(
    workflow,
    validateCanonicalWorkflowArchitecture(workflow),
    runBinding,
  );
}

describe("architecture assurance export", () => {
  it("matches the checked-in synthetic assurance golden byte for byte", async () => {
    const result = await generate();
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.artifact.text).toBe(
      readFileSync(
        "tests/fixtures/exports/enterprise-rag.architecture-assurance.v1.0.0.md",
        "utf8",
      ),
    );
  });

  it("produces identical Markdown across repeated generation", async () => {
    const workflow = canonicalWorkflow();
    const runBinding = binding(workflow);
    expect(await generate(workflow, runBinding)).toEqual(await generate(workflow, runBinding));
  });

  it("preserves canonical section, node, edge, timeline, and evaluator ordering", async () => {
    const result = await generate();
    expect(result.success).toBe(true);
    if (!result.success) return;
    const text = result.artifact.text;
    const sections = [
      "Artifact identity",
      "Workflow identity and provenance",
      "Architecture status",
      "Node inventory",
      "Edge inventory",
      "Validation and readiness findings",
      "Policies and security boundaries",
      "Originating governed run",
      "Ordered execution timeline",
      "Guardrail and retrieval evidence",
      "Deterministic evaluator results",
      "Usage, duration, and cost",
      "Database and execution controls",
      "Limitations and non-claims",
    ];
    let offset = -1;
    for (const section of sections) {
      const next = text.indexOf(`## ${section}`);
      expect(next).toBeGreaterThan(offset);
      offset = next;
    }
    expect(text.indexOf("Node 1:")).toBeLessThan(text.indexOf("Node 9:"));
    expect(text.indexOf("Edge 1:")).toBeLessThan(text.indexOf("Edge 8:"));
    const workflow = canonicalWorkflow();
    const findings = await generateArchitectureAssurance(
      workflow,
      {
        structureValid: true,
        architectureValid: false,
        executionReady: false,
        errorCount: 3,
        warningCount: 0,
        findings: [
          {
            code: "MISSING_USER_INPUT",
            category: "graph",
            severity: "error",
            path: "$.nodes",
            message: "Synthetic workflow message.",
            remediation: "Synthetic workflow remediation.",
            subject: { kind: "workflow" },
          },
          {
            code: "CITATION_POLICY_MISMATCH",
            category: "security",
            severity: "error",
            path: "$.nodes[0]",
            message: "Synthetic node message.",
            remediation: "Synthetic node remediation.",
            subject: { kind: "node", id: workflow.nodes[0]!.id },
          },
          {
            code: "RUNTIME_EDGE_NON_EXECUTABLE",
            category: "readiness",
            severity: "error",
            path: "$.edges[0]",
            message: "Synthetic edge message.",
            remediation: "Synthetic edge remediation.",
            subject: { kind: "edge", id: workflow.edges[0]!.id },
          },
        ],
      },
      binding(workflow),
    );
    expect(findings.success).toBe(true);
    if (!findings.success) return;
    expect(findings.artifact.text.match(/### Finding/g)).toHaveLength(3);
    expect(findings.artifact.text.match(/- Subject ID:/g)).toHaveLength(2);
    expect(findings.artifact.text).not.toContain("Synthetic node message.");
    expect(findings.artifact.text).not.toContain("Synthetic edge remediation.");
    expect(text.indexOf("user\\-input")).toBeLessThan(
      text.indexOf("simulated\\-relational\\-database"),
    );
    expect(text.indexOf("citation\\_coverage")).toBeLessThan(
      text.indexOf("structural\\_grounding"),
    );
  });

  it("renders authoritative implementation, edge, and terminal timeline labels truthfully", async () => {
    const roadmapWorkflow = canonicalWorkflow();
    const retrieval = roadmapWorkflow.nodes.find((node) => node.type === "retrieval");
    if (!retrieval) throw new Error("Retrieval node missing.");
    roadmapWorkflow.nodes.push({
      ...structuredClone(retrieval),
      id: "roadmap-retrieval",
      label: "Roadmap Retrieval",
      implementationStatus: "roadmap",
    });
    const roadmap = await generate(roadmapWorkflow, binding(roadmapWorkflow));
    expect(roadmap.success).toBe(true);
    if (!roadmap.success) return;
    expect(roadmap.artifact.text).toContain("executable");
    expect(roadmap.artifact.text).toContain("simulated");
    expect(roadmap.artifact.text).toContain("roadmap");
    expect(roadmap.artifact.text).toContain("runtime");
    expect(roadmap.artifact.text).toContain("advisory");

    const blockedEvidence = evidenceRecorder("run_00000000-0000-4000-8000-000000000010").finalize({
      status: "blocked",
      code: "WORKFLOW_NOT_READY",
    });
    const blocked = await generate(
      canonicalWorkflow(),
      binding(canonicalWorkflow(), blockedEvidence),
    );
    expect(blocked.success && blocked.artifact.text).toContain("blocked");
    expect(blocked.success && blocked.artifact.text).toContain("not\\-started");
    expect(blocked.success && blocked.artifact.text).toContain("skipped");

    const failedRecorder = evidenceRecorder("run_00000000-0000-4000-8000-000000000011");
    failedRecorder
      .markPlanValid(target)
      .passStage("user-input")
      .passStage("input-guardrail")
      .recordInputGuardrailDecision({
        status: "passed",
        code: "INPUT_GUARDRAIL_PASSED",
        explanation: DIAGNOSTIC_EXPLANATIONS.INPUT_GUARDRAIL_PASSED,
        inputCharacterCount: 1,
        maximumInputCharacters: 4_000,
        promptInjectionDetectionEnabled: true,
      })
      .passStage("document-source")
      .passStage("retrieval")
      .recordRetrievalEvidence({
        status: "passed",
        code: "RETRIEVAL_COMPLETED",
        explanation: DIAGNOSTIC_EXPLANATIONS.RETRIEVAL_COMPLETED,
        requestedTopK: 5,
        returnedChunkCount: 1,
        minimumRelevanceThreshold: 0.72,
        maximumContextCharacters: 24_000,
        relevance: { minimum: 0.8, maximum: 0.8, mean: 0.8 },
      })
      .recordModelEvidence({
        target,
        invocationReached: true,
        toolsUsed: false,
        thinkingUsed: false,
        handoffsUsed: false,
        persistenceUsed: false,
      })
      .failStage("gpt-agent")
      .skipRemainingAfter("gpt-agent");
    const failedEvidence = failedRecorder.finalize({ status: "failed", code: "PROVIDER_ERROR" });
    const failed = await generate(
      canonicalWorkflow(),
      binding(canonicalWorkflow(), failedEvidence),
    );
    expect(failed.success && failed.artifact.text).toContain("failed");
  });

  it("binds exactly one validated run ID and workflow fingerprint", async () => {
    const result = await generate();
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(
      result.artifact.text.match(/run\\_00000000\\-0000\\-4000\\-8000\\-000000000009/g),
    ).toHaveLength(2);
    expect(result.artifact.text).toMatch(/Workflow fingerprint SHA\-256: [0-9a-f]{64}/);
  });

  it("rejects missing RunEvidence", async () => {
    const workflow = canonicalWorkflow();
    const result = await generateArchitectureAssurance(
      workflow,
      validateCanonicalWorkflowArchitecture(workflow),
      undefined,
    );
    expect(result).toMatchObject({ success: false, code: "EXPORT_RUN_MISSING" });
  });

  it("rejects stale workflow state and accepts exact restoration", async () => {
    const submitted = canonicalWorkflow();
    const runBinding = binding(submitted);
    const changed = structuredClone(submitted);
    changed.name = "Changed safe name";
    const stale = await generateArchitectureAssurance(
      changed,
      validateCanonicalWorkflowArchitecture(changed),
      runBinding,
    );
    expect(stale).toMatchObject({ success: false, code: "EXPORT_RUN_STALE" });
    expect((await generate(submitted, runBinding)).success).toBe(true);

    const unsafeCurrent = structuredClone(submitted);
    unsafeCurrent.description = "authorization=synthetic-current-value";
    const currentUnsafe = await generateArchitectureAssurance(
      unsafeCurrent,
      validateCanonicalWorkflowArchitecture(unsafeCurrent),
      runBinding,
    );
    expect(currentUnsafe).toMatchObject({ success: false, code: "EXPORT_WORKFLOW_UNSAFE" });
    expect(currentUnsafe).not.toHaveProperty("artifact");

    const unsafeSubmitted = structuredClone(submitted);
    unsafeSubmitted.description = "authorization=synthetic-submitted-value";
    const submittedUnsafe = await generateArchitectureAssurance(
      submitted,
      validateCanonicalWorkflowArchitecture(submitted),
      binding(unsafeSubmitted),
    );
    expect(submittedUnsafe).toMatchObject({ success: false, code: "EXPORT_WORKFLOW_UNSAFE" });
    expect(submittedUnsafe).not.toHaveProperty("artifact");
  });

  it("excludes user, model, secret, environment, identity, and receipt content", async () => {
    const workflow = canonicalWorkflow();
    workflow.metadata.owner = "OWNER_SENTINEL";
    const agent = workflow.nodes.find((node) => node.type === "gpt_agent");
    if (!agent || agent.type !== "gpt_agent") throw new Error("Agent missing.");
    agent.description = "ANSWER_SENTINEL";
    agent.configuration.systemInstruction = "PROMPT_SENTINEL";
    workflow.deployment.requiredEnvironmentVariables.push("SECRET_VALUE_SENTINEL");
    const runBinding = {
      ...binding(workflow),
      question: "QUESTION_SENTINEL",
      answer: "MODEL_ANSWER_SENTINEL",
      receipt: "RECEIPT_SENTINEL",
    } as AssuranceRunBinding;
    const result = await generate(workflow, runBinding);
    expect(result.success).toBe(true);
    if (!result.success) return;
    for (const sentinel of [
      "OWNER_SENTINEL",
      "ANSWER_SENTINEL",
      "PROMPT_SENTINEL",
      "SECRET_VALUE_SENTINEL",
      "QUESTION_SENTINEL",
      "MODEL_ANSWER_SENTINEL",
      "RECEIPT_SENTINEL",
    ]) {
      expect(result.artifact.text).not.toContain(sentinel);
    }
  });

  it("escapes every externally derived Markdown control sequence", async () => {
    const workflow = canonicalWorkflow();
    workflow.name = "# [workflow](unsafe) | table";
    workflow.nodes[0]!.label = "![node](unsafe) <node> `code`";
    workflow.edges[0]!.label = "--- > edge *bold*";
    const result = await generate(workflow, binding(workflow));
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.artifact.text).not.toContain("[workflow](unsafe)");
    expect(result.artifact.text).not.toContain("![node]");
    expect(result.artifact.text).not.toContain("<node>");
    expect(result.artifact.text).not.toContain("`code`");
    expect(result.artifact.text).toContain("\\| table");
  });

  it("rejects invalid evidence without exposing validation details", async () => {
    const workflow = canonicalWorkflow();
    const invalid = {
      ...completedEvidence(),
      explanation: "raw validation sentinel",
    } as RunEvidence;
    const result = await generateArchitectureAssurance(
      workflow,
      validateCanonicalWorkflowArchitecture(workflow),
      binding(workflow, invalid),
    );
    expect(result).toEqual({
      success: false,
      code: "EXPORT_EVIDENCE_INVALID",
      explanation: "The originating RunEvidence 1.0.0 object is invalid.",
    });
    expect(JSON.stringify(result)).not.toContain("raw validation sentinel");

    const mismatchedBinding = binding(workflow);
    const mismatchedSnapshot = await generateArchitectureAssurance(
      workflow,
      validateCanonicalWorkflowArchitecture(workflow),
      {
        ...mismatchedBinding,
        submittedCanonicalWorkflowBytes: mismatchedBinding.submittedCanonicalWorkflowBytes + " ",
      },
    );
    expect(mismatchedSnapshot).toEqual({
      success: false,
      code: "EXPORT_EVIDENCE_INVALID",
      explanation: "The originating RunEvidence 1.0.0 object is invalid.",
    });
    expect(mismatchedSnapshot).not.toHaveProperty("artifact");
  });
});
