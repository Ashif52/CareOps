"use client";

import React, { useState, useMemo, useRef } from "react";
import {
  Activity,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  CheckCircle2,
  TrendingUp,
  Inbox,
  Filter,
  Layers,
  ArrowRight,
  ChevronRight,
  Info,
  Clock,
  Sparkles,
  RefreshCw
} from "lucide-react";

export interface VolumeTrendItem {
  bucket_index: number;
  label: string;
  date: string;
  created: number;
  resolved: number;
  total_volume?: number;
}

export interface TicketVolumeTrendsChartProps {
  data: VolumeTrendItem[];
  timeframe: "24h" | "7d" | "30d" | "90d";
  onTimeframeChange: (tf: "24h" | "7d" | "30d" | "90d") => void;
  isLoading?: boolean;
  comparisons?: {
    created_delta_pct?: number | null;
    completed_delta_pct?: number | null;
  };
  onSelectDate?: (date: string) => void;
  onViewAllTickets?: () => void;
}

/**
 * Format date string (YYYY-MM-DD) into an accessible, human-friendly full date.
 */
function formatFullDate(dateStr?: string, fallbackLabel?: string): string {
  if (!dateStr) return fallbackLabel || "Selected Day";
  const parts = dateStr.split("-");
  if (parts.length === 3) {
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    const d = new Date(year, month, day);
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    }
  }
  return dateStr || fallbackLabel || "Selected Day";
}

/**
 * Mathematically monotonic cubic spline interpolation.
 * Prevents overshooting below baseline (value 0) or above local peaks.
 */
function getClampedSmoothPath(points: [number, number][], baselineY: number): string {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${points[0][0].toFixed(2)} ${points[0][1].toFixed(2)}`;
  if (points.length === 2) {
    return `M ${points[0][0].toFixed(2)} ${points[0][1].toFixed(2)} L ${points[1][0].toFixed(2)} ${points[1][1].toFixed(2)}`;
  }

  let d = `M ${points[0][0].toFixed(2)} ${points[0][1].toFixed(2)}`;

  for (let i = 0; i < points.length - 1; i++) {
    const pPrev = points[Math.max(0, i - 1)];
    const pCurr = points[i];
    const pNext = points[i + 1];
    const pAfter = points[Math.min(points.length - 1, i + 2)];

    // Slopes
    let tangentCurr = (pNext[1] - pPrev[1]) / 2;
    let tangentNext = (pAfter[1] - pCurr[1]) / 2;

    // Peak / valley protection: set tangent to 0 if direction reverses
    if ((pNext[1] - pCurr[1]) * (pCurr[1] - pPrev[1]) <= 0) {
      tangentCurr = 0;
    }
    if ((pAfter[1] - pNext[1]) * (pNext[1] - pCurr[1]) <= 0) {
      tangentNext = 0;
    }

    const dx = pNext[0] - pCurr[0];
    const cp1x = pCurr[0] + dx / 3;
    let cp1y = pCurr[1] + tangentCurr / 3;
    const cp2x = pNext[0] - dx / 3;
    let cp2y = pNext[1] - tangentNext / 3;

    // Never overshoot baseline (in SVG, baseline is downward, so y must not exceed baselineY)
    cp1y = Math.min(baselineY, Math.max(16, cp1y));
    cp2y = Math.min(baselineY, Math.max(16, cp2y));

    // If both endpoints are at baseline, enforce a perfectly straight flat segment
    if (pCurr[1] >= baselineY - 0.5 && pNext[1] >= baselineY - 0.5) {
      cp1y = baselineY;
      cp2y = baselineY;
    }

    d += ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${pNext[0].toFixed(2)} ${pNext[1].toFixed(2)}`;
  }

  return d;
}

