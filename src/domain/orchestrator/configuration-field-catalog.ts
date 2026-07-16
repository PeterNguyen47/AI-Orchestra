import type { NodeType } from "@/domain/workflow/workflow-types";

export type ConfigurationFieldKind =
  "text" | "textarea" | "integer" | "decimal" | "checkbox" | "select" | "list" | "readonly";

export type ConfigurationField = Readonly<{
  key: string;
  label: string;
  help: string;
  kind: ConfigurationFieldKind;
  required: boolean;
  constraint: string;
  options?: ReadonlyArray<string> | undefined;
  minimum?: number | undefined;
  maximum?: number | undefined;
  step?: number | undefined;
}>;

const field = (
  key: string,
  label: string,
  help: string,
  kind: ConfigurationFieldKind,
  constraint: string,
  extras: Partial<ConfigurationField> = {},
): ConfigurationField => ({ key, label, help, kind, constraint, required: true, ...extras });

export const COMMON_CONFIGURATION_FIELDS = [
  field(
    "label",
    "Label",
    "Human-readable component name.",
    "text",
    "1 to 120 non-blank characters",
  ),
  field(
    "description",
    "Description",
    "Purpose and boundary of this component.",
    "textarea",
    "1 to 1,000 non-blank characters",
  ),
  field(
    "security.dataClassification",
    "Data classification",
    "Highest sensitivity this node declares.",
    "select",
    "Supported classification",
    { options: ["public", "internal", "confidential", "restricted"] },
  ),
  field(
    "security.trustZone",
    "Trust zone",
    "Boundary in which this component operates.",
    "select",
    "Supported trust zone",
    { options: ["browser", "application", "external_service", "enterprise_system"] },
  ),
  field(
    "documentationRef",
    "Documentation reference",
    "Repository-relative path or stable logical reference.",
    "text",
    "Repository-relative reference",
  ),
] as const satisfies ReadonlyArray<ConfigurationField>;

export const READ_ONLY_NODE_FIELDS = [
  { key: "id", reason: "ID stability protects edges and auditability." },
  { key: "type", reason: "Type changes require node replacement rather than mutation." },
  {
    key: "implementationStatus",
    reason: "Implementation-status changes could create false executable claims.",
  },
  { key: "position", reason: "Position remains controlled by the canvas." },
  { key: "ports", reason: "Port changes could corrupt graph contracts and are outside AO-006." },
] as const;

