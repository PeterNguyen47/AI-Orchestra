import type { z } from "zod";

import type {
  DataClassificationSchema,
  DataContractSchema,
  DocumentSourceConfigurationSchema,
  DocumentSourceNodeSchema,
  EdgeIdSchema,
  EdgeModeSchema,
  EnvironmentVariableNameSchema,
  EvaluationMetricSchema,
  EvaluationMetricThresholdsSchema,
  EvaluatorConfigurationSchema,
  EvaluatorNodeSchema,
  GptAgentConfigurationSchema,
  GptAgentNodeSchema,
  ImplementationStatusSchema,
  InputGuardrailConfigurationSchema,
  InputGuardrailNodeSchema,
  NodeIdSchema,
  NodeTypeSchema,
  OutputGuardrailConfigurationSchema,
  OutputGuardrailNodeSchema,
  PortDirectionSchema,
  PortIdSchema,
  PortSchema,
  PositionSchema,
  RelationalDatabaseConfigurationSchema,
  RelationalDatabaseNodeSchema,
  RepositoryReferenceSchema,
  RequiredEvaluationMetricsSchema,
  ResponseOutputConfigurationSchema,
  ResponseOutputNodeSchema,
  RetrievalConfigurationSchema,
  RetrievalNodeSchema,
  SecretReferenceSchema,
  SecurityMetadataSchema,
  SemanticVersionSchema,
  TemplateIdSchema,
  ToolIdSchema,
  TrustZoneSchema,
  UserInputConfigurationSchema,
  UserInputNodeSchema,
  WorkflowDataPolicySchema,
  WorkflowDeploymentSchema,
  WorkflowEdgeSchema,
  WorkflowEvaluationSchema,
  WorkflowExecutionLimitsSchema,
  WorkflowHumanApprovalPolicySchema,
  WorkflowIdSchema,
  WorkflowMetadataSchema,
  WorkflowNodeSchema,
  WorkflowPoliciesSchema,
  WorkflowSchema,
  WorkflowSchemaVersionSchema,
  WorkflowTemplateReferenceSchema,
  WorkflowToolPolicySchema,
} from "./workflow-schema";

export type WorkflowSchemaVersion = z.infer<typeof WorkflowSchemaVersionSchema>;
export type SemanticVersion = z.infer<typeof SemanticVersionSchema>;
export type WorkflowId = z.infer<typeof WorkflowIdSchema>;
export type TemplateId = z.infer<typeof TemplateIdSchema>;
export type NodeId = z.infer<typeof NodeIdSchema>;
export type EdgeId = z.infer<typeof EdgeIdSchema>;
export type PortId = z.infer<typeof PortIdSchema>;
export type ToolId = z.infer<typeof ToolIdSchema>;
export type EnvironmentVariableName = z.infer<typeof EnvironmentVariableNameSchema>;
export type RepositoryReference = z.infer<typeof RepositoryReferenceSchema>;
export type ImplementationStatus = z.infer<typeof ImplementationStatusSchema>;
export type NodeType = z.infer<typeof NodeTypeSchema>;
export type EdgeMode = z.infer<typeof EdgeModeSchema>;
export type DataClassification = z.infer<typeof DataClassificationSchema>;
export type TrustZone = z.infer<typeof TrustZoneSchema>;
export type PortDirection = z.infer<typeof PortDirectionSchema>;
export type DataContract = z.infer<typeof DataContractSchema>;
export type EvaluationMetric = z.infer<typeof EvaluationMetricSchema>;
export type RequiredEvaluationMetrics = z.infer<typeof RequiredEvaluationMetricsSchema>;

export type WorkflowPosition = z.infer<typeof PositionSchema>;
export type WorkflowPort = z.infer<typeof PortSchema>;
export type WorkflowSecurityMetadata = z.infer<typeof SecurityMetadataSchema>;
export type SecretReference = z.infer<typeof SecretReferenceSchema>;
export type EvaluationMetricThresholds = z.infer<typeof EvaluationMetricThresholdsSchema>;

export type UserInputConfiguration = z.infer<typeof UserInputConfigurationSchema>;
export type InputGuardrailConfiguration = z.infer<typeof InputGuardrailConfigurationSchema>;
export type DocumentSourceConfiguration = z.infer<typeof DocumentSourceConfigurationSchema>;
export type RetrievalConfiguration = z.infer<typeof RetrievalConfigurationSchema>;
export type GptAgentConfiguration = z.infer<typeof GptAgentConfigurationSchema>;
export type OutputGuardrailConfiguration = z.infer<typeof OutputGuardrailConfigurationSchema>;
export type EvaluatorConfiguration = z.infer<typeof EvaluatorConfigurationSchema>;
export type ResponseOutputConfiguration = z.infer<typeof ResponseOutputConfigurationSchema>;
export type RelationalDatabaseConfiguration = z.infer<typeof RelationalDatabaseConfigurationSchema>;

export type UserInputNode = z.infer<typeof UserInputNodeSchema>;
export type InputGuardrailNode = z.infer<typeof InputGuardrailNodeSchema>;
export type DocumentSourceNode = z.infer<typeof DocumentSourceNodeSchema>;
export type RetrievalNode = z.infer<typeof RetrievalNodeSchema>;
export type GptAgentNode = z.infer<typeof GptAgentNodeSchema>;
export type OutputGuardrailNode = z.infer<typeof OutputGuardrailNodeSchema>;
export type EvaluatorNode = z.infer<typeof EvaluatorNodeSchema>;
export type ResponseOutputNode = z.infer<typeof ResponseOutputNodeSchema>;
export type RelationalDatabaseNode = z.infer<typeof RelationalDatabaseNodeSchema>;
export type WorkflowNode = z.infer<typeof WorkflowNodeSchema>;
export type WorkflowEdge = z.infer<typeof WorkflowEdgeSchema>;

export type WorkflowDataPolicy = z.infer<typeof WorkflowDataPolicySchema>;
export type WorkflowToolPolicy = z.infer<typeof WorkflowToolPolicySchema>;
export type WorkflowHumanApprovalPolicy = z.infer<typeof WorkflowHumanApprovalPolicySchema>;
export type WorkflowExecutionLimits = z.infer<typeof WorkflowExecutionLimitsSchema>;
export type WorkflowPolicies = z.infer<typeof WorkflowPoliciesSchema>;
export type WorkflowEvaluation = z.infer<typeof WorkflowEvaluationSchema>;
export type WorkflowDeployment = z.infer<typeof WorkflowDeploymentSchema>;
export type WorkflowTemplateReference = z.infer<typeof WorkflowTemplateReferenceSchema>;
export type WorkflowMetadata = z.infer<typeof WorkflowMetadataSchema>;
export type Workflow = z.infer<typeof WorkflowSchema>;
