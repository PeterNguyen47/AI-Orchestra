import type { ReactNode } from "react";

export function StatusCard({
  id,
  title,
  status,
  statusKind = "roadmap",
  children,
}: Readonly<{
  id: string;
  title: string;
  status: string;
  statusKind?: "contract" | "roadmap";
  children: ReactNode;
}>) {
  return (
    <details className="status-card" id={id}>
      <summary>
        <span>
          <small className={`status-label status-${statusKind}`}>{status}</small>
          <strong>{title}</strong>
        </span>
        <span className="expand-label" aria-hidden="true">
          Inspect
        </span>
      </summary>
      <div className="card-content">{children}</div>
    </details>
  );
}
