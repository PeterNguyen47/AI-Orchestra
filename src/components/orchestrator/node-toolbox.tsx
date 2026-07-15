"use client";

import { NODE_CATALOG } from "@/domain/orchestrator/node-catalog";
import type { NodeType } from "@/domain/workflow/workflow-types";

export function NodeToolbox({ onAdd }: Readonly<{ onAdd: (type: NodeType) => void }>) {
  return (
    <section className="orchestrator-panel toolbox" aria-labelledby="toolbox-title">
      <p className="panel-kicker">Node toolbox</p>
      <h2 id="toolbox-title">Add a component</h2>
      <p>Components are added near the canvas center with safe, non-executable defaults.</p>
      <div className="toolbox-list">
        {NODE_CATALOG.map((entry) => {
          const database = entry.type === "relational_database";
          return (
            <button
              className="toolbox-button"
              key={entry.type}
              type="button"
              onClick={() => onAdd(entry.type)}
            >
              <strong>{database ? "Add simulated database" : "Add roadmap component"}</strong>
              <span>{entry.label}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
