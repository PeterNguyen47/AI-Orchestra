export function WorkflowStatus({
  nodeCount,
  edgeCount,
  structureValid,
  executionReady,
  errorCount,
  warningCount,
}: Readonly<{
  nodeCount: number;
  edgeCount: number;
  structureValid: boolean;
  executionReady: boolean;
  errorCount: number;
  warningCount: number;
}>) {
  return (
    <section className="workflow-status" aria-label="Workflow status" data-testid="workflow-status">
      <strong>
        {executionReady ? "Ready for future execution" : "Execution readiness blocked"}
      </strong>
      <span>{nodeCount} nodes</span>
      <span>{edgeCount} edges</span>
      <span>{structureValid ? "Structure valid" : "Structure invalid"}</span>
      <span>{errorCount} errors</span>
      <span>{warningCount} warnings</span>
      <span>Live execution not implemented</span>
    </section>
  );
}
