"use client";

import { useMemo, useRef, useState } from "react";

import { PAE_MAX } from "@/lib/confidence";

interface PaeHeatmapProps {
  pae: number[][];
  /** SVG viewport size in CSS pixels. The heatmap is always square. */
  size?: number;
}

interface HoverState {
  i: number;
  j: number;
  value: number;
}

/** Interpolate from light-teal (low PAE) to deep-teal (high PAE) using the project accent. */
function colorFor(value: number): string {
  const t = Math.min(1, Math.max(0, value / PAE_MAX));
  // Lightness ramps 0.95 → 0.40; chroma ramps 0.02 → 0.10; hue fixed at our teal (195).
  const l = (0.95 - 0.55 * t).toFixed(3);
  const c = (0.02 + 0.08 * t).toFixed(3);
  return `oklch(${l} ${c} 195)`;
}

export function PaeHeatmap({ pae, size = 360 }: PaeHeatmapProps) {
  const n = pae.length;
  const cell = size / n;
  const svgRef = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<HoverState | null>(null);

  const rects = useMemo(() => {
    const out: { key: string; x: number; y: number; fill: string }[] = [];
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        out.push({
          key: `${i}-${j}`,
          x: j * cell,
          y: i * cell,
          fill: colorFor(pae[i][j]),
        });
      }
    }
    return out;
  }, [pae, n, cell]);

  function handleMove(event: React.MouseEvent<SVGSVGElement>) {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const j = Math.floor((x / rect.width) * n);
    const i = Math.floor((y / rect.height) * n);
    if (i < 0 || i >= n || j < 0 || j >= n) {
      setHover(null);
      return;
    }
    setHover({ i, j, value: pae[i][j] });
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Predicted aligned error (Å)</span>
        <span className="font-mono">
          {hover
            ? `(${hover.i + 1}, ${hover.j + 1}) · ${hover.value.toFixed(1)} Å`
            : "hover to inspect"}
        </span>
      </div>
      <div className="flex justify-center">
        <svg
          ref={svgRef}
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          shapeRendering="crispEdges"
          onMouseMove={handleMove}
          onMouseLeave={() => setHover(null)}
          className="rounded-md border border-border bg-card"
          role="img"
          aria-label={`PAE heatmap, ${n} by ${n} residues`}
        >
          {rects.map((r) => (
            <rect key={r.key} x={r.x} y={r.y} width={cell + 0.5} height={cell + 0.5} fill={r.fill} />
          ))}
          {hover && (
            <rect
              x={hover.j * cell}
              y={hover.i * cell}
              width={cell + 0.5}
              height={cell + 0.5}
              fill="none"
              stroke="var(--foreground)"
              strokeWidth={1}
              pointerEvents="none"
            />
          )}
        </svg>
      </div>
      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
        <span>low error</span>
        <div className="h-2 flex-1 mx-3 rounded-full" style={{
          background: `linear-gradient(to right, ${colorFor(0)}, ${colorFor(PAE_MAX / 2)}, ${colorFor(PAE_MAX)})`,
        }} />
        <span>{PAE_MAX}+ Å</span>
      </div>
    </div>
  );
}
