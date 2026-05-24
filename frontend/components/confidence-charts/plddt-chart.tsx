"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface PlddtChartProps {
  data: number[];
  height?: number;
}

interface PlddtTooltipPayload {
  residue: number;
  plddt: number;
}

interface PlddtTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: PlddtTooltipPayload }>;
}

function PlddtTooltip({ active, payload }: PlddtTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const { residue, plddt } = payload[0].payload;
  return (
    <div className="rounded-md border border-border bg-background px-2 py-1 text-xs shadow-sm">
      Residue {residue} · pLDDT {plddt.toFixed(1)}
    </div>
  );
}

export function PlddtChart({ data, height = 200 }: PlddtChartProps) {
  const series = data.map((plddt, i) => ({ residue: i + 1, plddt }));

  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer>
        <LineChart data={series} margin={{ top: 8, right: 16, bottom: 24, left: 8 }}>
          {/* Bands: very-low / low / high / very-high (AF3 convention) */}
          <ReferenceArea y1={0} y2={50} fill="oklch(0.96 0 0)" fillOpacity={0.6} />
          <ReferenceArea y1={50} y2={70} fill="oklch(0.94 0 0)" fillOpacity={0.6} />
          <ReferenceArea y1={70} y2={90} fill="oklch(0.92 0 0)" fillOpacity={0.6} />
          <ReferenceArea y1={90} y2={100} fill="oklch(0.90 0 0)" fillOpacity={0.6} />
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="residue"
            type="number"
            domain={[1, "dataMax"]}
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            label={{
              value: "Residue",
              position: "insideBottom",
              offset: -10,
              fontSize: 11,
              fill: "var(--muted-foreground)",
            }}
          />
          <YAxis
            type="number"
            domain={[0, 100]}
            ticks={[0, 50, 70, 90, 100]}
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            label={{
              value: "pLDDT",
              angle: -90,
              position: "insideLeft",
              fontSize: 11,
              fill: "var(--muted-foreground)",
            }}
          />
          <Tooltip content={<PlddtTooltip />} />
          <Line
            type="linear"
            dataKey="plddt"
            stroke="var(--primary)"
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
