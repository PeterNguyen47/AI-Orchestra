import "server-only";

import { randomUUID } from "node:crypto";
import { guardInput, protectOutput } from "@/domain/runtime/guardrails";
import {
  governedAnswerSchema,
  ModelAdapterRegistry,
  type ModelExecutionAdapter,
  type ResolvedModelTarget,
} from "@/domain/runtime/model-runtime";
import { retrieveLexically } from "@/domain/runtime/retrieval";
import { compileRuntimePlan } from "@/domain/runtime/runtime-plan";
import { loadEnterpriseRagCorpus } from "./knowledge-corpus";

export type ExecutionLimits = Readonly<{
  timeoutMs: number;
  maximumTotalTokens: number;
  maximumOutputTokens: number;
  maximumRunCostUsd: number;
  maximumConcurrentRuns: number;
}>;

export type GovernedRunResult =
  | Readonly<{
      status: "completed";
      answerMarkdown: string;
      citations: ReadonlyArray<{ id: string; title: string }>;
      usage: Readonly<{ inputTokens: number; outputTokens: number; totalTokens: number }>;
      estimatedCostUsd: number;
      durationMs: number;
      guardrail: "passed";
      evaluation: Readonly<{
        citationCoverage: 1;
        retrievalRelevant: true;
        structurallyGrounded: true;
      }>;
      databaseAccess: "not_opened_or_queried";
    }>
  | Readonly<{ status: "blocked"; code: string; databaseAccess: "not_opened_or_queried" }>
  | Readonly<{ status: "busy"; code: "EXECUTION_BUSY"; databaseAccess: "not_opened_or_queried" }>
  | Readonly<{
      status: "not-configured";
      code: "LIVE_EXECUTION_NOT_CONFIGURED";
      databaseAccess: "not_opened_or_queried";
    }>
  | Readonly<{ status: "failed"; code: string; databaseAccess: "not_opened_or_queried" }>;

const activeSubjects = new Set<string>();
let activeGlobal = 0;

const safeFailure = (code: string): GovernedRunResult => ({
  status: "failed",
  code,
  databaseAccess: "not_opened_or_queried",
});

function estimatedPreflightTokens(
  question: string,
  maximumContextCharacters: number,
  output: number,
) {
  return Math.ceil((question.length + maximumContextCharacters) / 3) + output;
}

function estimatedCost(inputTokens: number, outputTokens: number): number {
  return Number(((inputTokens * 2.5 + outputTokens * 15) / 1_000_000).toFixed(6));
}

