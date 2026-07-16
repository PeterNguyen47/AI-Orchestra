import { z } from "zod";

export const CURRENT_WORKFLOW_SCHEMA_VERSION = "1.0.0" as const;
export const WORKFLOW_SCHEMA_ID =
  "https://ai-orchestra.dev/schemas/workflow.v1.schema.json" as const;

export const IMPLEMENTATION_STATUSES = ["executable", "simulated", "roadmap"] as const;
export const SUPPORTED_NODE_TYPES = [
  "user_input",
  "input_guardrail",
  "document_source",
  "retrieval",
  "gpt_agent",
  "output_guardrail",
  "evaluator",
  "response_output",
  "relational_database",
] as const;
export const EDGE_MODES = ["runtime", "advisory"] as const;
export const DATA_CLASSIFICATIONS = ["public", "internal", "confidential", "restricted"] as const;
export const TRUST_ZONES = [
  "browser",
  "application",
  "external_service",
  "enterprise_system",
] as const;
export const DEPLOYMENT_PROFILES = ["local_docker"] as const;
export const PORT_DIRECTIONS = ["input", "output"] as const;
export const DATA_CONTRACTS = [
  "user_query",
  "guarded_query",
  "document_collection",
  "retrieval_context",
  "agent_response",
  "guarded_response",
  "evaluated_response",
  "relational_records",
] as const;
export const EVALUATION_METRICS = ["groundedness", "relevance", "citation_coverage"] as const;

const nonBlankString = (maximumLength: number) =>
  z
    .string()
    .min(1)
    .max(maximumLength)
    .regex(/\S/, "Value must contain at least one non-whitespace character");

const stableIdentifier = (description: string) =>
  z
    .string()
    .min(1)
    .max(100)
    .regex(
      /^[a-z][a-z0-9]*(?:[-_.][a-z0-9]+)*$/,
      "Use a lowercase stable identifier separated by hyphens, underscores, or periods",
    )
    .describe(description);

export const WorkflowSchemaVersionSchema = z
  .literal(CURRENT_WORKFLOW_SCHEMA_VERSION)
  .describe("Version of the AI Orchestra workflow contract.");

export const SemanticVersionSchema = z
  .string()
  .min(1)
  .max(50)
  .regex(
    /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/,
    "Use a semantic version such as 1.0.0",
  )
  .describe("Semantic version string.");

export const WorkflowIdSchema = stableIdentifier("Stable workflow identifier.");
export const TemplateIdSchema = stableIdentifier("Stable workflow-template identifier.");
export const NodeIdSchema = stableIdentifier("Stable node identifier unique within a workflow.");
export const EdgeIdSchema = stableIdentifier("Stable edge identifier unique within a workflow.");
export const PortIdSchema = stableIdentifier("Stable port identifier unique within its node.");
export const ToolIdSchema = stableIdentifier("Identifier for a policy-allowed tool.");

export const EnvironmentVariableNameSchema = z
  .string()
  .min(1)
  .max(128)
  .regex(
    /^[A-Z_][A-Z0-9_]*$/,
    "Environment-variable references must use uppercase letters, digits, and underscores",
  )
  .describe("Environment-variable name only; never the referenced secret value.");