export function TicketVolumeTrendsChart({
  data = [],
  timeframe,
  onTimeframeChange,
  isLoading = false,
  comparisons,
  onSelectDate,
  onViewAllTickets,
}: TicketVolumeTrendsChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [showComparison, setShowComparison] = useState(false);
  const chartRef = useRef<HTMLDivElement>(null);

  // Period aggregate calculations
  const totalCreated = useMemo(() => data.reduce((s, v) => s + (v.created || 0), 0), [data]);
  const totalResolved = useMemo(() => data.reduce((s, v) => s + (v.resolved || 0), 0), [data]);
  const netChange = totalCreated - totalResolved;
  
  // Safe resolution ratio definition: Resolved ÷ Created × 100
  const resolutionRatio = useMemo(() => {
    if (totalCreated === 0) {
      return totalResolved > 0 ? "100.0%" : "—";
    }
    return `${((totalResolved / totalCreated) * 100).toFixed(1)}%`;
  }, [totalCreated, totalResolved]);

  // Dynamic reporting period range
  const periodDateRange = useMemo(() => {
    if (!data || data.length === 0) {
      return timeframe === "7d" ? "Past 7 Days" : timeframe === "30d" ? "Past 30 Days" : timeframe === "90d" ? "Past 90 Days" : "Past 24 Hours";
    }
    const firstDate = data[0]?.date;
    const lastDate = data[data.length - 1]?.date;
    if (firstDate && lastDate && firstDate !== lastDate) {
      const fParts = firstDate.split("-");
      const lParts = lastDate.split("-");
      if (fParts.length === 3 && lParts.length === 3) {
        const d1 = new Date(parseInt(fParts[0], 10), parseInt(fParts[1], 10) - 1, parseInt(fParts[2], 10));
        const d2 = new Date(parseInt(lParts[0], 10), parseInt(lParts[1], 10) - 1, parseInt(lParts[2], 10));
        if (!isNaN(d1.getTime()) && !isNaN(d2.getTime())) {
          return `${d1.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${d2.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
        }
      }
    }
    return timeframe === "7d" ? "Past 7 Days" : timeframe === "30d" ? "Past 30 Days" : timeframe === "90d" ? "Past 90 Days" : "Past 24 Hours";
  }, [data, timeframe]);

  // Chart Geometry
  const chartW = 900;
  const chartH = 300;
  const padL = 44;
  const padR = 24;
  const padT = 32;
  const padB = 36;
  const plotW = chartW - padL - padR;
  const plotH = chartH - padT - padB;
  const baseline = padT + plotH;

  const maxVal = useMemo(() => {
    if (data.length === 0) return 5;
    const raw = Math.max(1, ...data.map((d) => Math.max(d.created || 0, d.resolved || 0)));
    if (raw <= 5) return 5;
    if (raw <= 10) return 10;
    if (raw <= 20) return 20;
    const step = Math.pow(10, Math.floor(Math.log10(raw)));
    return Math.ceil(raw / step) * step;
  }, [data]);

  const xOf = (i: number) => {
    if (data.length <= 1) return padL + plotW / 2;
    return padL + (i / (data.length - 1)) * plotW;
  };

  const yOf = (v: number) => {
    const val = Math.max(0, v || 0);
    return padT + plotH - (val / maxVal) * plotH;
  };

  // Coordinates
  const createdPts: [number, number][] = useMemo(
    () => data.map((d, i) => [xOf(i), yOf(d.created)]),
    [data, maxVal]
  );
  const resolvedPts: [number, number][] = useMemo(
    () => data.map((d, i) => [xOf(i), yOf(d.resolved)]),
    [data, maxVal]
  );

  const createdLine = useMemo(() => getClampedSmoothPath(createdPts, baseline), [createdPts, baseline]);
  const resolvedLine = useMemo(() => getClampedSmoothPath(resolvedPts, baseline), [resolvedPts, baseline]);

  const createdArea = useMemo(() => {
    if (data.length < 2 || !createdLine) return "";
    const firstX = createdPts[0][0];
    const lastX = createdPts[createdPts.length - 1][0];
    return `${createdLine} L ${lastX.toFixed(2)} ${baseline.toFixed(2)} L ${firstX.toFixed(2)} ${baseline.toFixed(2)} Z`;
  }, [createdLine, createdPts, baseline, data.length]);

  const resolvedArea = useMemo(() => {
    if (data.length < 2 || !resolvedLine) return "";
    const firstX = resolvedPts[0][0];
    const lastX = resolvedPts[resolvedPts.length - 1][0];
    return `${resolvedLine} L ${lastX.toFixed(2)} ${baseline.toFixed(2)} L ${firstX.toFixed(2)} ${baseline.toFixed(2)} Z`;
  }, [resolvedLine, resolvedPts, baseline, data.length]);

  // Horizontal Grid Lines (5 even intervals)
  const gridLines = useMemo(() => {
    const count = 4;
    return Array.from({ length: count + 1 }, (_, i) => {
      const val = Math.round((maxVal / count) * i);
      return { val, y: yOf(val) };
    });
  }, [maxVal]);

  const activeIndex = hoveredIndex !== null && hoveredIndex >= 0 && hoveredIndex < data.length ? hoveredIndex : null;
  const activeItem = activeIndex !== null ? data[activeIndex] : null;

  // Handle keyboard navigation across data points
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (data.length === 0) return;
    if (e.key === "ArrowRight") {
      e.preventDefault();
      setHoveredIndex((prev) => (prev === null ? 0 : Math.min(data.length - 1, prev + 1)));
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      setHoveredIndex((prev) => (prev === null ? data.length - 1 : Math.max(0, prev - 1)));
    } else if (e.key === "Escape") {
      setHoveredIndex(null);
    } else if (e.key === "Enter" && activeItem) {
      if (onSelectDate && activeItem.date) {
        onSelectDate(activeItem.date);
      }
    }
  };

  return (
    <div
      ref={chartRef}
      className="glass-surface rounded-2xl p-5 sm:p-6 border border-slate-200/80 shadow-[0_8px_30px_rgb(0,0,0,0.03)] space-y-5 transition-all duration-300 relative overflow-hidden"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      aria-label="Ticket Volume and Resolution Trends Chart. Use arrow keys to navigate dates."
    >
      {/* Subtle Apple-style Ambient Backdrop Glow */}
      <div
        className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 w-3/4 h-48 bg-gradient-to-b from-[#176B63]/10 to-transparent blur-3xl opacity-60 rounded-full"
        aria-hidden="true"
      />

      {/* 1. CHART HEADER */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-200/80 relative z-10">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-[#176B63] to-[#10574F] flex items-center justify-center text-white shadow-xs">
              <Activity className="h-4.5 w-4.5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
                Ticket Volume & Resolution Trends
                {isLoading && (
                  <RefreshCw className="h-3.5 w-3.5 text-[#176B63] animate-spin inline-block ml-1" />
                )}
              </h3>
              <p className="text-xs text-slate-600 font-medium">
                Daily comparison of incoming complaints and verified resolutions
              </p>
            </div>
          </div>
        </div>

        {/* Header Controls: Reporting Period + Segmented Period Selector + Comparison Toggle */}
        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
          {/* Current Reporting Period Badge */}
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100/90 border border-slate-200/80 text-xs font-semibold text-slate-700 shadow-2xs">
            <Calendar className="h-3.5 w-3.5 text-[#176B63]" />
            <span>{periodDateRange}</span>
          </div>

          {/* Apple-style Compact Period Segmented Control */}
          <div className="inline-flex items-center bg-slate-100/80 p-0.5 rounded-xl border border-slate-200/80 shadow-2xs">
            {(
              [
                { id: "7d", label: "7 Days" },
                { id: "30d", label: "30 Days" },
                { id: "90d", label: "90 Days" },
              ] as const
            ).map((seg) => {
              const active = timeframe === seg.id;
              return (
                <button
                  key={seg.id}
                  onClick={() => onTimeframeChange(seg.id)}
                  disabled={isLoading}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 cursor-pointer disabled:opacity-50 ${
                    active
                      ? "bg-white text-[#176B63] shadow-xs scale-100 font-black border border-slate-200/40"
                      : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
                  }`}
                >
                  {seg.label}
                </button>
              );
            })}
          </div>

          {/* Optional Comparison Toggle (if backend comparisons exist) */}
          {comparisons && (
            <button
              onClick={() => setShowComparison(!showComparison)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                showComparison
                  ? "bg-[#E8F3F1] text-[#176B63] border-[#176B63]/30 shadow-2xs"
                  : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100/80"
              }`}
              title="Toggle comparison against prior reporting window"
            >
              <TrendingUp className="h-3 w-3" />
              <span>Prior Period</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. LEGEND BAR */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs pt-1 relative z-10">
        <div className="flex items-center gap-5">
          {/* Created Tickets Legend */}
          <div className="flex items-center gap-2">
            <span
              className="h-2.5 w-5 rounded-full inline-block shadow-2xs"
              style={{ background: "linear-gradient(90deg, #176B63, #1D8A7F)" }}
            />
            <span className="font-extrabold text-slate-900">Incoming Complaints</span>
            <span className="text-[11px] font-bold text-[#176B63] bg-[#E8F3F1] px-1.5 py-0.5 rounded-md tabular-nums">
              {totalCreated}
            </span>
            {showComparison && comparisons?.created_delta_pct != null && (
              <span
                className={`text-[10px] font-black px-1.5 py-0.5 rounded flex items-center gap-0.5 ${
                  comparisons.created_delta_pct > 0
                    ? "bg-amber-50 text-amber-700 border border-amber-200"
                    : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                }`}
              >
                {comparisons.created_delta_pct > 0 ? "+" : ""}
                {comparisons.created_delta_pct}% vs prior
              </span>
            )}
          </div>

          {/* Resolved Tickets Legend */}
          <div className="flex items-center gap-2">
            <span
              className="h-2.5 w-5 rounded-full inline-block shadow-2xs"
              style={{ background: "linear-gradient(90deg, #2563EB, #3B82F6)" }}
            />
            <span className="font-extrabold text-slate-900">Verified Resolutions</span>
            <span className="text-[11px] font-bold text-[#2563EB] bg-[#EEF4FD] px-1.5 py-0.5 rounded-md tabular-nums">
              {totalResolved}
            </span>
            {showComparison && comparisons?.completed_delta_pct != null && (
              <span
                className={`text-[10px] font-black px-1.5 py-0.5 rounded flex items-center gap-0.5 ${
                  comparisons.completed_delta_pct >= 0
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                    : "bg-rose-50 text-rose-700 border border-rose-200"
                }`}
              >
                {comparisons.completed_delta_pct > 0 ? "+" : ""}
                {comparisons.completed_delta_pct}% vs prior
              </span>
            )}
          </div>
        </div>

        {/* Micro-hint */}
        <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-slate-600 font-medium">
          <Info className="h-3 w-3 text-slate-600" />
          <span>Hover or use arrow keys to inspect day details</span>
        </div>
      </div>

      {/* 3. DUAL-LINE AREA CHART (SVG) */}
      {data.length === 0 ? (
        <div className="h-72 flex flex-col items-center justify-center rounded-2xl bg-slate-50/50 border border-dashed border-slate-200 p-8 text-center">
          <Activity className="h-10 w-10 text-slate-300 mb-2" />
          <p className="text-sm font-bold text-slate-700">No ticket records in this timeframe</p>
          <p className="text-xs text-slate-600 mt-1 max-w-sm">
            Try switching to 30 Days or 90 Days to view historical trends.
          </p>
          <button
            onClick={() => onTimeframeChange("30d")}
            className="mt-3 px-3 py-1.5 text-xs font-bold text-[#176B63] bg-white border border-slate-200 rounded-lg shadow-2xs hover:bg-slate-50 cursor-pointer"
          >
            Switch to 30 Days
          </button>
        </div>
      ) : (
        <div
          className="relative rounded-2xl bg-gradient-to-b from-white/70 via-slate-50/30 to-slate-100/40 border border-slate-200/90 shadow-[inset_0_1px_3px_rgba(0,0,0,0.02)] overflow-hidden select-none"
          style={{ minHeight: 310 }}
        >
          <svg
            viewBox={`0 0 ${chartW} ${chartH}`}
            className="w-full h-auto block"
            style={{ minHeight: 280 }}
            preserveAspectRatio="xMidYMid meet"
          >
            <defs>
              {/* Created Gradient Area Fill */}
              <linearGradient id="careops-grad-created" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#176B63" stopOpacity="0.22" />
                <stop offset="70%" stopColor="#176B63" stopOpacity="0.04" />
                <stop offset="100%" stopColor="#176B63" stopOpacity="0" />
              </linearGradient>

              {/* Resolved Gradient Area Fill */}
              <linearGradient id="careops-grad-resolved" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#2563EB" stopOpacity="0.18" />
                <stop offset="70%" stopColor="#2563EB" stopOpacity="0.03" />
                <stop offset="100%" stopColor="#2563EB" stopOpacity="0" />
              </linearGradient>

              {/* Latest Day Column Ambient Glow */}
              <linearGradient id="careops-latest-col-glow" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#176B63" stopOpacity="0.12" />
                <stop offset="80%" stopColor="#176B63" stopOpacity="0.03" />
                <stop offset="100%" stopColor="#176B63" stopOpacity="0" />
              </linearGradient>

              {/* Drop Shadow Filter for Hover Focus */}
              <filter id="point-glow" x="-50%" y="-50%" width="200%" height="200%">
                <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.15" />
              </filter>
            </defs>

            {/* Horizontal Gridlines & Left Y-Axis Values */}
            {gridLines.map((g) => (
              <g key={`grid-${g.val}`}>
                <line
                  x1={padL}
                  y1={g.y}
                  x2={chartW - padR}
                  y2={g.y}
                  stroke="#E2E8F0"
                  strokeWidth={g.val === 0 ? "1.2" : "0.8"}
                  strokeDasharray={g.val === 0 ? "none" : "4 4"}
                />
                <text
                  x={padL - 10}
                  y={g.y + 3.5}
                  textAnchor="end"
                  fontSize="10"
                  fontWeight="700"
                  fill="#64748B"
                  fontFamily="-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif"
                  className="tabular-nums"
                >
                  {g.val}
                </text>
              </g>
            ))}

            {/* Latest Day Vertical Indicator Strip */}
            {data.length > 1 && (() => {
              const latestIdx = data.length - 1;
              const lx = xOf(latestIdx);
              const colW = Math.max(34, Math.min(54, plotW / (data.length - 1)));
              return (
                <g>
                  <rect
                    x={lx - colW / 2}
                    y={padT - 6}
                    width={colW}
                    height={plotH + 6}
                    fill="url(#careops-latest-col-glow)"
                    rx="8"
                  />
                  {/* Subtle top indicator tag */}
                  <g transform={`translate(${lx}, ${padT - 14})`}>
                    <rect
                      x="-18"
                      y="-10"
                      width="36"
                      height="16"
                      rx="8"
                      fill="#176B63"
                      className="shadow-2xs"
                    />
                    <text
                      x="0"
                      y="1.5"
                      textAnchor="middle"
                      fontSize="9"
                      fontWeight="800"
                      fill="#FFFFFF"
                      letterSpacing="0.02em"
                    >
                      TODAY
                    </text>
                  </g>
                </g>
              );
            })()}

            {/* Area Fills */}
            {createdArea && <path d={createdArea} fill="url(#careops-grad-created)" />}
            {resolvedArea && <path d={resolvedArea} fill="url(#careops-grad-resolved)" />}

            {/* Smooth Dual-Line Curves */}
            <path
              d={createdLine}
              fill="none"
              stroke="#176B63"
              strokeWidth="2.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d={resolvedLine}
              fill="none"
              stroke="#2563EB"
              strokeWidth="2.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Circular Data-Point Markers — Created Series */}
            {createdPts.map(([cx, cy], i) => {
              const isLatest = i === data.length - 1;
              const isHovered = activeIndex === i;
              return (
                <g key={`marker-c-${i}`}>
                  {/* Outer glowing ring for latest day or active point */}
                  {(isLatest || isHovered) && (
                    <circle
                      cx={cx}
                      cy={cy}
                      r={isHovered ? "10" : "7.5"}
                      fill="none"
                      stroke="#176B63"
                      strokeWidth="1.5"
                      opacity={isHovered ? 0.35 : 0.25}
                    />
                  )}
                  {/* Solid White Center with High-Contrast Colored Border */}
                  <circle
                    cx={cx}
                    cy={cy}
                    r={isHovered ? "5.5" : "4.25"}
                    fill="#FFFFFF"
                    stroke="#176B63"
                    strokeWidth={isHovered ? "2.5" : "2"}
                    filter="url(#point-glow)"
                  />
                </g>
              );
            })}

            {/* Circular Data-Point Markers — Resolved Series */}
            {resolvedPts.map(([cx, cy], i) => {
              const isLatest = i === data.length - 1;
              const isHovered = activeIndex === i;
              return (
                <g key={`marker-r-${i}`}>
                  {(isLatest || isHovered) && (
                    <circle
                      cx={cx}
                      cy={cy}
                      r={isHovered ? "10" : "7.5"}
                      fill="none"
                      stroke="#2563EB"
                      strokeWidth="1.5"
                      opacity={isHovered ? 0.35 : 0.25}
                    />
                  )}
                  <circle
                    cx={cx}
                    cy={cy}
                    r={isHovered ? "5.5" : "4.25"}
                    fill="#FFFFFF"
                    stroke="#2563EB"
                    strokeWidth={isHovered ? "2.5" : "2"}
                    filter="url(#point-glow)"
                  />
                </g>
              );
            })}

            {/* X-Axis Date / Day Labels */}
            {data.map((item, i) => {
              const isLatest = i === data.length - 1;
              const isHovered = activeIndex === i;
              return (
                <g key={`xaxis-${i}`}>
                  <text
                    x={xOf(i)}
                    y={chartH - 8}
                    textAnchor="middle"
                    fontSize="10.5"
                    fontWeight={isLatest || isHovered ? "800" : "600"}
                    fill={isHovered ? "#176B63" : isLatest ? "#0F172A" : "#64748B"}
                    fontFamily="-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif"
                    className="transition-colors duration-150"
                  >
                    {item.label}
                  </text>
                  {isLatest && (
                    <circle cx={xOf(i)} cy={chartH - 2} r="1.5" fill="#176B63" />
                  )}
                </g>
              );
            })}

            {/* Transparent Interactive Hover Hit Regions */}
            {data.map((item, i) => {
              const colW = data.length > 1 ? plotW / (data.length - 1) : plotW;
              const rx = xOf(i) - colW / 2;
              return (
                <rect
                  key={`hitbox-${i}`}
                  x={Math.max(padL, rx)}
                  y={padT - 10}
                  width={Math.min(colW, plotW)}
                  height={plotH + padB + 10}
                  fill="transparent"
                  className="cursor-pointer"
                  onMouseEnter={() => setHoveredIndex(i)}
                  onMouseLeave={() => setHoveredIndex((curr) => (curr === i ? null : curr))}
                  onClick={() => {
                    if (onSelectDate && item.date) {
                      onSelectDate(item.date);
                    } else if (onViewAllTickets) {
                      onViewAllTickets();
                    }
                  }}
                  role="button"
                  aria-label={`${item.label}: ${item.created} created, ${item.resolved} resolved.`}
                />
              );
            })}

            {/* Interactive Crosshair & Apple Glassmorphism Tooltip */}
            {activeItem !== null && activeIndex !== null && (() => {
              const hx = xOf(activeIndex);
              const hCreated = activeItem.created || 0;
              const hResolved = activeItem.resolved || 0;
              const hNet = hCreated - hResolved;
              const fullDateStr = formatFullDate(activeItem.date, activeItem.label);

              // Tooltip positioning & boundaries
              const tipW = 196;
              const tipH = 114;
              let tipX = hx - tipW / 2;
              if (tipX < padL) tipX = padL;
              if (tipX + tipW > chartW - padR) tipX = chartW - padR - tipW;
              const tipY = Math.max(8, padT - 18);

              return (
                <g className="pointer-events-none transition-opacity duration-150">
                  {/* Vertical Crosshair Line */}
                  <line
                    x1={hx}
                    y1={padT}
                    x2={hx}
                    y2={baseline}
                    stroke="#176B63"
                    strokeWidth="1.25"
                    strokeDasharray="3 3"
                    opacity="0.6"
                  />

                  {/* Concentric Pulsing Dot Highlights */}
                  <circle cx={hx} cy={yOf(hCreated)} r="7" fill="#176B63" opacity="0.2" />
                  <circle cx={hx} cy={yOf(hResolved)} r="7" fill="#2563EB" opacity="0.2" />

                  {/* Glassmorphism Interactive Tooltip Popover */}
                  <foreignObject x={tipX} y={tipY} width={tipW} height={tipH + 6}>
                    <div
                      className="glass-popover rounded-xl p-3 border border-slate-200/90 shadow-[0_12px_28px_-4px_rgba(15,23,42,0.15)] text-slate-800 backdrop-blur-xl"
                      style={{
                        background: "rgba(255, 255, 255, 0.94)",
                      }}
                    >
                      {/* Tooltip Header Date */}
                      <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-slate-200/80">
                        <span className="font-black text-xs text-slate-900 tracking-tight">
                          {fullDateStr}
                        </span>
                        <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
                          Day {activeIndex + 1}
                        </span>
                      </div>

                      {/* Created Tickets Row */}
                      <div className="flex items-center justify-between py-0.5 text-xs">
                        <span className="flex items-center gap-1.5 font-bold text-slate-600">
                          <span className="inline-block h-2 w-2 rounded-full bg-[#176B63]" />
                          Created:
                        </span>
                        <span className="font-extrabold text-[#176B63] tabular-nums">
                          {hCreated}
                        </span>
                      </div>

                      {/* Resolved Tickets Row */}
                      <div className="flex items-center justify-between py-0.5 text-xs">
                        <span className="flex items-center gap-1.5 font-bold text-slate-600">
                          <span className="inline-block h-2 w-2 rounded-full bg-[#2563EB]" />
                          Resolved:
                        </span>
                        <span className="font-extrabold text-[#2563EB] tabular-nums">
                          {hResolved}
                        </span>
                      </div>

                      {/* Net Daily Change */}
                      <div className="flex items-center justify-between pt-1.5 mt-1 border-t border-slate-200/80 text-xs">
                        <span className="text-[11px] font-semibold text-slate-600">Net Delta:</span>
                        <span
                          className={`text-xs font-black tabular-nums px-1.5 py-0.5 rounded ${
                            hNet > 0
                              ? "text-rose-700 bg-rose-50"
                              : hNet < 0
                              ? "text-emerald-700 bg-emerald-50"
                              : "text-slate-600 bg-slate-100"
                          }`}
                        >
                          {hNet > 0 ? `+${hNet} backlog` : hNet < 0 ? `${hNet} cleared` : "Balanced"}
                        </span>
                      </div>
                    </div>
                  </foreignObject>
                </g>
              );
            })()}
          </svg>
        </div>
      )}

      {/* 4. COMPACT MEANINGFUL SUMMARY CONTEXT STRIP */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
        {/* Metric 1: Total Created */}
        <div className="p-3.5 rounded-xl bg-gradient-to-br from-[#E8F3F1]/80 to-[#E8F3F1]/40 border border-[#B6DCD7]/70 shadow-2xs">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-extrabold text-[#176B63] uppercase tracking-wider">
              Total Created
            </span>
            <Inbox className="h-3.5 w-3.5 text-[#176B63]" />
          </div>
          <div className="text-xl font-black text-[#176B63] tabular-nums tracking-tight">
            {totalCreated}
          </div>
          <div className="text-[11px] text-slate-600 font-medium mt-0.5">
            Incoming complaints in period
          </div>
          {comparisons?.created_delta_pct != null && showComparison && (
            <div className="text-[10px] font-bold text-slate-700 mt-1 flex items-center gap-1">
              <span>vs prior:</span>
              <span className={comparisons.created_delta_pct > 0 ? "text-amber-700" : "text-emerald-700"}>
                {comparisons.created_delta_pct > 0 ? `+${comparisons.created_delta_pct}%` : `${comparisons.created_delta_pct}%`}
              </span>
            </div>
          )}
        </div>

        {/* Metric 2: Total Resolved */}
        <div className="p-3.5 rounded-xl bg-gradient-to-br from-[#EEF4FD]/80 to-[#EEF4FD]/40 border border-[#BFDBFE]/70 shadow-2xs">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-extrabold text-[#2563EB] uppercase tracking-wider">
              Total Resolved
            </span>
            <CheckCircle2 className="h-3.5 w-3.5 text-[#2563EB]" />
          </div>
          <div className="text-xl font-black text-[#2563EB] tabular-nums tracking-tight">
            {totalResolved}
          </div>
          <div className="text-[11px] text-slate-600 font-medium mt-0.5">
            Verified resolutions in period
          </div>
          {comparisons?.completed_delta_pct != null && showComparison && (
            <div className="text-[10px] font-bold text-slate-700 mt-1 flex items-center gap-1">
              <span>vs prior:</span>
              <span className={comparisons.completed_delta_pct >= 0 ? "text-emerald-700" : "text-rose-700"}>
                {comparisons.completed_delta_pct > 0 ? `+${comparisons.completed_delta_pct}%` : `${comparisons.completed_delta_pct}%`}
              </span>
            </div>
          )}
        </div>

        {/* Metric 3: Current Net Change */}
        <div className="p-3.5 rounded-xl bg-white/80 border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-extrabold text-slate-600 uppercase tracking-wider">
              Net Change
            </span>
            {netChange > 0 ? (
              <ArrowUpRight className="h-3.5 w-3.5 text-rose-600" />
            ) : netChange < 0 ? (
              <ArrowDownRight className="h-3.5 w-3.5 text-emerald-600" />
            ) : (
              <CheckCircle2 className="h-3.5 w-3.5 text-slate-500" />
            )}
          </div>
          <div
            className={`text-xl font-black tabular-nums tracking-tight flex items-center gap-1 ${
              netChange > 0 ? "text-rose-600" : netChange < 0 ? "text-emerald-600" : "text-slate-800"
            }`}
          >
            {netChange > 0 ? `+${netChange}` : netChange}
          </div>
          <div className="text-[11px] text-slate-600 font-medium mt-0.5">
            {netChange > 0
              ? "Backlog increased"
              : netChange < 0
              ? "Backlog reduced"
              : "Balanced operational load"}
          </div>
        </div>

        {/* Metric 4: Resolution Ratio */}
        <div className="p-3.5 rounded-xl bg-white/80 border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-extrabold text-slate-600 uppercase tracking-wider">
              Resolution Ratio
            </span>
            <TrendingUp className="h-3.5 w-3.5 text-slate-500" />
          </div>
          <div className="text-xl font-black text-slate-900 tabular-nums tracking-tight">
            {resolutionRatio}
          </div>
          <div className="text-[11px] text-slate-600 font-medium mt-0.5" title="Resolved ÷ Created × 100">
            Resolved ÷ Created (throughput)
          </div>
        </div>
      </div>

      {/* 5. FOOTER ACTION */}
      <div className="flex items-center justify-between pt-2 text-xs">
        <span className="text-[11px] text-slate-600 font-medium">
          Clicking any date point filters the live ticket registry for that date.
        </span>
        {onViewAllTickets && (
          <button
            onClick={onViewAllTickets}
            className="font-bold text-[#176B63] hover:text-[#10574F] hover:underline inline-flex items-center gap-1 cursor-pointer transition-colors"
          >
            <span>View all tickets for this period</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
