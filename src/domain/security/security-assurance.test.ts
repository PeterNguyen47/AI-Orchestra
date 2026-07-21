import { describe, expect, it } from "vitest";

import {
  ACTIVATION_THREAT_STATUS,
  SECURITY_ASSURANCE_SCHEMA_VERSION,
  SECURITY_THREAT_IDS,
  evaluateSecurityAssuranceCompletion,
  securityAssuranceAssessmentSchema,
} from "./security-assurance";

function createAssessment() {
  return {
    schemaVersion: SECURITY_ASSURANCE_SCHEMA_VERSION,
    threats: SECURITY_THREAT_IDS.map((threatId, index) => {
      const status = ACTIVATION_THREAT_STATUS[threatId];
      return {
        threatId,
        status,
        summary: `Bounded deterministic control summary ${index + 1}.`,
        controls: [
          {
            controlId: `AO10-CONTROL-${index + 1}`,
            summary: `Control evidence summary ${index + 1}.`,
            evidenceReferences: [{ kind: "unit" as const, reference: `AO10.UNIT.${index + 1}` }],
          },
        ],
        ...(status === "residual_accepted"
          ? { residualRationale: "A bounded MVP limitation remains explicitly documented." }
          : {}),
      };
    }),
    findings: [] as Array<Record<string, unknown>>,
  };
}

describe("security assurance", () => {
  it("validates the canonical ten-threat assessment and completion gate", () => {
    const assessment = createAssessment();

    expect(securityAssuranceAssessmentSchema.safeParse(assessment).success).toBe(true);
    expect(evaluateSecurityAssuranceCompletion(assessment)).toEqual({ complete: true });
    expect(assessment.threats.map((threat) => threat.threatId)).toEqual(SECURITY_THREAT_IDS);
  });

  it("rejects missing, duplicate, unknown, and out-of-order threat assessments", () => {
    const missing = createAssessment();
    missing.threats.pop();
    const duplicate = createAssessment();
    duplicate.threats[1] = duplicate.threats[0]!;
    const unknown = createAssessment() as unknown as { threats: Array<{ threatId: string }> };
    unknown.threats[0]!.threatId = "AO10-UNKNOWN";
    const outOfOrder = createAssessment();
    [outOfOrder.threats[0], outOfOrder.threats[1]] = [
      outOfOrder.threats[1]!,
      outOfOrder.threats[0]!,
    ];

    for (const candidate of [missing, duplicate, unknown, outOfOrder]) {
      expect(securityAssuranceAssessmentSchema.safeParse(candidate).success).toBe(false);
      expect(evaluateSecurityAssuranceCompletion(candidate)).toEqual({
        complete: false,
        code: "SECURITY_ASSURANCE_BLOCKED",
      });
    }
  });

  it("rejects status drift and sensitive or unbounded evidence text", () => {
    const statusDrift = createAssessment();
    statusDrift.threats[0]!.status = "implemented";
    delete statusDrift.threats[0]!.residualRationale;
    const sensitive = createAssessment();
    sensitive.threats[0]!.summary = ["Bearer", "synthetic", "value"].join(" ");
    const multiline = createAssessment();
    multiline.threats[0]!.summary = "Line one\nLine two";

    expect(securityAssuranceAssessmentSchema.safeParse(statusDrift).success).toBe(false);
    expect(securityAssuranceAssessmentSchema.safeParse(sensitive).success).toBe(false);
    expect(securityAssuranceAssessmentSchema.safeParse(multiline).success).toBe(false);
  });

  it("blocks unresolved high findings and permits bounded medium residuals", () => {
    const unresolved = createAssessment();
    unresolved.findings.push({
      findingId: "AO10-FINDING-HIGH-1",
      threatId: "AO10-INFORMATION-LEAKAGE",
      severity: "high",
      status: "open",
      affectedBoundary: "SERVER.ACTION",
      summary: "A material judge-path control requires remediation.",
      evidenceReferences: [{ kind: "action", reference: "AO10.ACTION.1" }],
      remediationState: "planned",
    });
    expect(securityAssuranceAssessmentSchema.safeParse(unresolved).success).toBe(true);
    expect(evaluateSecurityAssuranceCompletion(unresolved)).toEqual({
      complete: false,
      code: "SECURITY_FINDING_UNRESOLVED",
    });

    const residual = createAssessment();
    residual.findings.push({
      findingId: "AO10-FINDING-MEDIUM-1",
      threatId: "AO10-DENIAL-OF-SERVICE",
      severity: "medium",
      status: "residual_accepted",
      affectedBoundary: "PROCESS.LOCAL",
      summary: "A bounded single-process limitation remains.",
      evidenceReferences: [{ kind: "documentation", reference: "AO10.REPORT.1" }],
      remediationState: "not_applicable",
      residualRationale: "Distributed enforcement is outside the bounded MVP judge path.",
    });
    expect(securityAssuranceAssessmentSchema.safeParse(residual).success).toBe(true);
    expect(evaluateSecurityAssuranceCompletion(residual)).toEqual({ complete: true });
  });
});
