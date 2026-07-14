import { DATA_CLASSIFICATIONS, TRUST_ZONES } from "./workflow-schema";
import type { Workflow, WorkflowEdge, WorkflowNode, WorkflowPort } from "./workflow-types";

export const WORKFLOW_VALIDATION_CODES = {
  duplicateNodeId: "DUPLICATE_NODE_ID",
  duplicateEdgeId: "DUPLICATE_EDGE_ID",
  duplicatePortId: "DUPLICATE_PORT_ID",
  missingSourceNode: "MISSING_SOURCE_NODE",
  missingTargetNode: "MISSING_TARGET_NODE",
  missingSourcePort: "MISSING_SOURCE_PORT",
  missingTargetPort: "MISSING_TARGET_PORT",
  invalidSourcePortDirection: "INVALID_SOURCE_PORT_DIRECTION",
  invalidTargetPortDirection: "INVALID_TARGET_PORT_DIRECTION",
  selfReferencingEdge: "SELF_REFERENCING_EDGE",
  duplicateLogicalEdge: "DUPLICATE_LOGICAL_EDGE",
  runtimeEdgeNonExecutable: "RUNTIME_EDGE_NON_EXECUTABLE",
  incompatibleDataContract: "INCOMPATIBLE_DATA_CONTRACT",
  missingUserInput: "MISSING_USER_INPUT",
  missingResponseOutput: "MISSING_RESPONSE_OUTPUT",
  noRuntimePath: "NO_RUNTIME_PATH",
  disconnectedExecutableNode: "DISCONNECTED_EXECUTABLE_NODE",
  missingSecurityMetadata: "MISSING_SECURITY_METADATA",
  invalidSecurityMetadata: "INVALID_SECURITY_METADATA",
  invalidEnvironmentVariableReference: "INVALID_ENVIRONMENT_VARIABLE_REFERENCE",
  embeddedCredential: "LIKELY_EMBEDDED_SECRET",
} as const;

export type WorkflowValidationCode =
  (typeof WORKFLOW_VALIDATION_CODES)[keyof typeof WORKFLOW_VALIDATION_CODES];
export type WorkflowValidationSeverity = "error" | "warning";

export type WorkflowValidationFinding = Readonly<{
  code: WorkflowValidationCode;
  severity: WorkflowValidationSeverity;
  path: string;
  message: string;
}>;

export type WorkflowValidationResult = Readonly<{
  valid: boolean;
  findings: ReadonlyArray<WorkflowValidationFinding>;
}>;

type NodeIndex = ReadonlyMap<string, { node: WorkflowNode; index: number }>;

type ResolvedRuntimeEdge = Readonly<{
  edge: WorkflowEdge;
  source: WorkflowNode;
  target: WorkflowNode;
}>;

const environmentVariablePattern = /^[A-Z_][A-Z0-9_]*$/;
const sensitiveKeyPattern =
  /(api.?key|authorization|credential|pass(word|phrase)?|private.?key|secret|token)/i;
const sensitiveValuePatterns = [
  /\bsk-[A-Za-z0-9_-]{12,}\b/,
  /\bgh[pousr]_[A-Za-z0-9]{12,}\b/,
  /\bAKIA[A-Z0-9]{12,}\b/,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /^[a-z][a-z0-9+.-]*:\/\/[^\s/:]+:[^\s/@]+@/i,
];

function finding(
  code: WorkflowValidationCode,
  path: string,
  message: string,
): WorkflowValidationFinding {
  return { code, severity: "error", path, message };
}

function findPort(node: WorkflowNode, portId: string): WorkflowPort | undefined {
  return node.ports.find((port) => port.id === portId);
}

function logicalEdgeKey(edge: WorkflowEdge): string {
  return [edge.sourceNodeId, edge.sourcePortId, edge.targetNodeId, edge.targetPortId].join(
    "\u0000",
  );
}

function buildFirstNodeIndex(workflow: Workflow): NodeIndex {
  const nodes = new Map<string, { node: WorkflowNode; index: number }>();

  workflow.nodes.forEach((node, index) => {
    if (!nodes.has(node.id)) {
      nodes.set(node.id, { node, index });
    }
  });

  return nodes;
}

