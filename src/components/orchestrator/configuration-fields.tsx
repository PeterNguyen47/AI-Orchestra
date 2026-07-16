"use client";

import type { ChangeEvent } from "react";
import type { ConfigurationField } from "@/domain/orchestrator/configuration-field-catalog";

export type DraftValue = string | boolean;

export function ConfigurationFieldControl({
  field,
  value,
  errors,
  onChange,
}: Readonly<{
  field: ConfigurationField;
  value: DraftValue;
  errors: ReadonlyArray<string>;
  onChange: (value: DraftValue) => void;
}>) {
  const id = `node-field-${field.key.replaceAll(".", "-")}`;
  const helpId = `${id}-help`;
  const errorId = `${id}-error`;
  const describedBy = [helpId, errors.length ? errorId : ""].filter(Boolean).join(" ");
  if (field.kind === "readonly") {
    return (
      <div className="configuration-field read-only-field">
        <span className="field-label">{field.label}</span>
        <output id={id}>{String(value || field.constraint)}</output>
        <small id={helpId}>
          {field.help} {field.constraint}.
        </small>
      </div>
    );
  }
  const common = {
    id,
    name: field.key,
    "aria-describedby": describedBy,
    "aria-invalid": errors.length > 0,
    required: field.required,
  } as const;
  const handle = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    onChange(event.currentTarget.value);
  return (
    <div className="configuration-field">
      <label htmlFor={id}>
        {field.label} {field.required ? <span>(required)</span> : null}
      </label>
      {field.kind === "textarea" || field.kind === "list" ? (
        <textarea
          {...common}
          value={String(value)}
          rows={field.kind === "list" ? 3 : 5}
          onChange={handle}
        />
      ) : field.kind === "select" ? (
        <select {...common} value={String(value)} onChange={handle}>
          {field.options?.map((option) => (
            <option key={option} value={option}>
              {option.replaceAll("_", " ")}
            </option>
          ))}
        </select>
      ) : field.kind === "checkbox" ? (
        <input
          {...common}
          type="checkbox"
          checked={Boolean(value)}
          onChange={(event) => onChange(event.currentTarget.checked)}
        />
      ) : (
        <input
          {...common}
          type={field.kind === "integer" || field.kind === "decimal" ? "number" : "text"}
          value={String(value)}
          min={field.minimum}
          max={field.maximum}
          step={field.step}
          onChange={handle}
        />
      )}
      <small id={helpId}>
        {field.help} Constraint: {field.constraint}.
      </small>
      {errors.length ? (
        <span className="field-error" id={errorId}>
          {errors.join(" ")}
        </span>
      ) : null}
    </div>
  );
}