export const NODE_CONFIGURATION_FIELD_CATALOG = {
  user_input: [
    field("configuration.inputMode", "Input mode", "Fixed by schema.", "readonly", "text"),
    field(
      "configuration.maximumInputLength",
      "Maximum input length",
      "Maximum accepted characters.",
      "integer",
      "1 to 1,000,000",
      { minimum: 1, maximum: 1_000_000, step: 1 },
    ),
    field(
      "configuration.acceptedContentType",
      "Accepted content type",
      "Fixed by schema.",
      "readonly",
      "text/plain",
    ),
  ],
  input_guardrail: [
    field(
      "configuration.promptInjectionDetectionEnabled",
      "Prompt-injection detection",
      "Require the declared input-policy check.",
      "checkbox",
      "Enabled or disabled",
    ),
    field(
      "configuration.maximumInputLength",
      "Maximum input length",
      "Maximum characters entering the guardrail.",
      "integer",
      "1 to 1,000,000",
      { minimum: 1, maximum: 1_000_000, step: 1 },
    ),
    field(
      "configuration.action",
      "Action",
      "Declared response to suspicious input.",
      "select",
      "block or review",
      { options: ["block", "review"] },
    ),
  ],
  document_source: [
    field(
      "configuration.sourceMode",
      "Source mode",
      "Declared source boundary.",
      "select",
      "bundled or upload",
      { options: ["bundled", "upload"] },
    ),
    field(
      "configuration.allowedMimeTypes",
      "Allowed MIME types",
      "One lowercase MIME type per line.",
      "list",
      "1 to 32 valid lowercase MIME types",
    ),
    field(
      "configuration.maximumFileSizeBytes",
      "Maximum file size (bytes)",
      "Maximum declared file size.",
      "integer",
      "1 to 104,857,600",
      { minimum: 1, maximum: 104_857_600, step: 1 },
    ),
    field(
      "configuration.dataClassification",
      "Configuration classification",
      "Must match node security classification.",
      "select",
      "Supported classification",
      { options: ["public", "internal", "confidential", "restricted"] },
    ),
  ],
  retrieval: [
    field("configuration.topK", "Top K", "Maximum retrieved results.", "integer", "1 to 100", {
      minimum: 1,
      maximum: 100,
      step: 1,
    }),
    field(
      "configuration.minimumRelevanceScore",
      "Minimum relevance score",
      "Minimum accepted relevance.",
      "decimal",
      "0 through 1",
      { minimum: 0, maximum: 1, step: 0.01 },
    ),
    field(
      "configuration.maximumContextCharacters",
      "Maximum context characters",
      "Maximum declared context size.",
      "integer",
      "1 to 1,000,000",
      { minimum: 1, maximum: 1_000_000, step: 1 },
    ),
    field(
      "configuration.citationsRequired",
      "Citations required",
      "Require citations in retrieval output.",
      "checkbox",
      "Enabled or disabled",
    ),
  ],
  gpt_agent: [
    field("configuration.model", "Model", "Fixed by the workflow contract.", "readonly", "GPT-5.6"),
    field(
      "configuration.systemInstruction",
      "System instruction",
      "Bounded server-side instruction declaration.",
      "textarea",
      "1 to 20,000 non-blank characters",
    ),
    field(
      "configuration.reasoningEffort",
      "Reasoning effort",
      "Declared reasoning profile.",
      "select",
      "low, medium, or high",
      { options: ["low", "medium", "high"] },
    ),
    field(
      "configuration.maximumOutputTokens",
      "Maximum output tokens",
      "Maximum declared output budget.",
      "integer",
      "1 to 128,000",
      { minimum: 1, maximum: 128_000, step: 1 },
    ),
    field(
      "configuration.allowedTools",
      "Allowed tools",
      "Read-only empty list. Arbitrary tools are prohibited in the MVP.",
      "readonly",
      "Must remain empty",
    ),
  ],
  output_guardrail: [
    field(
      "configuration.citationsRequired",
      "Citations required",
      "Require cited guarded output.",
      "checkbox",
      "Enabled or disabled",
    ),
    field(
      "configuration.sensitiveDataPolicy",
      "Sensitive-data policy",
      "Declared handling of sensitive output.",
      "select",
      "block, redact, or review",
      { options: ["block", "redact", "review"] },
    ),
    field(
      "configuration.unsupportedAnswerBehavior",
      "Unsupported-answer behavior",
      "Declared fallback response.",
      "select",
      "decline or request clarification",
      { options: ["decline", "request_clarification"] },
    ),
  ],
  evaluator: [
    field(
      "configuration.requiredMetrics",
      "Required metrics",
      "Fixed groundedness, relevance, and citation coverage metrics.",
      "readonly",
      "All required",
    ),
    field(
      "configuration.metricThresholds.groundedness",
      "Groundedness threshold",
      "Required groundedness score.",
      "decimal",
      "0 through 1",
      { minimum: 0, maximum: 1, step: 0.01 },
    ),
    field(
      "configuration.metricThresholds.relevance",
      "Relevance threshold",
      "Required relevance score.",
      "decimal",
      "0 through 1",
      { minimum: 0, maximum: 1, step: 0.01 },
    ),
    field(
      "configuration.metricThresholds.citation_coverage",
      "Citation coverage threshold",
      "Required citation coverage score.",
      "decimal",
      "0 through 1",
      { minimum: 0, maximum: 1, step: 0.01 },
    ),
    field(
      "configuration.overallPassThreshold",
      "Overall pass threshold",
      "Declared overall pass score.",
      "decimal",
      "0 through 1",
      { minimum: 0, maximum: 1, step: 0.01 },
    ),
  ],
  response_output: [
    field(
      "configuration.outputFormat",
      "Output format",
      "Declared final representation.",
      "select",
      "markdown, plain text, or JSON",
      { options: ["markdown", "plain_text", "json"] },
    ),
    field(
      "configuration.citationRendering",
      "Citation rendering",
      "Declared citation display.",
      "select",
      "inline or source list",
      { options: ["inline", "source_list"] },
    ),
  ],
  relational_database: [
    field(
      "configuration.engineType",
      "Engine type",
      "Declared simulated database engine.",
      "select",
      "Supported relational engine",
      { options: ["postgresql", "mysql", "sql_server", "sqlite"] },
    ),
    field(
      "configuration.connectionReference.environmentVariableName",
      "Connection environment variable",
      "Environment-variable name only; never a connection value.",
      "text",
      "Uppercase letters, digits, and underscores",
    ),
    field(
      "configuration.accessMode",
      "Access mode",
      "Fixed read-only boundary.",
      "readonly",
      "read_only",
    ),
    field(
      "configuration.approvedSchemasOrDatasets",
      "Approved schemas or datasets",
      "One stable identifier per line.",
      "list",
      "1 to 32 stable identifiers",
    ),
    field(
      "configuration.dataClassification",
      "Configuration classification",
      "Must match node security classification.",
      "select",
      "Supported classification",
      { options: ["public", "internal", "confidential", "restricted"] },
    ),
    field(
      "configuration.simulationNotice",
      "Simulation notice",
      "Visible explanation that no live database access occurs.",
      "textarea",
      "1 to 500 non-blank characters",
    ),
  ],
} as const satisfies Record<NodeType, ReadonlyArray<ConfigurationField>>;

export function configurationFieldsFor(type: NodeType): ReadonlyArray<ConfigurationField> {
  return [...COMMON_CONFIGURATION_FIELDS, ...NODE_CONFIGURATION_FIELD_CATALOG[type]];
}