function resolveValidRuntimeEdges(workflow: Workflow, nodes: NodeIndex): ResolvedRuntimeEdge[] {
  const resolved: ResolvedRuntimeEdge[] = [];

  for (const edge of workflow.edges) {
    if (edge.mode !== "runtime" || edge.sourceNodeId === edge.targetNodeId) {
      continue;
    }

    const source = nodes.get(edge.sourceNodeId)?.node;
    const target = nodes.get(edge.targetNodeId)?.node;

    if (
      source === undefined ||
      target === undefined ||
      source.implementationStatus !== "executable" ||
      target.implementationStatus !== "executable"
    ) {
      continue;
    }

    const sourcePort = findPort(source, edge.sourcePortId);
    const targetPort = findPort(target, edge.targetPortId);

    if (
      sourcePort === undefined ||
      targetPort === undefined ||
      sourcePort.direction !== "output" ||
      targetPort.direction !== "input" ||
      sourcePort.dataContract !== targetPort.dataContract ||
      edge.dataContract !== sourcePort.dataContract
    ) {
      continue;
    }

    resolved.push({ edge, source, target });
  }

  return resolved;
}

function adjacencyFor(
  edges: ReadonlyArray<ResolvedRuntimeEdge>,
  reverse = false,
): ReadonlyMap<string, ReadonlyArray<string>> {
  const adjacency = new Map<string, string[]>();

  edges.forEach(({ source, target }) => {
    const from = reverse ? target.id : source.id;
    const to = reverse ? source.id : target.id;
    const neighbors = adjacency.get(from) ?? [];
    neighbors.push(to);
    adjacency.set(from, neighbors);
  });

  adjacency.forEach((neighbors) => neighbors.sort());
  return adjacency;
}

function reachableFrom(
  seeds: ReadonlyArray<string>,
  adjacency: ReadonlyMap<string, ReadonlyArray<string>>,
): Set<string> {
  const visited = new Set<string>();
  const queue = [...new Set(seeds)].sort();

  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const current = queue[cursor]!;

    if (visited.has(current)) {
      continue;
    }

    visited.add(current);
    for (const neighbor of adjacency.get(current) ?? []) {
      if (!visited.has(neighbor)) {
        queue.push(neighbor);
      }
    }
  }

  return visited;
}

export function getRuntimeReachableNodeIds(workflow: Workflow): ReadonlyArray<string> {
  const nodes = buildFirstNodeIndex(workflow);
  const runtimeEdges = resolveValidRuntimeEdges(workflow, nodes);
  const sources = workflow.nodes
    .filter(
      (node) =>
        node.implementationStatus === "executable" &&
        (node.type === "user_input" || node.type === "document_source"),
    )
    .map((node) => node.id);

  return [...reachableFrom(sources, adjacencyFor(runtimeEdges))].sort();
}

function inspectSecretValues(
  value: unknown,
  path: string,
  findings: WorkflowValidationFinding[],
  key = "",
): void {
  if (typeof value === "string") {
    if (key === "environmentVariableName") {
      if (!environmentVariablePattern.test(value)) {
        findings.push(
          finding(
            WORKFLOW_VALIDATION_CODES.invalidEnvironmentVariableReference,
            path,
            "Secret references must contain a valid environment-variable name only.",
          ),
        );
      }
      return;
    }

    if (
      (sensitiveKeyPattern.test(key) &&
        value.length > 0 &&
        !environmentVariablePattern.test(value)) ||
      sensitiveValuePatterns.some((pattern) => pattern.test(value))
    ) {
      findings.push(
        finding(
          WORKFLOW_VALIDATION_CODES.embeddedCredential,
          path,
          "Configuration appears to contain an embedded secret value; reference an environment variable instead.",
        ),
      );
    }
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((entry, index) => inspectSecretValues(entry, `${path}[${index}]`, findings));
    return;
  }

  if (value === null || typeof value !== "object") {
    return;
  }

  Object.entries(value as Record<string, unknown>).forEach(([property, entry]) => {
    inspectSecretValues(entry, `${path}.${property}`, findings, property);
  });
}

