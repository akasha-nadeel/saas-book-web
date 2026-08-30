"use client";

import React, { useId, useMemo, useState, useRef } from "react";

export function classNames(
  ...classes: (string | boolean | undefined | null)[]
) {
  return classes.filter(Boolean).join(" ");
}

/* --------------------------------------------------------------------------
   Card Component
   -------------------------------------------------------------------------- */

export function Card({
  className,
  children,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  return (
    <div
      className={classNames(
        "rounded-lg border border-line bg-panel p-6 transition-colors",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

/* --------------------------------------------------------------------------
   Tabs Components
   -------------------------------------------------------------------------- */

interface TabGroupContextType {
  selectedIndex: number;
  setSelectedIndex: (index: number) => void;
}

const TabGroupContext = React.createContext<TabGroupContextType | null>(null);

export function TabGroup({
  defaultIndex = 0,
  index: controlledIndex,
  onIndexChange,
  className,
  children,
  ...props
}: {
  defaultIndex?: number;
  index?: number;
  onIndexChange?: (index: number) => void;
} & React.ComponentPropsWithoutRef<"div">) {
  const [internalIndex, setInternalIndex] = useState(defaultIndex);
  const selectedIndex = controlledIndex !== undefined ? controlledIndex : internalIndex;

  const setSelectedIndex = (idx: number) => {
    if (controlledIndex === undefined) setInternalIndex(idx);
    onIndexChange?.(idx);
  };

  return (
    <TabGroupContext.Provider value={{ selectedIndex, setSelectedIndex }}>
      <div className={classNames("w-full", className)} {...props}>
        {children}
      </div>
    </TabGroupContext.Provider>
  );
}

export function TabList({
  className,
  children,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  return (
    <div
      role="tablist"
      className={classNames(
        "flex w-full overflow-x-auto border-b border-line bg-raised/20",
        className
      )}
      {...props}
    >
      {React.Children.map(children, (child, idx) => {
        if (!React.isValidElement(child)) return child;
        return React.cloneElement(child as React.ReactElement<any>, {
          __index: idx,
        });
      })}
    </div>
  );
}

export function Tab({
  className,
  children,
  __index = 0,
  ...props
}: {
  __index?: number;
} & React.ComponentPropsWithoutRef<"button">) {
  const ctx = React.useContext(TabGroupContext);
  const isSelected = ctx?.selectedIndex === __index;

  return (
    <button
      type="button"
      role="tab"
      aria-selected={isSelected}
      onClick={() => ctx?.setSelectedIndex(__index)}
      className={classNames(
        "relative cursor-pointer transition-colors text-left outline-none",
        isSelected
          ? "bg-panel text-fg"
          : "text-muted hover:text-fg hover:bg-raised/30",
        className
      )}
      {...props}
    >
      {children}
      {isSelected && (
        <span
          className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent"
          aria-hidden="true"
        />
      )}
    </button>
  );
}

export function TabPanels({
  className,
  children,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const ctx = React.useContext(TabGroupContext);
  const selectedIndex = ctx?.selectedIndex ?? 0;

  return (
    <div className={classNames("w-full", className)} {...props}>
      {React.Children.toArray(children)[selectedIndex]}
    </div>
  );
}

export function TabPanel({
  className,
  children,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  return (
    <div role="tabpanel" className={classNames("w-full", className)} {...props}>
      {children}
    </div>
  );
}

/* --------------------------------------------------------------------------
   BarList Component
   -------------------------------------------------------------------------- */

export interface BarListItem {
  name: string;
  value: number;
  icon?: React.ComponentType<{ className?: string }>;
  href?: string;
  target?: string;
}

export interface BarListProps {
  data: BarListItem[];
  valueFormatter?: (value: number) => string;
  color?: string;
  showAnimation?: boolean;
  className?: string;
}

export function BarList({
  data,
  valueFormatter = (val) => String(val),
  className,
}: BarListProps) {
  const maxValue = useMemo(() => {
    return Math.max(...data.map((item) => item.value), 0) || 1;
  }, [data]);

  return (
    <div className={classNames("flex flex-col space-y-2 w-full", className)}>
      {data.map((item, idx) => {
        const percentage = Math.max(0, Math.min(100, (item.value / maxValue) * 100));
        const Icon = item.icon;

        return (
          <div
            key={item.name || idx}
            className="group relative flex items-center justify-between overflow-hidden rounded-lg text-sm transition-colors hover:bg-raised/40"
          >
            {/* Background progress bar */}
            <div
              className="absolute inset-y-0 left-0 rounded-lg bg-blue-500/10 transition-all duration-300 group-hover:bg-blue-500/15"
              style={{ width: `${percentage}%` }}
            />

            {/* Item Content */}
            <div className="relative z-10 flex min-w-0 items-center gap-2.5 py-2 pl-3 pr-4">
              {Icon && (
                <Icon className="h-4 w-4 shrink-0 text-muted transition-colors group-hover:text-fg" />
              )}
              <span className="truncate font-medium text-fg">{item.name}</span>
            </div>

            {/* Value */}
            <span className="relative z-10 shrink-0 py-2 pr-3 font-medium tabular-nums text-muted transition-colors group-hover:text-fg">
              {valueFormatter(item.value)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* --------------------------------------------------------------------------
   Table Components
   -------------------------------------------------------------------------- */

export function Table({
  className,
  children,
  ...props
}: React.ComponentPropsWithoutRef<"table">) {
  return (
    <div className="w-full overflow-x-auto">
      <table
        className={classNames("w-full text-left caption-bottom text-sm", className)}
        {...props}
      >
        {children}
      </table>
    </div>
  );
}

export function TableHead({
  className,
  children,
  ...props
}: React.ComponentPropsWithoutRef<"thead">) {
  return (
    <thead
      className={classNames("border-b border-line", className)}
      {...props}
    >
      {children}
    </thead>
  );
}

export function TableBody({
  className,
  children,
  ...props
}: React.ComponentPropsWithoutRef<"tbody">) {
  return (
    <tbody
      className={classNames("divide-y divide-line/60", className)}
      {...props}
    >
      {children}
    </tbody>
  );
}

export function TableRow({
  className,
  children,
  ...props
}: React.ComponentPropsWithoutRef<"tr">) {
  return (
    <tr
      className={classNames(
        "transition-colors hover:bg-raised/50",
        className
      )}
      {...props}
    >
      {children}
    </tr>
  );
}

export function TableHeaderCell({
  className,
  children,
  ...props
}: React.ComponentPropsWithoutRef<"th">) {
  return (
    <th
      className={classNames(
        "py-3.5 px-4 text-xs font-semibold text-muted first:pl-0 last:pr-0",
        className
      )}
      {...props}
    >
      {children}
    </th>
  );
}

export function TableCell({
  className,
  children,
  ...props
}: React.ComponentPropsWithoutRef<"td">) {
  return (
    <td
      className={classNames(
        "py-3.5 px-4 text-sm tabular-nums text-fg first:pl-0 last:pr-0",
        className
      )}
      {...props}
    >
      {children}
    </td>
  );
}

/* --------------------------------------------------------------------------
   Chart Color Utilities
   -------------------------------------------------------------------------- */

const COLOR_MAP: Record<string, { stroke: string; fill: string; dot: string }> = {
  blue: {
    stroke: "#3b82f6",
    fill: "rgba(59, 130, 246, 0.15)",
    dot: "#3b82f6",
  },
  violet: {
    stroke: "#8b5cf6",
    fill: "rgba(139, 92, 246, 0.15)",
    dot: "#8b5cf6",
  },
  fuchsia: {
    stroke: "#d946ef",
    fill: "rgba(217, 70, 239, 0.15)",
    dot: "#d946ef",
  },
  emerald: {
    stroke: "#10b981",
    fill: "rgba(16, 185, 129, 0.15)",
    dot: "#10b981",
  },
  amber: {
    stroke: "#f59e0b",
    fill: "rgba(245, 158, 11, 0.15)",
    dot: "#f59e0b",
  },
  rose: {
    stroke: "#f43f5e",
    fill: "rgba(244, 63, 94, 0.15)",
    dot: "#f43f5e",
  },
  cyan: {
    stroke: "#06b6d4",
    fill: "rgba(6, 182, 212, 0.15)",
    dot: "#06b6d4",
  },
  indigo: {
    stroke: "#6366f1",
    fill: "rgba(99, 102, 241, 0.15)",
    dot: "#6366f1",
  },
};

function getSeriesColor(colorName: string, index: number) {
  if (COLOR_MAP[colorName]) return COLOR_MAP[colorName];
  const defaults = [COLOR_MAP.blue, COLOR_MAP.violet, COLOR_MAP.fuchsia, COLOR_MAP.emerald];
  return defaults[index % defaults.length];
}

function createSmoothPath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

  let d = `M ${points[0].x} ${points[0].y}`;

  for (let i = 0; i < points.length - 1; i++) {
    const curr = points[i];
    const next = points[i + 1];
    const prev = points[i - 1] || curr;
    const after = points[i + 2] || next;

    const controlPointLength = 0.2;
    const cp1x = curr.x + (next.x - prev.x) * controlPointLength;
    const cp1y = curr.y + (next.y - prev.y) * controlPointLength;
    const cp2x = next.x - (after.x - curr.x) * controlPointLength;
    const cp2y = next.y - (after.y - curr.y) * controlPointLength;

    d += ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${next.x.toFixed(2)} ${next.y.toFixed(2)}`;
  }

  return d;
}

/* --------------------------------------------------------------------------
   AreaChart Component
   -------------------------------------------------------------------------- */

export interface AreaChartProps {
  data: Record<string, any>[];
  index: string;
  categories: string[];
  colors?: string[];
  valueFormatter?: (value: number) => string;
  yAxisWidth?: number;
  showYAxis?: boolean;
  showLegend?: boolean;
  showGradient?: boolean;
  startEndOnly?: boolean;
  onValueChange?: (value: any) => void;
  className?: string;
}

export function AreaChart({
  data,
  index,
  categories,
  colors = ["blue", "violet", "fuchsia"],
  valueFormatter = (val) => String(val),
  yAxisWidth = 60,
  showYAxis = true,
  showLegend = true,
  showGradient = true,
  startEndOnly = false,
  onValueChange,
  className = "",
}: AreaChartProps) {
  const chartId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const { minVal, maxVal } = useMemo(() => {
    let min = Infinity;
    let max = -Infinity;

    data.forEach((row) => {
      categories.forEach((cat) => {
        const v = typeof row[cat] === "number" ? row[cat] : 0;
        if (v < min) min = v;
        if (v > max) max = v;
      });
    });

    if (min === Infinity) min = 0;
    if (max === -Infinity) max = 100;

    const range = max - min || 1;
    const paddedMax = Math.ceil(max + range * 0.08);
    const paddedMin = Math.max(0, Math.floor(min - range * 0.05));

    return { minVal: paddedMin, maxVal: paddedMax };
  }, [data, categories]);

  const width = 800;
  const height = 300;
  const paddingLeft = showYAxis ? yAxisWidth : 12;
  const paddingRight = 16;
  const paddingTop = 16;
  const paddingBottom = 28;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  const seriesPoints = useMemo(() => {
    return categories.map((cat) => {
      const points = data.map((row, i) => {
        const x = paddingLeft + (i / Math.max(data.length - 1, 1)) * chartWidth;
        const val = typeof row[cat] === "number" ? row[cat] : 0;
        const normalized = (val - minVal) / (maxVal - minVal || 1);
        const y = paddingTop + (1 - normalized) * chartHeight;
        return { x, y, value: val, date: row[index] };
      });
      return { category: cat, points };
    });
  }, [data, categories, index, minVal, maxVal, paddingLeft, paddingTop, chartWidth, chartHeight]);

  const yTicks = useMemo(() => {
    const steps = 4;
    const ticks = [];
    for (let i = 0; i <= steps; i++) {
      const val = minVal + ((maxVal - minVal) / steps) * i;
      const y = paddingTop + (1 - i / steps) * chartHeight;
      ticks.push({ value: val, y });
    }
    return ticks;
  }, [minVal, maxVal, paddingTop, chartHeight]);

  const xLabels = useMemo(() => {
    if (data.length <= 1) return [];
    if (startEndOnly) {
      return [
        { index: 0, label: data[0][index], x: paddingLeft },
        { index: data.length - 1, label: data[data.length - 1][index], x: paddingLeft + chartWidth },
      ];
    }
    const maxLabels = 7;
    const step = Math.ceil(data.length / maxLabels);
    const labels = [];
    for (let i = 0; i < data.length; i += step) {
      const x = paddingLeft + (i / (data.length - 1)) * chartWidth;
      labels.push({ index: i, label: data[i][index], x });
    }
    if (labels[labels.length - 1].index !== data.length - 1) {
      const x = paddingLeft + chartWidth;
      labels.push({ index: data.length - 1, label: data[data.length - 1][index], x });
    }
    return labels;
  }, [data, index, startEndOnly, paddingLeft, chartWidth]);

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!containerRef.current || data.length === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const normalizedX = (clientX / rect.width) * width;
    const clampedX = Math.max(paddingLeft, Math.min(paddingLeft + chartWidth, normalizedX));
    const ratio = (clampedX - paddingLeft) / chartWidth;
    const closestIdx = Math.min(data.length - 1, Math.max(0, Math.round(ratio * (data.length - 1))));
    setHoverIndex(closestIdx);
    if (onValueChange && data[closestIdx]) {
      onValueChange(data[closestIdx]);
    }
  };

  const handlePointerLeave = () => {
    setHoverIndex(null);
  };

  const activeDataPoint = hoverIndex !== null && data[hoverIndex] ? data[hoverIndex] : null;

  return (
    <div ref={containerRef} className={classNames("relative w-full select-none", className)}>
      {showLegend && (
        <div className="mb-4 flex flex-wrap items-center justify-end gap-x-5 gap-y-2 text-xs font-medium text-muted">
          {categories.map((cat, idx) => {
            const colorCfg = getSeriesColor(colors[idx] || "blue", idx);
            return (
              <div key={cat} className="flex items-center gap-1.5">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: colorCfg.stroke }}
                />
                <span>{cat}</span>
              </div>
            );
          })}
        </div>
      )}

      <div className="relative h-full w-full">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="none"
          className="h-full w-full overflow-visible"
          onPointerMove={handlePointerMove}
          onPointerLeave={handlePointerLeave}
        >
          <defs>
            {categories.map((cat, idx) => {
              const colorCfg = getSeriesColor(colors[idx] || "blue", idx);
              return (
                <linearGradient
                  key={cat}
                  id={`area-grad-${chartId}-${idx}`}
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="0%" stopColor={colorCfg.stroke} stopOpacity={showGradient ? 0.35 : 0.15} />
                  <stop offset="100%" stopColor={colorCfg.stroke} stopOpacity="0.0" />
                </linearGradient>
              );
            })}
          </defs>

          {yTicks.map((tick, i) => (
            <g key={i}>
              <line
                x1={paddingLeft}
                x2={paddingLeft + chartWidth}
                y1={tick.y}
                y2={tick.y}
                stroke="currentColor"
                strokeDasharray="3 3"
                className="text-line/70"
                strokeWidth="1"
              />
              {showYAxis && (
                <text
                  x={paddingLeft - 8}
                  y={tick.y + 4}
                  textAnchor="end"
                  className="fill-muted text-[11px] tabular-nums"
                >
                  {valueFormatter(Math.round(tick.value))}
                </text>
              )}
            </g>
          ))}

          {xLabels.map((lbl, i) => (
            <text
              key={i}
              x={lbl.x}
              y={height - 6}
              textAnchor={i === 0 ? "start" : i === xLabels.length - 1 ? "end" : "middle"}
              className="fill-muted text-[11px]"
            >
              {lbl.label}
            </text>
          ))}

          {seriesPoints.map((series, idx) => {
            const pathD = createSmoothPath(series.points);
            if (!pathD) return null;
            const lastPt = series.points[series.points.length - 1];
            const firstPt = series.points[0];
            const areaD = `${pathD} L ${lastPt.x} ${paddingTop + chartHeight} L ${firstPt.x} ${paddingTop + chartHeight} Z`;

            return (
              <path
                key={`area-${series.category}`}
                d={areaD}
                fill={`url(#area-grad-${chartId}-${idx})`}
              />
            );
          })}

          {seriesPoints.map((series, idx) => {
            const colorCfg = getSeriesColor(colors[idx] || "blue", idx);
            const pathD = createSmoothPath(series.points);
            if (!pathD) return null;

            return (
              <path
                key={`line-${series.category}`}
                d={pathD}
                fill="none"
                stroke={colorCfg.stroke}
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            );
          })}

          {hoverIndex !== null && (
            <g>
              <line
                x1={paddingLeft + (hoverIndex / Math.max(data.length - 1, 1)) * chartWidth}
                x2={paddingLeft + (hoverIndex / Math.max(data.length - 1, 1)) * chartWidth}
                y1={paddingTop}
                y2={paddingTop + chartHeight}
                stroke="currentColor"
                strokeWidth="1.5"
                strokeDasharray="2 2"
                className="text-fg/40"
              />

              {seriesPoints.map((series, idx) => {
                const pt = series.points[hoverIndex];
                if (!pt) return null;
                const colorCfg = getSeriesColor(colors[idx] || "blue", idx);

                return (
                  <g key={`marker-${series.category}`}>
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r="5"
                      fill={colorCfg.stroke}
                      stroke="var(--color-panel, #0a0a0a)"
                      strokeWidth="2.5"
                    />
                  </g>
                );
              })}
            </g>
          )}
        </svg>

        {activeDataPoint && hoverIndex !== null && (
          <div
            className="pointer-events-none absolute z-20 -translate-x-1/2 rounded-lg border border-line bg-panel/95 p-2.5 shadow-lg backdrop-blur-sm transition-transform text-xs"
            style={{
              left: `${((paddingLeft + (hoverIndex / Math.max(data.length - 1, 1)) * chartWidth) / width) * 100}%`,
              top: "12px",
            }}
          >
            <p className="font-semibold text-fg mb-1.5">{activeDataPoint[index]}</p>
            <div className="space-y-1">
              {categories.map((cat, idx) => {
                const colorCfg = getSeriesColor(colors[idx] || "blue", idx);
                const val = activeDataPoint[cat];
                return (
                  <div key={cat} className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-1.5 text-muted">
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: colorCfg.stroke }}
                      />
                      <span>{cat}</span>
                    </div>
                    <span className="font-medium tabular-nums text-fg">
                      {typeof val === "number" ? valueFormatter(val) : "—"}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* --------------------------------------------------------------------------
   LineChart Component
   -------------------------------------------------------------------------- */

export interface LineChartProps {
  data: Record<string, any>[];
  index: string;
  categories: string[];
  colors?: string[];
  valueFormatter?: (value: number) => string;
  yAxisWidth?: number;
  showYAxis?: boolean;
  showLegend?: boolean;
  startEndOnly?: boolean;
  onValueChange?: (value: any) => void;
  className?: string;
}

export function LineChart(props: LineChartProps) {
  return <AreaChart {...props} showGradient={false} />;
}

/* --------------------------------------------------------------------------
   Brand Icons
   -------------------------------------------------------------------------- */

export function RiGoogleFill({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M12 11h8.533c.149.62.227 1.282.227 2 0 5.523-4.477 10-10 10S2 18.523 2 13 6.477 3 12 3c2.73 0 5.21 1.09 7.02 2.86l-2.84 2.84C15.01 7.6 13.6 7 12 7c-3.31 0-6 2.69-6 6s2.69 6 6 6c3.04 0 5.5-2.22 5.91-5.14H12V11z" />
    </svg>
  );
}

export function RiTwitterFill({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

export function RiGithubFill({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0 0 22 12.017C22 6.484 17.522 2 12 2z" />
    </svg>
  );
}

export function RiYoutubeFill({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  );
}

export function RiRedditFill({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.688-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.197-2.512-.73a.326.326 0 0 0-.232-.095z" />
    </svg>
  );
}
