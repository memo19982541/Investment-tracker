import type { ReactElement } from "react";

/** Outline colour for a loss bar: no fill, just a red border. */
export const LOSS_STROKE = "#dc2626";

export interface BarShapeProps {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  payload?: Record<string, unknown>;
}

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** A bar drawn as an empty box with a red outline: the "hole" a loss leaves. */
export function HollowLossBar({ x = 0, y = 0, width = 0, height = 0 }: BarShapeProps) {
  if (height === 0) return null;
  return (
    <rect
      x={x}
      y={height < 0 ? y + height : y}
      width={width}
      height={Math.abs(height)}
      fill="none"
      stroke={LOSS_STROKE}
      strokeWidth={1.5}
    />
  );
}

/**
 * A recharts bar shape for a stacked gain/loss segment: gains are drawn by
 * `gain` (fill, gradient, ...), losses (a negative value for `dataKey`) are
 * drawn empty with a red outline so they read as a loss, not as another colour
 * of profit. Negative values arrive with a negative height; normalised here.
 */
export function lossAwareBar(dataKey: string, gain: (box: Box) => ReactElement) {
  return function LossAwareBar({ x = 0, y = 0, width = 0, height = 0, payload }: BarShapeProps) {
    if (height === 0) return null;
    const box = { x, y: height < 0 ? y + height : y, width, height: Math.abs(height) };
    const value = payload?.[dataKey];
    if (typeof value === "number" && value < 0) {
      return (
        <rect
          x={box.x}
          y={box.y}
          width={box.width}
          height={box.height}
          fill="none"
          stroke={LOSS_STROKE}
          strokeWidth={1.5}
        />
      );
    }
    return gain(box);
  };
}