export async function executeGovernedRag(
  input: Readonly<{
    workflow: unknown;
    question: string;
    subject: string;
    adapter: ModelExecutionAdapter;
    targetOverrideForTest?: ResolvedModelTarget;
    limits: ExecutionLimits;
  }>,
): Promise<GovernedRunResult> {
  const compiled = compileRuntimePlan(input.workflow);
  if (!compiled.success)
    return { status: "blocked", code: compiled.code, databaseAccess: "not_opened_or_queried" };
  const { plan } = compiled;
  const userNode = plan.nodes.user_input;
  const guardNode = plan.nodes.input_guardrail;
  const retrievalNode = plan.nodes.retrieval;
  const agentNode = plan.nodes.gpt_agent;
  if (
    userNode.type !== "user_input" ||
    guardNode.type !== "input_guardrail" ||
    retrievalNode.type !== "retrieval" ||
    agentNode.type !== "gpt_agent"
  )
    return safeFailure("RUNTIME_PLAN_INVALID");

  const guarded = guardInput(
    input.question,
    Math.min(userNode.configuration.maximumInputLength, guardNode.configuration.maximumInputLength),
  );
  if (!guarded.allowed)
    return { status: "blocked", code: guarded.code, databaseAccess: "not_opened_or_queried" };

  const maximumOutputTokens = Math.min(
    agentNode.configuration.maximumOutputTokens,
    input.limits.maximumOutputTokens,
  );
  const maximumTotalTokens = Math.min(
    plan.workflow.policies.executionLimits.maximumTotalTokens,
    input.limits.maximumTotalTokens,
  );
  const maximumCost = Math.min(
    plan.workflow.policies.executionLimits.maximumEstimatedCostUsd,
    input.limits.maximumRunCostUsd,
  );
  const preflightTokens = estimatedPreflightTokens(
    guarded.value,
    retrievalNode.configuration.maximumContextCharacters,
    maximumOutputTokens,
  );
  if (
    preflightTokens > maximumTotalTokens ||
    estimatedCost(preflightTokens - maximumOutputTokens, maximumOutputTokens) > maximumCost
  )
    return {
      status: "blocked",
      code: "EXECUTION_LIMIT_PREFLIGHT",
      databaseAccess: "not_opened_or_queried",
    };

  const retrieved = retrieveLexically(guarded.value, loadEnterpriseRagCorpus(), {
    topK: retrievalNode.configuration.topK,
    minimumRelevance: retrievalNode.configuration.minimumRelevanceScore,
    maximumContextCharacters: retrievalNode.configuration.maximumContextCharacters,
  });
  if (retrieved.length === 0)
    return {
      status: "blocked",
      code: "RETRIEVAL_NO_MATCH",
      databaseAccess: "not_opened_or_queried",
    };
  if (activeSubjects.has(input.subject) || activeGlobal >= input.limits.maximumConcurrentRuns)
    return { status: "busy", code: "EXECUTION_BUSY", databaseAccess: "not_opened_or_queried" };

  activeSubjects.add(input.subject);
  activeGlobal += 1;
  const started = performance.now();
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(new Error("EXECUTION_TIMEOUT")),
    input.limits.timeoutMs,
  );
  try {
    const target = input.targetOverrideForTest ?? plan.target;
    const adapter = new ModelAdapterRegistry().register(input.adapter).resolve(target);
    const context = retrieved
      .map((chunk) => `[chunk_id: ${chunk.id}]\n[source: ${chunk.title}]\n${chunk.text}`)
      .join("\n\n---\n\n");
    const result = await adapter.execute({
      target,
      instructions: agentNode.configuration.systemInstruction,
      untrustedContext: `Question:\n${guarded.value}\n\nUntrusted retrieved passages:\n${context}`,
      outputContract: governedAnswerSchema,
      limits: { maximumOutputTokens, timeoutMs: input.limits.timeoutMs },
      signal: controller.signal,
      metadata: { runId: randomUUID() },
    });
    if (result.status === "refused") return safeFailure("MODEL_REFUSED");
    if (result.usage.totalTokens > maximumTotalTokens) return safeFailure("TOKEN_LIMIT_EXCEEDED");
    const cost = estimatedCost(result.usage.inputTokens, result.usage.outputTokens);
    if (cost > maximumCost) return safeFailure("COST_LIMIT_EXCEEDED");
    const protectedOutput = protectOutput(
      result.output,
      new Set(retrieved.map((chunk) => chunk.id)),
    );
    if (!protectedOutput.success) return safeFailure(protectedOutput.code);
    if (protectedOutput.output.insufficientContext) return safeFailure("INSUFFICIENT_CONTEXT");
    return {
      status: "completed",
      answerMarkdown: protectedOutput.output.answerMarkdown,
      citations: protectedOutput.output.citationIds.map((id) => ({
        id,
        title: retrieved.find((chunk) => chunk.id === id)!.title,
      })),
      usage: result.usage,
      estimatedCostUsd: cost,
      durationMs: Math.round(performance.now() - started),
      guardrail: "passed",
      evaluation: { citationCoverage: 1, retrievalRelevant: true, structurallyGrounded: true },
      databaseAccess: plan.databaseAccess,
    };
  } catch (error) {
    if (controller.signal.aborted) return safeFailure("EXECUTION_TIMEOUT");
    return safeFailure(
      error instanceof Error && error.message === "PROVIDER_OUTPUT_MALFORMED"
        ? error.message
        : "PROVIDER_ERROR",
    );
  } finally {
    clearTimeout(timer);
    activeSubjects.delete(input.subject);
    activeGlobal -= 1;
  }
}