export function validateWorkflowSemantics(workflow: Workflow): WorkflowValidationResult {
  const findings: WorkflowValidationFinding[] = [];
  const firstNodeIndex = new Map<string, number>();

  workflow.nodes.forEach((node, nodeIndex) => {
    const priorNodeIndex = firstNodeIndex.get(node.id);
    if (priorNodeIndex !== undefined) {
      findings.push(
        finding(
          WORKFLOW_VALIDATION_CODES.duplicateNodeId,
          `$.nodes[${nodeIndex}].id`,
          `Node ID '${node.id}' duplicates $.nodes[${priorNodeIndex}].id.`,
        ),
      );
    } else {
      firstNodeIndex.set(node.id, nodeIndex);
    }

    const firstPortIndex = new Map<string, number>();
    node.ports.forEach((port, portIndex) => {
      const priorPortIndex = firstPortIndex.get(port.id);
      if (priorPortIndex !== undefined) {
        findings.push(
          finding(
            WORKFLOW_VALIDATION_CODES.duplicatePortId,
            `$.nodes[${nodeIndex}].ports[${portIndex}].id`,
            `Port ID '${port.id}' duplicates $.nodes[${nodeIndex}].ports[${priorPortIndex}].id.`,
          ),
        );
      } else {
        firstPortIndex.set(port.id, portIndex);
      }
    });

    const security = (node as Partial<WorkflowNode>).security;
    if (security === undefined || security === null) {
      findings.push(
        finding(
          WORKFLOW_VALIDATION_CODES.missingSecurityMetadata,
          `$.nodes[${nodeIndex}].security`,
          "Every node must declare security metadata.",
        ),
      );
    } else if (
      !DATA_CLASSIFICATIONS.includes(security.dataClassification) ||
      !TRUST_ZONES.includes(security.trustZone)
    ) {
      findings.push(
        finding(
          WORKFLOW_VALIDATION_CODES.invalidSecurityMetadata,
          `$.nodes[${nodeIndex}].security`,
          "Node security metadata must use a supported classification and trust zone.",
        ),
      );
    }

    inspectSecretValues(node.configuration, `$.nodes[${nodeIndex}].configuration`, findings);
  });

  workflow.deployment.requiredEnvironmentVariables.forEach((name, index) => {
    if (!environmentVariablePattern.test(name)) {
      findings.push(
        finding(
          WORKFLOW_VALIDATION_CODES.invalidEnvironmentVariableReference,
          `$.deployment.requiredEnvironmentVariables[${index}]`,
          "Deployment environment-variable references must use uppercase letters, digits, and underscores.",
        ),
      );
    }
  });

  const nodes = buildFirstNodeIndex(workflow);
  const firstEdgeIdIndex = new Map<string, number>();
  const firstLogicalEdgeIndex = new Map<string, number>();

  workflow.edges.forEach((edge, edgeIndex) => {
    const priorEdgeIdIndex = firstEdgeIdIndex.get(edge.id);
    if (priorEdgeIdIndex !== undefined) {
      findings.push(
        finding(
          WORKFLOW_VALIDATION_CODES.duplicateEdgeId,
          `$.edges[${edgeIndex}].id`,
          `Edge ID '${edge.id}' duplicates $.edges[${priorEdgeIdIndex}].id.`,
        ),
      );
    } else {
      firstEdgeIdIndex.set(edge.id, edgeIndex);
    }

    const logicalKey = logicalEdgeKey(edge);
    const priorLogicalEdgeIndex = firstLogicalEdgeIndex.get(logicalKey);
    if (priorLogicalEdgeIndex !== undefined) {
      findings.push(
        finding(
          WORKFLOW_VALIDATION_CODES.duplicateLogicalEdge,
          `$.edges[${edgeIndex}]`,
          `Edge duplicates the endpoints declared at $.edges[${priorLogicalEdgeIndex}].`,
        ),
      );
    } else {
      firstLogicalEdgeIndex.set(logicalKey, edgeIndex);
    }

    if (edge.sourceNodeId === edge.targetNodeId) {
      findings.push(
        finding(
          WORKFLOW_VALIDATION_CODES.selfReferencingEdge,
          `$.edges[${edgeIndex}]`,
          "Self-referencing edges are not allowed.",
        ),
      );
    }

    const source = nodes.get(edge.sourceNodeId)?.node;
    const target = nodes.get(edge.targetNodeId)?.node;

    if (source === undefined) {
      findings.push(
        finding(
          WORKFLOW_VALIDATION_CODES.missingSourceNode,
          `$.edges[${edgeIndex}].sourceNodeId`,
          `Source node '${edge.sourceNodeId}' does not exist.`,
        ),
      );
    }

    if (target === undefined) {
      findings.push(
        finding(
          WORKFLOW_VALIDATION_CODES.missingTargetNode,
          `$.edges[${edgeIndex}].targetNodeId`,
          `Target node '${edge.targetNodeId}' does not exist.`,
        ),
      );
    }

    const sourcePort = source === undefined ? undefined : findPort(source, edge.sourcePortId);
    const targetPort = target === undefined ? undefined : findPort(target, edge.targetPortId);

    if (source !== undefined && sourcePort === undefined) {
      findings.push(
        finding(
          WORKFLOW_VALIDATION_CODES.missingSourcePort,
          `$.edges[${edgeIndex}].sourcePortId`,
          `Source port '${edge.sourcePortId}' does not exist on node '${source.id}'.`,
        ),
      );
    } else if (sourcePort !== undefined && sourcePort.direction !== "output") {
      findings.push(
        finding(
          WORKFLOW_VALIDATION_CODES.invalidSourcePortDirection,
          `$.edges[${edgeIndex}].sourcePortId`,
          "An edge source must resolve to an output port.",
        ),
      );
    }

    if (target !== undefined && targetPort === undefined) {
      findings.push(
        finding(
          WORKFLOW_VALIDATION_CODES.missingTargetPort,
          `$.edges[${edgeIndex}].targetPortId`,
          `Target port '${edge.targetPortId}' does not exist on node '${target.id}'.`,
        ),
      );
    } else if (targetPort !== undefined && targetPort.direction !== "input") {
      findings.push(
        finding(
          WORKFLOW_VALIDATION_CODES.invalidTargetPortDirection,
          `$.edges[${edgeIndex}].targetPortId`,
          "An edge target must resolve to an input port.",
        ),
      );
    }

    if (
      sourcePort !== undefined &&
      targetPort !== undefined &&
      (sourcePort.dataContract !== targetPort.dataContract ||
        edge.dataContract !== sourcePort.dataContract ||
        edge.dataContract !== targetPort.dataContract)
    ) {
      findings.push(
        finding(
          WORKFLOW_VALIDATION_CODES.incompatibleDataContract,
          `$.edges[${edgeIndex}].dataContract`,
          "Edge and endpoint port data contracts must match exactly.",
        ),
      );
    }

    if (
      edge.mode === "runtime" &&
      source !== undefined &&
      target !== undefined &&
      (source.implementationStatus !== "executable" || target.implementationStatus !== "executable")
    ) {
      findings.push(
        finding(
          WORKFLOW_VALIDATION_CODES.runtimeEdgeNonExecutable,
          `$.edges[${edgeIndex}].mode`,
          "Runtime edges may connect executable nodes only.",
        ),
      );
    }
  });

  const userInputs = workflow.nodes.filter((node) => node.type === "user_input");
  const responseOutputs = workflow.nodes.filter((node) => node.type === "response_output");

  if (userInputs.length === 0) {
    findings.push(
      finding(
        WORKFLOW_VALIDATION_CODES.missingUserInput,
        "$.nodes",
        "Workflow must contain at least one user_input node.",
      ),
    );
  }

  if (responseOutputs.length === 0) {
    findings.push(
      finding(
        WORKFLOW_VALIDATION_CODES.missingResponseOutput,
        "$.nodes",
        "Workflow must contain at least one response_output node.",
      ),
    );
  }

  const runtimeEdges = resolveValidRuntimeEdges(workflow, nodes);
  const forwardAdjacency = adjacencyFor(runtimeEdges);
  const reverseAdjacency = adjacencyFor(runtimeEdges, true);
  const reachableFromInputs = reachableFrom(
    userInputs.filter((node) => node.implementationStatus === "executable").map((node) => node.id),
    forwardAdjacency,
  );
  const executableOutputIds = responseOutputs
    .filter((node) => node.implementationStatus === "executable")
    .map((node) => node.id);

  if (
    userInputs.length > 0 &&
    responseOutputs.length > 0 &&
    !executableOutputIds.some((id) => reachableFromInputs.has(id))
  ) {
    findings.push(
      finding(
        WORKFLOW_VALIDATION_CODES.noRuntimePath,
        "$.edges",
        "Executable runtime edges must form a directed path from user_input to response_output.",
      ),
    );
  }

  const executableSourceIds = workflow.nodes
    .filter(
      (node) =>
        node.implementationStatus === "executable" &&
        (node.type === "user_input" || node.type === "document_source"),
    )
    .map((node) => node.id);
  const reachableFromSources = reachableFrom(executableSourceIds, forwardAdjacency);
  const canReachOutput = reachableFrom(executableOutputIds, reverseAdjacency);

  workflow.nodes.forEach((node, nodeIndex) => {
    if (
      node.implementationStatus === "executable" &&
      (!reachableFromSources.has(node.id) || !canReachOutput.has(node.id))
    ) {
      findings.push(
        finding(
          WORKFLOW_VALIDATION_CODES.disconnectedExecutableNode,
          `$.nodes[${nodeIndex}]`,
          `Executable node '${node.id}' is not on a valid runtime source-to-output path.`,
        ),
      );
    }
  });

  findings.sort((left, right) => {
    if (left.path !== right.path) return left.path < right.path ? -1 : 1;
    if (left.code !== right.code) return left.code < right.code ? -1 : 1;
    return left.message < right.message ? -1 : left.message > right.message ? 1 : 0;
  });

  return { valid: findings.length === 0, findings };
}
