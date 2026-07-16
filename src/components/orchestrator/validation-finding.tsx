import type { ArchitectureValidationFinding } from "@/domain/validation/architecture-validator";

export function ValidationFinding({
  finding,
  subjectLabel,
  onFocus,
}: Readonly<{
  finding: ArchitectureValidationFinding;
  subjectLabel: string;
  onFocus?: (() => void) | undefined;
}>) {
  return (
    <li className={`validation-finding severity-${finding.severity}`}>
      <h3>
        {finding.severity}: {finding.code}
      </h3>
      <dl>
        <div>
          <dt>Category</dt>
          <dd>{finding.category}</dd>
        </div>
        <div>
          <dt>Affected</dt>
          <dd>{subjectLabel}</dd>
        </div>
        <div>
          <dt>Path</dt>
          <dd>
            <code>{finding.path}</code>
          </dd>
        </div>
        <div>
          <dt>Explanation</dt>
          <dd>{finding.message}</dd>
        </div>
        <div>
          <dt>Remediation</dt>
          <dd>{finding.remediation}</dd>
        </div>
      </dl>
      {onFocus ? (
        <button className="secondary-button" type="button" onClick={onFocus}>
          Focus affected {finding.subject.kind}
        </button>
      ) : null}
    </li>
  );
}
