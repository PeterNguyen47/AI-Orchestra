import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { addCompatibleConnection, connectionFromReactFlow } from "./connection-rules";
import { parseWorkflowJson } from "@/domain/workflow/workflow-parser";
import type { Workflow } from "@/domain/workflow/workflow-types";

function template(): Workflow {
  const parsed = parseWorkflowJson(
    readFileSync(resolve("templates/enterprise-rag.v1.json"), "utf8"),
  );
  if (!parsed.success) throw new Error("Invalid test template.");
  return parsed.data;
}

const runtimeRequest = {
  sourceNodeId: "user-input",
  sourcePortId: "question-out",
  targetNodeId: "input-guardrail",
  targetPortId: "question-in",
};
const advisoryRequest = {
  sourceNodeId: "simulated-relational-database",
  sourcePortId: "records-out",
  targetNodeId: "retrieval",
  targetPortId: "relational-records-in",
};

describe("connection rules", () => {
  it("creates valid runtime and advisory relationships with derived modes", () => {
    for (const [request, id, mode] of [
      [runtimeRequest, "runtime-new", "runtime"],
      [advisoryRequest, "advisory-new", "advisory"],
    ] as const) {
      const workflow = {
        ...template(),
        edges: template().edges.filter(
          (edge) =>
            !(
              edge.sourceNodeId === request.sourceNodeId &&
              edge.targetNodeId === request.targetNodeId
            ),
        ),
      };
      const result = addCompatibleConnection(workflow, request, () => id);
      expect(result.success).toBe(true);
      if (result.success) expect(result.edge.mode).toBe(mode);
    }
  });

  it.each([
    [
      { ...runtimeRequest, targetNodeId: "document-source", targetPortId: "documents-out" },
      "output port to an input",
    ],
    [
      { ...runtimeRequest, targetNodeId: "retrieval", targetPortId: "documents-in" },
      "incompatible",
    ],
    [{ ...runtimeRequest, targetNodeId: "user-input" }, "cannot connect to itself"],
    [{ ...runtimeRequest, sourceNodeId: "missing" }, "existing source"],
    [{ ...runtimeRequest, sourcePortId: "missing" }, "output port to an input"],
  ])("rejects unsafe request %#", (request, message) => {
    const result = addCompatibleConnection(template(), request, () => "edge-new");
    expect(result).toEqual(
      expect.objectContaining({ success: false, message: expect.stringContaining(message) }),
    );
  });

  it("rejects duplicate connections and structurally invalid edge IDs", () => {
    expect(addCompatibleConnection(template(), runtimeRequest, () => "edge-new")).toEqual(
      expect.objectContaining({
        success: false,
        message: expect.stringContaining("already exists"),
      }),
    );
    const withoutEdge = { ...template(), edges: template().edges.slice(1) };
    expect(addCompatibleConnection(withoutEdge, runtimeRequest, () => "INVALID ID")).toEqual(
      expect.objectContaining({
        success: false,
        message: expect.stringContaining("structurally invalid"),
      }),
    );
  });

  it("translates complete React Flow handle connections only", () => {
    expect(
      connectionFromReactFlow({
        source: "a",
        sourceHandle: "out",
        target: "b",
        targetHandle: "in",
      }),
    ).toEqual({ sourceNodeId: "a", sourcePortId: "out", targetNodeId: "b", targetPortId: "in" });
    expect(
      connectionFromReactFlow({ source: "a", sourceHandle: null, target: "b", targetHandle: "in" }),
    ).toBeUndefined();
  });
});
