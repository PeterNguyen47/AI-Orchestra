"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ConfigurationFieldControl, type DraftValue } from "./configuration-fields";
import {
  configurationFieldsFor,
  READ_ONLY_NODE_FIELDS,
  type ConfigurationField,
} from "@/domain/orchestrator/configuration-field-catalog";
import { getSafeEditableDefaults } from "@/domain/orchestrator/node-factory";
import type {
  ConfigurationFieldErrors,
  EditableNodePayload,
} from "@/domain/orchestrator/configuration-mutations";
import type { Workflow, WorkflowNode } from "@/domain/workflow/workflow-types";

type Draft = Record<string, DraftValue>;

function getValue(input: unknown, path: string): unknown {
  return path
    .split(".")
    .reduce<unknown>(
      (value, key) =>
        value && typeof value === "object" ? (value as Record<string, unknown>)[key] : undefined,
      input,
    );
}

function setValue(input: Record<string, unknown>, path: string, value: unknown): void {
  const keys = path.split(".");
  let target = input;
  keys.slice(0, -1).forEach((key) => {
    target[key] = target[key] && typeof target[key] === "object" ? target[key] : {};
    target = target[key] as Record<string, unknown>;
  });
  target[keys.at(-1)!] = value;
}

function draftFor(input: unknown, fields: ReadonlyArray<ConfigurationField>): Draft {
  return Object.fromEntries(
    fields.map((field) => {
      const value = getValue(input, field.key);
      return [
        field.key,
        Array.isArray(value)
          ? value.join("\n")
          : typeof value === "boolean"
            ? value
            : String(value ?? ""),
      ];
    }),
  );
}

function valueFor(field: ConfigurationField, value: DraftValue): unknown {
  if (field.kind === "integer" || field.kind === "decimal") return Number(value);
  if (field.kind === "list")
    return String(value)
      .split(/\r?\n/)
      .map((entry) => entry.trim())
      .filter(Boolean);
  return value;
}

export function NodeConfigurationEditor({
  node,
  workflow,
  canonicalWorkflow,
  onApply,
  onDirtyChange,
}: Readonly<{
  node: WorkflowNode;
  workflow: Workflow;
  canonicalWorkflow: Workflow;
  onApply: (payload: EditableNodePayload) => ConfigurationFieldErrors | undefined;
  onDirtyChange: (dirty: boolean) => void;
}>) {
  const fields = useMemo(() => configurationFieldsFor(node.type), [node.type]);
  const canonicalDraft = useMemo(() => draftFor(node, fields), [fields, node]);
  const [draft, setDraft] = useState<Draft>(canonicalDraft);
  const [errors, setErrors] = useState<ConfigurationFieldErrors>({});
  const summaryRef = useRef<HTMLDivElement>(null);
  const dirty = JSON.stringify(draft) !== JSON.stringify(canonicalDraft);
  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);

  function apply() {
    const payload = structuredClone({
      label: node.label,
      description: node.description,
      security: node.security,
      documentationRef: node.documentationRef,
      configuration: node.configuration,
    }) as unknown as Record<string, unknown>;
    for (const field of fields) {
      if (field.kind !== "readonly")
        setValue(payload, field.key, valueFor(field, draft[field.key] ?? ""));
    }
    const nextErrors = onApply(payload as unknown as EditableNodePayload);
    if (nextErrors) {
      setErrors(nextErrors);
      requestAnimationFrame(() => summaryRef.current?.focus());
    } else {
      setErrors({});
    }
  }

  function restoreDefaults() {
    if (
      !window.confirm(
        "Restore safe editable defaults for this node? Protected fields and edges will not change.",
      )
    )
      return;
    const defaults = getSafeEditableDefaults(canonicalWorkflow, node.type);
    setDraft(draftFor(defaults, fields));
    setErrors({});
  }

  return (
    <section className="node-configuration-editor" aria-labelledby="configuration-editor-title">
      <h3 id="configuration-editor-title">Edit configuration</h3>
      <p>Draft changes remain separate until the complete workflow passes the canonical schema.</p>
      {Object.keys(errors).length ? (
        <div className="error-summary" ref={summaryRef} tabIndex={-1} role="alert">
          <strong>Correct the following fields:</strong>
          <ul>
            {Object.entries(errors).map(([path, messages]) => (
              <li key={path}>
                <a href={`#node-field-${path.replaceAll(".", "-")}`}>
                  {path}: {messages.join(" ")}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <fieldset>
        <legend>Common editable properties</legend>
        {fields.slice(0, 5).map((field) => (
          <ConfigurationFieldControl
            key={field.key}
            field={field}
            value={draft[field.key] ?? ""}
            errors={errors[field.key] ?? []}
            onChange={(value) => setDraft((current) => ({ ...current, [field.key]: value }))}
          />
        ))}
      </fieldset>
      <fieldset>
        <legend>{node.type.replaceAll("_", " ")} configuration</legend>
        {fields.slice(5).map((field) => (
          <ConfigurationFieldControl
            key={field.key}
            field={field}
            value={draft[field.key] ?? ""}
            errors={errors[field.key] ?? []}
            onChange={(value) => setDraft((current) => ({ ...current, [field.key]: value }))}
          />
        ))}
      </fieldset>
      <details>
        <summary>Protected properties</summary>
        <ul>
          {READ_ONLY_NODE_FIELDS.map((item) => (
            <li key={item.key}>
              <strong>{item.key}</strong>: {item.reason}
            </li>
          ))}
        </ul>
      </details>
      <div className="configuration-actions">
        <button className="primary-button" type="button" onClick={apply}>
          Apply changes
        </button>
        <button
          className="secondary-button"
          type="button"
          disabled={!dirty}
          onClick={() => {
            setDraft(canonicalDraft);
            setErrors({});
          }}
        >
          Discard changes
        </button>
        <button className="secondary-button" type="button" onClick={restoreDefaults}>
          Restore safe defaults
        </button>
      </div>
      <p aria-live="polite">
        {dirty ? "Unsaved configuration changes." : "Draft matches the current canonical node."}
      </p>
      <span className="visually-hidden">
        Workflow has {workflow.edges.length} unchanged incident and non-incident edges.
      </span>
    </section>
  );
}
