import { z } from "zod";

import { containsSensitiveText } from "./sensitive-data";

export const SECURITY_ASSURANCE_SCHEMA_VERSION = "1.0.0" as const;
export const SECURITY_THREAT_IDS = [
  "AO10-PROMPT-INJECTION",
  "AO10-INFORMATION-LEAKAGE",
  "AO10-EXCESSIVE-AGENCY",
  "AO10-UNAUTHORIZED-TOOLS",
  "AO10-CONNECTOR-ABUSE",
  "AO10-UPLOAD-ABUSE",
  "AO10-CROSS-USER-ACCESS",
  "AO10-SECRET-EXPOSURE",
  "AO10-DENIAL-OF-WALLET",
  "AO10-DENIAL-OF-SERVICE",
] as const;
export const SECURITY_CONTROL_STATUSES = [
  "implemented",
  "not_applicable",
  "residual_accepted",
  "blocked",
] as const;
export const SECURITY_FINDING_SEVERITIES = [
  "critical",
  "high",
  "medium",
  "low",
  "informational",
] as const;

export type SecurityThreatId = (typeof SECURITY_THREAT_IDS)[number];
export type SecurityControlStatus = (typeof SECURITY_CONTROL_STATUSES)[number];

export const ACTIVATION_THREAT_STATUS = Object.freeze({
  "AO10-PROMPT-INJECTION": "residual_accepted",
  "AO10-INFORMATION-LEAKAGE": "residual_accepted",
  "AO10-EXCESSIVE-AGENCY": "implemented",
  "AO10-UNAUTHORIZED-TOOLS": "implemented",
  "AO10-CONNECTOR-ABUSE": "not_applicable",
  "AO10-UPLOAD-ABUSE": "not_applicable",
  "AO10-CROSS-USER-ACCESS": "not_applicable",
  "AO10-SECRET-EXPOSURE": "residual_accepted",
  "AO10-DENIAL-OF-WALLET": "implemented",
  "AO10-DENIAL-OF-SERVICE": "residual_accepted",
} satisfies Readonly<Record<SecurityThreatId, SecurityControlStatus>>);

const boundedSafeText = z
  .string()
  .trim()
  .min(1)
  .max(240)
  .refine((value) => !/[\r\n]/.test(value) && !containsSensitiveText(value));
const safeIdentifier = z.string().regex(/^[A-Z0-9][A-Z0-9._:-]{0,119}$/);

export const securityEvidenceReferenceSchema = z
  .strictObject({
    kind: z.enum([
      "unit",
      "action",
      "authentication",
      "component",
      "e2e",
      "secret_scan",
      "audit",
      "container",
      "documentation",
    ]),
    reference: safeIdentifier,
  })
  .readonly();

export const securityControlSchema = z
  .strictObject({
    controlId: z.string().regex(/^AO10-CONTROL-[A-Z0-9-]+$/),
    summary: boundedSafeText,
    evidenceReferences: z.array(securityEvidenceReferenceSchema).min(1).max(12),
  })
  .readonly();

export const securityFindingSchema = z
  .strictObject({
    findingId: z.string().regex(/^AO10-FINDING-[A-Z0-9-]+$/),
    threatId: z.enum(SECURITY_THREAT_IDS),
    severity: z.enum(SECURITY_FINDING_SEVERITIES),
    status: z.enum(["open", "resolved", "residual_accepted"]),
    affectedBoundary: safeIdentifier,
    summary: boundedSafeText,
    evidenceReferences: z.array(securityEvidenceReferenceSchema).min(1).max(12),
    remediationState: z.enum(["planned", "complete", "not_applicable"]),
    residualRationale: boundedSafeText.optional(),
  })
  .superRefine((finding, context) => {
    if (
      finding.status === "residual_accepted" &&
      (finding.severity === "critical" || finding.severity === "high" || !finding.residualRationale)
    ) {
      context.addIssue({
        code: "custom",
        path: ["residualRationale"],
        message: "Only bounded medium or low findings may be accepted as residual.",
      });
    }
    if (finding.status !== "residual_accepted" && finding.residualRationale) {
      context.addIssue({
        code: "custom",
        path: ["residualRationale"],
        message: "Residual rationale is only valid for accepted residual findings.",
      });
    }
  })
  .readonly();

export const securityThreatAssessmentSchema = z
  .strictObject({
    threatId: z.enum(SECURITY_THREAT_IDS),
    status: z.enum(SECURITY_CONTROL_STATUSES),
    summary: boundedSafeText,
    controls: z.array(securityControlSchema).min(1).max(12),
    residualRationale: boundedSafeText.optional(),
  })
  .superRefine((assessment, context) => {
    if (assessment.status === "residual_accepted" && !assessment.residualRationale) {
      context.addIssue({
        code: "custom",
        path: ["residualRationale"],
        message: "Accepted residual threats require a bounded rationale.",
      });
    }
    if (assessment.status !== "residual_accepted" && assessment.residualRationale) {
      context.addIssue({
        code: "custom",
        path: ["residualRationale"],
        message: "Residual rationale is only valid for accepted residual threats.",
      });
    }
  })
  .readonly();

export const securityAssuranceAssessmentSchema = z
  .strictObject({
    schemaVersion: z.literal(SECURITY_ASSURANCE_SCHEMA_VERSION),
    threats: z.array(securityThreatAssessmentSchema).length(SECURITY_THREAT_IDS.length),
    findings: z.array(securityFindingSchema).max(100),
  })
  .superRefine((assessment, context) => {
    for (const [index, threatId] of SECURITY_THREAT_IDS.entries()) {
      const actual = assessment.threats[index];
      if (actual?.threatId !== threatId) {
        context.addIssue({
          code: "custom",
          path: ["threats", index, "threatId"],
          message: "Threat assessments must use canonical order and identity.",
        });
      }
      if (actual && actual.status !== ACTIVATION_THREAT_STATUS[threatId]) {
        context.addIssue({
          code: "custom",
          path: ["threats", index, "status"],
          message: "Threat status must match the authoritative AO-010 mapping.",
        });
      }
    }
  })
  .readonly();

export type SecurityAssuranceAssessment = z.output<typeof securityAssuranceAssessmentSchema>;

export function evaluateSecurityAssuranceCompletion(input: unknown):
  | Readonly<{ complete: true }>
  | Readonly<{
      complete: false;
      code: "SECURITY_ASSURANCE_BLOCKED" | "SECURITY_FINDING_UNRESOLVED";
    }> {
  const parsed = securityAssuranceAssessmentSchema.safeParse(input);
  if (!parsed.success || parsed.data.threats.some((threat) => threat.status === "blocked")) {
    return { complete: false, code: "SECURITY_ASSURANCE_BLOCKED" };
  }
  if (
    parsed.data.findings.some(
      (finding) =>
        (finding.severity === "critical" || finding.severity === "high") &&
        finding.status !== "resolved",
    )
  ) {
    return { complete: false, code: "SECURITY_FINDING_UNRESOLVED" };
  }
  return { complete: true };
}
