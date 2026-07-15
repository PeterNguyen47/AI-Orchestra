"use client";

import { BaseEdge, getBezierPath, type EdgeProps } from "@xyflow/react";
import type { CanvasEdge } from "@/domain/orchestrator/workflow-adapter";

export function WorkflowEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  markerEnd,
  style,
  selected,
  label,
}: EdgeProps<CanvasEdge>) {
  const [path, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        {...(markerEnd === undefined ? {} : { markerEnd })}
        style={{ ...style, strokeWidth: selected ? 4 : 2 }}
        label={label}
        labelX={labelX}
        labelY={labelY}
        labelShowBg
        labelStyle={{ fill: "#f4fff9", fontSize: 11, fontWeight: 700 }}
        labelBgStyle={{ fill: "#07100f", stroke: "#36514a" }}
        labelBgPadding={[5, 3]}
        labelBgBorderRadius={4}
      />
    </>
  );
}