export const RepositoryReferenceSchema = z
  .string()
  .min(1)
  .max(300)
  .regex(
    /^(?:[A-Za-z0-9][A-Za-z0-9._-]*\/)*[A-Za-z0-9][A-Za-z0-9._-]*(?:#[A-Za-z0-9][A-Za-z0-9._-]*)?$/,
    "Use a repository-relative path or logical identifier without absolute or parent segments",
  )
  .describe("Repository-relative path or stable logical reference.");

export const ImplementationStatusSchema = z
  .enum(IMPLEMENTATION_STATUSES)
  .describe("Truthful implementation claim for a workflow node.");
export const NodeTypeSchema = z.enum(SUPPORTED_NODE_TYPES);
export const EdgeModeSchema = z.enum(EDGE_MODES);
export const DataClassificationSchema = z.enum(DATA_CLASSIFICATIONS);
export const TrustZoneSchema = z.enum(TRUST_ZONES);
export const DeploymentProfileSchema = z.enum(DEPLOYMENT_PROFILES);
export const PortDirectionSchema = z.enum(PORT_DIRECTIONS);
export const DataContractSchema = z
  .enum(DATA_CONTRACTS)
  .describe("Portable payload contract used to check port compatibility.");
export const EvaluationMetricSchema = z.enum(EVALUATION_METRICS);
export const RequiredEvaluationMetricsSchema = z.strictObject({
  groundedness: z.literal(true),
  relevance: z.literal(true),
  citation_coverage: z.literal(true),
});

export const PositionSchema = z
  .strictObject({
    x: z.number().finite().min(-1_000_000).max(1_000_000),
    y: z.number().finite().min(-1_000_000).max(1_000_000),
  })
  .describe("Deterministic canvas coordinates for future visual editing.");

export const PortSchema = z
  .strictObject({
    id: PortIdSchema,
    direction: PortDirectionSchema,
    dataContract: DataContractSchema,
  })
  .describe("Declared node port with a stable identifier, direction, and payload contract.");

export const SecurityMetadataSchema = z
  .strictObject({
    dataClassification: DataClassificationSchema,
    trustZone: TrustZoneSchema,
  })
  .describe("Explicit data sensitivity and trust-boundary metadata.");

export const SecretReferenceSchema = z
  .strictObject({
    environmentVariableName: EnvironmentVariableNameSchema,
  })
  .describe("Reference to a secret supplied by the environment; no secret value is permitted.");

export const UserInputConfigurationSchema = z.strictObject({
  inputMode: z.literal("text"),
  maximumInputLength: z.number().int().min(1).max(1_000_000),
  acceptedContentType: z.literal("text/plain"),
});

export const InputGuardrailConfigurationSchema = z.strictObject({
  promptInjectionDetectionEnabled: z.boolean(),
  maximumInputLength: z.number().int().min(1).max(1_000_000),
  action: z.enum(["block", "review"]),
});

export const DocumentSourceConfigurationSchema = z.strictObject({
  sourceMode: z.enum(["bundled", "upload"]),
  allowedMimeTypes: z
    .array(
      z
        .string()
        .min(3)
        .max(100)
        .regex(/^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+$/, "Use a valid lowercase MIME type"),
    )
    .min(1)
    .max(32),
  maximumFileSizeBytes: z.number().int().min(1).max(104_857_600),
  dataClassification: DataClassificationSchema,
});

export const RetrievalConfigurationSchema = z.strictObject({
  topK: z.number().int().min(1).max(100),
  minimumRelevanceScore: z.number().min(0).max(1),
  maximumContextCharacters: z.number().int().min(1).max(1_000_000),
  citationsRequired: z.boolean(),
});

export const GptAgentConfigurationSchema = z.strictObject({
  model: z.enum(["qwen3:4b", "gpt-5.6"]),
  systemInstruction: nonBlankString(20_000),
  reasoningEffort: z.enum(["low", "medium", "high"]),
  maximumOutputTokens: z.number().int().min(1).max(128_000),
  allowedTools: z.array(ToolIdSchema).max(16),
});

export const OutputGuardrailConfigurationSchema = z.strictObject({
  citationsRequired: z.boolean(),
  sensitiveDataPolicy: z.enum(["block", "redact", "review"]),
  unsupportedAnswerBehavior: z.enum(["decline", "request_clarification"]),
});

export const EvaluationMetricThresholdsSchema = z.strictObject({
  groundedness: z.number().min(0).max(1),
  relevance: z.number().min(0).max(1),
  citation_coverage: z.number().min(0).max(1),
});

export const EvaluatorConfigurationSchema = z.strictObject({
  requiredMetrics: RequiredEvaluationMetricsSchema,
  metricThresholds: EvaluationMetricThresholdsSchema,
  overallPassThreshold: z.number().min(0).max(1),
});

export const ResponseOutputConfigurationSchema = z.strictObject({
  outputFormat: z.enum(["markdown", "plain_text", "json"]),
  citationRendering: z.enum(["inline", "source_list"]),
});

export const RelationalDatabaseConfigurationSchema = z.strictObject({
  engineType: z.enum(["postgresql", "mysql", "sql_server", "sqlite"]),
  connectionReference: SecretReferenceSchema,
  accessMode: z.literal("read_only"),
  approvedSchemasOrDatasets: z
    .array(stableIdentifier("Approved schema or dataset."))
    .min(1)
    .max(32),
  dataClassification: DataClassificationSchema,
  simulationNotice: nonBlankString(500),
});

const commonNodeFields = {
  id: NodeIdSchema,
  label: nonBlankString(120),
  description: nonBlankString(1_000),
  implementationStatus: ImplementationStatusSchema,
  position: PositionSchema,
  ports: z.array(PortSchema).min(1).max(32),
  security: SecurityMetadataSchema,
  documentationRef: RepositoryReferenceSchema,
};

export const UserInputNodeSchema = z.strictObject({
  ...commonNodeFields,
  type: z.literal("user_input"),
  configuration: UserInputConfigurationSchema,
});

export const InputGuardrailNodeSchema = z.strictObject({
  ...commonNodeFields,
  type: z.literal("input_guardrail"),
  configuration: InputGuardrailConfigurationSchema,
});

export const DocumentSourceNodeSchema = z.strictObject({
  ...commonNodeFields,
  type: z.literal("document_source"),
  configuration: DocumentSourceConfigurationSchema,
});

export const RetrievalNodeSchema = z.strictObject({
  ...commonNodeFields,
  type: z.literal("retrieval"),
  configuration: RetrievalConfigurationSchema,
});

export const GptAgentNodeSchema = z.strictObject({
  ...commonNodeFields,
  type: z.literal("gpt_agent"),
  configuration: GptAgentConfigurationSchema,
});

export const OutputGuardrailNodeSchema = z.strictObject({
  ...commonNodeFields,
  type: z.literal("output_guardrail"),
  configuration: OutputGuardrailConfigurationSchema,
});

export const EvaluatorNodeSchema = z.strictObject({
  ...commonNodeFields,
  type: z.literal("evaluator"),
  configuration: EvaluatorConfigurationSchema,
});

export const ResponseOutputNodeSchema = z.strictObject({
  ...commonNodeFields,
  type: z.literal("response_output"),
  configuration: ResponseOutputConfigurationSchema,
});

export const RelationalDatabaseNodeSchema = z.strictObject({
  ...commonNodeFields,
  type: z.literal("relational_database"),
  implementationStatus: z.literal("simulated"),
  configuration: RelationalDatabaseConfigurationSchema,
});

export const WorkflowNodeSchema = z
  .discriminatedUnion("type", [
    UserInputNodeSchema,
    InputGuardrailNodeSchema,
    DocumentSourceNodeSchema,
    RetrievalNodeSchema,
    GptAgentNodeSchema,
    OutputGuardrailNodeSchema,
    EvaluatorNodeSchema,
    ResponseOutputNodeSchema,
    RelationalDatabaseNodeSchema,
  ])
  .describe("Closed discriminated union of supported workflow node contracts.");

export const WorkflowEdgeSchema = z
  .strictObject({
    id: EdgeIdSchema,
    sourceNodeId: NodeIdSchema,
    sourcePortId: PortIdSchema,
    targetNodeId: NodeIdSchema,
    targetPortId: PortIdSchema,
    mode: EdgeModeSchema,
    dataContract: DataContractSchema,
    label: nonBlankString(120),
  })
  .describe("Directed connection between two declared workflow ports.");

export const WorkflowDataPolicySchema = z.strictObject({
  defaultClassification: DataClassificationSchema,
});

export const WorkflowToolPolicySchema = z.strictObject({
  allowedTools: z.array(ToolIdSchema).max(32),
});

export const WorkflowHumanApprovalPolicySchema = z.strictObject({
  required: z.boolean(),
});

export const WorkflowExecutionLimitsSchema = z.strictObject({
  maximumSteps: z.number().int().min(1).max(1_000),
  maximumTotalTokens: z.number().int().min(1).max(10_000_000),
  maximumEstimatedCostUsd: z.number().min(0.01).max(100_000),
});

export const WorkflowPoliciesSchema = z
  .strictObject({
    dataPolicy: WorkflowDataPolicySchema,
    toolPolicy: WorkflowToolPolicySchema,
    humanApprovalPolicy: WorkflowHumanApprovalPolicySchema,
    executionLimits: WorkflowExecutionLimitsSchema,
  })
  .describe("Workflow-wide data, tool, approval, and bounded-execution policies.");

export const WorkflowEvaluationSchema = z
  .strictObject({
    requiredMetrics: RequiredEvaluationMetricsSchema,
    metricThresholds: EvaluationMetricThresholdsSchema,
    overallPassThreshold: z.number().min(0).max(1),
    datasetReference: RepositoryReferenceSchema,
  })
  .describe("Declarative evaluation requirements; this contract does not execute them.");

export const WorkflowDeploymentSchema = z
  .strictObject({
    profile: z.literal("local_docker"),
    profileReference: RepositoryReferenceSchema,
    requiredEnvironmentVariables: z.array(EnvironmentVariableNameSchema).max(64),
  })
  .describe("Reference to the existing local Docker deployment profile.");

export const WorkflowTemplateReferenceSchema = z.strictObject({
  id: TemplateIdSchema,
  version: SemanticVersionSchema,
});

export const WorkflowMetadataSchema = z.strictObject({
  owner: nonBlankString(120),
  tags: z.array(stableIdentifier("Searchable workflow metadata tag.")).max(32),
  documentationRef: RepositoryReferenceSchema,
});

export const WorkflowSchema = z
  .strictObject({
    schemaVersion: WorkflowSchemaVersionSchema,
    workflowId: WorkflowIdSchema,
    template: WorkflowTemplateReferenceSchema,
    name: nonBlankString(160),
    description: nonBlankString(2_000),
    nodes: z.array(WorkflowNodeSchema).min(1).max(256),
    edges: z.array(WorkflowEdgeSchema).max(1_024),
    policies: WorkflowPoliciesSchema,
    evaluation: WorkflowEvaluationSchema,
    deployment: WorkflowDeploymentSchema,
    metadata: WorkflowMetadataSchema,
  })
  .describe(
    "AI Orchestra workflow contract version 1.0.0. Cross-node graph rules are validated separately.",
  );
