export function WorkflowStatus({
  nodeCount,
  edgeCount,
  findingCount,
}: Readonly<{ nodeCount: number; edgeCount: number; findingCount: number }>) {
  return (
    <section className="workflow-status" aria-label="Workflow status" data-testid="workflow-status">
      <strong>{findingCount === 0 ? "Valid" : `${findingCount} findings`}</strong>
      <span>{nodeCount} nodes</span>
      <span>{edgeCount} edges</span>
      <span>Structurally valid</span>
    </section>
  );
}
