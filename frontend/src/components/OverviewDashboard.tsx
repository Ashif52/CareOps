"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Inbox,
  Clock,
  AlertOctagon,
  Percent,
  Timer,
  Sparkles,
  ArrowUpRight,
  ArrowDownRight,
  CheckCircle2,
  AlertTriangle,
  ChevronRight,
  ChevronDown,
  Check,
  Wrench,
  Stethoscope,
  Bed,
  Monitor,
  PlusCircle,
  PlayCircle,
  BarChart3,
  ListFilter,
  RefreshCw,
  Activity,
  ShieldCheck,
  TrendingUp,
  PieChart as PieIcon,
  Users,
  Building2,
  Calendar,
  Layers,
  ArrowRight
} from "lucide-react";
import { DashboardMetrics, Ticket, User, formatDurationHoursMinutes, api } from "@/lib/api";
import { TicketVolumeTrendsChart } from "@/components/analytics/TicketVolumeTrendsChart";

interface OverviewDashboardProps {
  metrics: DashboardMetrics | null;
  currentUser?: User | null;
  onSelectTicket: (ticketId: number) => void;
  onViewAllTickets: (filterStatus?: string, departmentId?: string, slaFilter?: string, dateFilter?: string) => void;
  onViewAIVerification: () => void;
  onNavigateTab?: (tab: string) => void;
  onOpenCreateTicket?: () => void;
  onRunSLACheck?: () => void;
  isRunningSLACheck?: boolean;
}

export function OverviewDashboard({
  metrics: initialMetrics,
  currentUser,
  onSelectTicket,
  onViewAllTickets,
  onViewAIVerification,
  onNavigateTab,
  onOpenCreateTicket,
  onRunSLACheck,
  isRunningSLACheck = false,
}: OverviewDashboardProps) {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(initialMetrics);
  const [timeframe, setTimeframe] = useState<"24h" | "7d" | "30d" | "90d">("7d");
  const [selectedDeptFilter, setSelectedDeptFilter] = useState<string>("all");
  const [isDeptDropdownOpen, setIsDeptDropdownOpen] = useState(false);
  const deptDropdownRef = useRef<HTMLDivElement>(null);
  const [isLoadingTimeframe, setIsLoadingTimeframe] = useState(false);
  const [hoveredTrend, setHoveredTrend] = useState<any | null>(null);
  const [activeChartTab, setActiveChartTab] = useState<"volume" | "depts" | "status" | "sla" | "resolution" | "workload" | "trends">("volume");

  // Close department dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (deptDropdownRef.current && !deptDropdownRef.current.contains(e.target as Node)) {
        setIsDeptDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Keep metrics in sync when initialMetrics changes
  useEffect(() => {
    if (initialMetrics) {
      setMetrics(initialMetrics);
    }
  }, [initialMetrics]);

  // Handle timeframe change with live API aggregation
  const handleTimeframeChange = async (newTf: "24h" | "7d" | "30d" | "90d") => {
    setTimeframe(newTf);
    setIsLoadingTimeframe(true);
    try {
      const data = await api.getDashboardMetrics(newTf, selectedDeptFilter);
      setMetrics(data);
    } catch (err) {
      console.error("Failed to load metrics for timeframe:", err);
    } finally {
      setIsLoadingTimeframe(false);
    }
  };

  // Handle department filter change (for admins/superadmin)
  const handleDeptFilterChange = async (deptId: string) => {
    setSelectedDeptFilter(deptId);
    setIsLoadingTimeframe(true);
    try {
      const data = await api.getDashboardMetrics(timeframe, deptId);
      setMetrics(data);
    } catch (err) {
      console.error("Failed to filter metrics by department:", err);
    } finally {
      setIsLoadingTimeframe(false);
    }
  };

  if (!metrics) {
    return (
      <div className="p-16 flex flex-col items-center justify-center space-y-3">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#176B63]" />
        <p className="text-xs font-bold text-[#64748B]">Loading hospital operational metrics...</p>
      </div>
    );
  }

  const { kpis, charts, department_workload = [], sla_by_department = [], volume_trends = [], priority_overdue = [], system_health } = metrics;
  const userRole = currentUser?.role || "admin";

  // Calculate high-fidelity chart data from backend charts object (with robust fallbacks)
  const chartVolume = charts?.volume_over_time || volume_trends.map((v, i) => ({
    bucket_index: i,
    label: v.day,
    date: v.day,
    created: v.created,
    resolved: v.resolved,
    total_volume: v.created
  }));

  const chartDepts = charts?.tickets_by_department || department_workload.map((d) => ({
    department_id: d.department_id,
    department_name: d.department_name,
    code: d.code,
    open: d.count,
    in_progress: 0,
    overdue: 0,
    completed: 0,
    total: d.count
  }));

  const chartStatus = charts?.status_distribution || [
    { status: "submitted", label: "Submitted", count: kpis.unacknowledged_tickets || 0, percentage: 20, color: "#64748B" },
    { status: "in_progress", label: "In Progress", count: kpis.in_progress_tickets || 0, percentage: 35, color: "#F59E0B" },
    { status: "resolution_submitted", label: "Awaiting Verification", count: kpis.awaiting_verification || 0, percentage: 15, color: "#8B5CF6" },
    { status: "closed", label: "Closed / Verified", count: kpis.completed_tickets || 0, percentage: 30, color: "#10B981" }
  ];

  const chartSLA = charts?.sla_performance || {
    compliant_count: Math.max(0, kpis.total_open_tickets - kpis.overdue_tickets),
    breached_count: kpis.overdue_tickets,
    compliance_rate: kpis.sla_compliance_rate,
    by_priority: [
      { priority: "critical", total: 2, compliant: 2, breached: 0, compliance_rate: 100 },
      { priority: "high", total: 4, compliant: 3, breached: 1, compliance_rate: 75 },
      { priority: "medium", total: 8, compliant: 7, breached: 1, compliance_rate: 87.5 },
      { priority: "low", total: 5, compliant: 5, breached: 0, compliance_rate: 100 }
    ]
  };

  const chartAvgRes = charts?.avg_resolution_time_by_department || department_workload.map((d) => ({
    department_id: d.department_id,
    department_name: d.department_name,
    avg_resolution_minutes: kpis.avg_resolution_time_minutes || 25
  }));

  const chartWorkload = charts?.workload_distribution || {
    assigned_tickets: Math.max(0, kpis.total_open_tickets - (kpis.unacknowledged_tickets || 0)),
    unassigned_tickets: kpis.unacknowledged_tickets || 0,
    staff_workload: []
  };

  // 8 Required Overview KPI Cards
  const kpiCards = [
    {
      id: "open_tickets",
      title: "Total Open Tickets",
      value: kpis.total_open_tickets,
      sub: "Active unresolved hospital requests",
      icon: Inbox,
      iconBg: "bg-[#F1F5F9] text-[#0F172A]",
      color: "text-[#0F172A]",
      border: "border-[#CBD5E1]",
      badge: "In Queue",
      badgeColor: "bg-[#F1F5F9] text-[#334155] border border-[#CBD5E1]",
      actionHint: "Filter Open Tickets",
      onClick: () => onViewAllTickets("open"),
    },
    {
      id: "unacknowledged",
      title: "Unacknowledged",
      value: kpis.unacknowledged_tickets ?? 0,
      sub: "Awaiting staff acknowledgement",
      icon: Clock,
      iconBg: "bg-[#FEF3C7] text-[#B45309]",
      color: "text-[#B45309]",
      border: "border-[#FCD34D]",
      badge: "Action Needed",
      badgeColor: "bg-[#FEF3C7] text-[#92400E] border border-[#FDE68A]",
      actionHint: "Inspect Unacknowledged",
      onClick: () => onViewAllTickets("submitted"),
    },
    {
      id: "in_progress",
      title: "In-Progress Tasks",
      value: kpis.in_progress_tickets ?? 0,
      sub: "Under active staff maintenance",
      icon: PlayCircle,
      iconBg: "bg-[#EEF4FD] text-[#2563EB]",
      color: "text-[#2563EB]",
      border: "border-[#BFDBFE]",
      badge: "Active",
      badgeColor: "bg-[#EEF4FD] text-[#1D4ED8] border border-[#DBEAFE]",
      actionHint: "View In-Progress",
      onClick: () => onViewAllTickets("in_progress"),
    },
    {
      id: "overdue",
      title: "Overdue Tickets",
      value: kpis.overdue_tickets,
      sub: "Breached resolution deadline",
      icon: AlertOctagon,
      iconBg: "bg-[#FEE2E2] text-[#DC2626]",
      color: "text-[#DC2626]",
      border: "border-[#FCA5A5]",
      badge: "Breached",
      badgeColor: "bg-[#FEF2F2] text-[#991B1B] border border-[#FECACA]",
      actionHint: "Triage Overdue",
      onClick: () => onViewAllTickets("open", undefined, "overdue"),
    },
    {
      id: "awaiting_verification",
      title: "Awaiting Verification",
      value: kpis.awaiting_verification ?? kpis.pending_ai_verifications ?? 0,
      sub: "Staff completed, ready for sign-off",
      icon: Sparkles,
      iconBg: "bg-[#F5F3FF] text-[#7C3AED]",
      color: "text-[#7C3AED]",
      border: "border-[#DDD6FE]",
      badge: "Inspection Queue",
      badgeColor: "bg-[#F5F3FF] text-[#6D28D9] border border-[#E9D5FF]",
      actionHint: "Verify Resolutions",
      onClick: () => (onViewAIVerification ? onViewAIVerification() : onViewAllTickets("resolution_submitted")),
    },
    {
      id: "completed_tickets",
      title: `Completed (${timeframe})`,
      value: kpis.completed_tickets ?? 0,
      sub: `Resolved within selected ${timeframe}`,
      icon: CheckCircle2,
      iconBg: "bg-[#ECFDF5] text-[#059669]",
      color: "text-[#059669]",
      border: "border-[#A7F3D0]",
      badge: "Resolved",
      badgeColor: "bg-[#ECFDF5] text-[#059669] border border-[#A7F3D0]",
      actionHint: "Inspect Completed",
      onClick: () => onViewAllTickets("closed"),
    },
    {
      id: "avg_resolution",
      title: "Avg Resolution Time",
      value: `${kpis.avg_resolution_time_minutes}m`,
      sub: "Minutes from ticket open to closure",
      icon: Timer,
      iconBg: "bg-[#E8F3F1] text-[#176B63]",
      color: "text-[#176B63]",
      border: "border-[#A7D7D1]",
      badge: "Efficiency",
      badgeColor: "bg-[#E8F3F1] text-[#176B63] border border-[#A7D7D1]",
      actionHint: "Department Breakdown",
      onClick: () => setActiveChartTab("resolution"),
    },
    {
      id: "sla_compliance",
      title: "SLA Compliance",
      value: `${kpis.sla_compliance_rate}%`,
      sub: "Target: 95.0% adherence rate",
      icon: Percent,
      iconBg: "bg-[#EDF7F2] text-[#16805D]",
      color: "text-[#16805D]",
      border: "border-[#99F6E4]",
      badge: "Hospital SLA",
      badgeColor: "bg-[#EDF7F2] text-[#16805D] border border-[#A6E1CE]",
      actionHint: "Inspect SLA Breakdown",
      onClick: () => setActiveChartTab("sla"),
    },
  ];

  return (
    <div className="w-full max-w-[1720px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-10 py-6 space-y-8">
      {/* Role-Specific Header Banner with Restrained Glassmorphism */}
      <div className="glass-surface rounded-3xl p-6 sm:p-7 flex flex-col md:flex-row md:items-center justify-between gap-5 border border-white/60 shadow-xs">
        <div>
          <div className="flex items-center gap-2.5 mb-1.5">
            <span className="text-xs font-black uppercase tracking-wider px-3 py-1 rounded-full bg-[#176B63] text-white">
              {userRole === "superadmin"
                ? "System Executive View"
                : userRole === "supervisor"
                ? "Department Operations"
                : userRole === "staff"
                ? "Staff Operational Queue"
                : "Hospital Operations HQ"}
            </span>
            {system_health && (
              <span className="text-xs font-bold text-[#16805D] flex items-center gap-1.5 bg-[#EDF7F2] px-2.5 py-1 rounded-full">
                <span className="h-2 w-2 rounded-full bg-[#16805D] animate-ping" />
                Live Network Sync
              </span>
            )}
          </div>
          <h1 className="text-2xl sm:text-3xl lg:text-3.5xl font-black text-[#0F172A] tracking-tight">
            {userRole === "superadmin"
              ? "Organization-Wide Operations & Governance"
              : userRole === "supervisor"
              ? `${(currentUser?.department_id || "Department").toUpperCase()} Department Command Center`
              : userRole === "staff"
              ? "Personal Assigned Work & Tasks"
              : "Hospital Operations & Task Analytics"}
          </h1>
          <p className="text-sm sm:text-base text-[#475569] font-medium mt-1">
            {userRole === "superadmin"
              ? "Real-time system telemetry, cross-department SLA performance, and compliance metrics."
              : userRole === "supervisor"
              ? "Manage incoming requests, monitor staff workload, and approve completed resolutions."
              : "Live database metrics, SLA tracking, and operational throughput across hospital care units."}
          </p>
        </div>

        {/* Global Controls: Timeframe Filter & Department Selector */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Custom Apple-Style Glassmorphic Department Dropdown */}
          {(userRole === "admin" || userRole === "superadmin") && chartDepts.length > 1 && (() => {
            const selectedDeptObj = chartDepts.find((d) => d.department_id === selectedDeptFilter);
            const selectedDeptLabel = selectedDeptFilter === "all" ? "All Departments" : (selectedDeptObj?.department_name || selectedDeptFilter);
            return (
              <div className="relative" ref={deptDropdownRef}>
                <button
                  type="button"
                  onClick={() => setIsDeptDropdownOpen(!isDeptDropdownOpen)}
                  disabled={isLoadingTimeframe}
                  className="bg-white/90 hover:bg-white text-slate-800 border border-slate-200/90 hover:border-slate-300 rounded-xl px-3 py-1.5 text-xs sm:text-[13px] font-bold transition-all shadow-xs flex items-center gap-2 cursor-pointer group"
                  aria-expanded={isDeptDropdownOpen}
                  aria-haspopup="listbox"
                >
                  <div className="h-5 w-5 rounded-md bg-[#176B63]/10 text-[#176B63] flex items-center justify-center shrink-0">
                    <Building2 className="h-3.5 w-3.5" />
                  </div>
                  <span className="truncate max-w-[120px] sm:max-w-[170px] text-left">
                    {selectedDeptLabel}
                  </span>
                  <ChevronDown
                    className={`h-3.5 w-3.5 text-slate-400 group-hover:text-slate-700 transition-transform duration-200 ${
                      isDeptDropdownOpen ? "rotate-180 text-[#176B63]" : ""
                    }`}
                  />
                </button>

                {/* Dropdown Menu Popover */}
                {isDeptDropdownOpen && (
                  <div className="absolute right-0 top-full mt-1.5 w-60 rounded-2xl bg-white/95 backdrop-blur-xl border border-slate-200/80 shadow-[0_12px_36px_rgba(15,23,42,0.12)] p-1.5 z-50 animate-in fade-in zoom-in-95 duration-150 space-y-0.5">
                    <div className="px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider text-slate-400 border-b border-slate-100 mb-1 flex items-center justify-between">
                      <span>Department Filter</span>
                      <span className="text-[#176B63] font-bold">{chartDepts.length} units</span>
                    </div>

                    {/* All Departments Option */}
                    <button
                      type="button"
                      onClick={() => {
                        handleDeptFilterChange("all");
                        setIsDeptDropdownOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        selectedDeptFilter === "all"
                          ? "bg-[#176B63]/10 text-[#176B63]"
                          : "text-slate-700 hover:bg-slate-100/70"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className={`h-2 w-2 rounded-full ${selectedDeptFilter === "all" ? "bg-[#176B63]" : "bg-slate-300"}`} />
                        <span>All Departments</span>
                      </div>
                      {selectedDeptFilter === "all" && <Check className="h-3.5 w-3.5 text-[#176B63]" />}
                    </button>

                    {/* Individual Department Options */}
                    <div className="max-h-56 overflow-y-auto space-y-0.5 scrollbar-thin pt-0.5">
                      {chartDepts.map((d) => {
                        const isSelected = selectedDeptFilter === d.department_id;
                        return (
                          <button
                            key={d.department_id}
                            type="button"
                            onClick={() => {
                              handleDeptFilterChange(d.department_id);
                              setIsDeptDropdownOpen(false);
                            }}
                            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                              isSelected
                                ? "bg-[#176B63]/10 text-[#176B63]"
                                : "text-slate-700 hover:bg-slate-100/70"
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span
                                className={`h-2 w-2 rounded-full shrink-0 ${
                                  isSelected ? "bg-[#176B63]" : "bg-slate-300"
                                }`}
                              />
                              <span className="truncate">{d.department_name}</span>
                            </div>
                            {isSelected && <Check className="h-3.5 w-3.5 text-[#176B63] shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {/* Timeframe Selector */}
          <div className="flex items-center glass-pill rounded-xl p-1 shadow-xs">
            {(["24h", "7d", "30d", "90d"] as const).map((tf) => (
              <button
                key={tf}
                onClick={() => handleTimeframeChange(tf)}
                disabled={isLoadingTimeframe}
                className={`px-3.5 py-1.5 text-xs sm:text-sm font-black rounded-lg transition-all cursor-pointer ${
                  timeframe === tf
                    ? "bg-[#176B63] text-white shadow-xs"
                    : "text-[#475569] hover:text-[#0F172A] hover:bg-black/5"
                }`}
              >
                {tf.toUpperCase()}
              </button>
            ))}
          </div>

          {/* SLA Check Button */}
          {onRunSLACheck && (
            <button
              onClick={onRunSLACheck}
              disabled={isRunningSLACheck}
              className="px-3.5 py-2 rounded-xl border border-[#CBD5E1] bg-white/90 hover:bg-white text-xs sm:text-sm font-bold text-[#0F172A] transition-all flex items-center gap-2 cursor-pointer shadow-xs"
              title="Run on-demand SLA escalation cycle"
            >
              <RefreshCw className={`h-4 w-4 ${isRunningSLACheck ? "animate-spin text-[#176B63]" : ""}`} />
              <span className="hidden sm:inline">SLA Check</span>
            </button>
          )}

          {/* Create Ticket */}
          {onOpenCreateTicket && (
            <button
              onClick={onOpenCreateTicket}
              className="px-4 py-2 rounded-xl bg-[#176B63] hover:bg-[#10574F] text-white text-xs sm:text-sm font-black transition-all flex items-center gap-2 shadow-xs cursor-pointer"
            >
              <PlusCircle className="h-4 w-4" />
              <span>New Ticket</span>
            </button>
          )}
        </div>
      </div>

      {/* 8 Overview KPI Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
        {kpiCards.map((kpi) => {
          const IconComp = kpi.icon;
          return (
            <div
              key={kpi.id}
              onClick={kpi.onClick}
              className="glass-card glass-card-interactive rounded-2xl p-4 sm:p-5 flex flex-col justify-between cursor-pointer group min-h-[155px]"
            >
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${kpi.badgeColor}`}>
                    {kpi.badge}
                  </span>
                  <div className={`h-8.5 w-8.5 rounded-xl flex items-center justify-center shrink-0 shadow-xs ${kpi.iconBg}`}>
                    <IconComp className="h-4.5 w-4.5" />
                  </div>
                </div>

                <div className="text-2xl sm:text-3xl font-black tracking-tight text-[#0F172A] tabular-nums mt-1 font-display">
                  {kpi.value}
                </div>
                <h3 className="text-xs sm:text-[13px] font-bold text-[#1E293B] mt-1">{kpi.title}</h3>
                <p className="text-[11px] text-[#64748B] font-medium mt-0.5 line-clamp-1">{kpi.sub}</p>
              </div>

              <div className="mt-3 pt-2.5 border-t border-[#E2E8F0]/70 flex items-center justify-between text-xs font-bold text-[#176B63] group-hover:text-[#10574F]">
                <span>{kpi.actionHint}</span>
                <ChevronRight className="h-3.5 w-3.5 transform group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          );
        })}
      </div>

      {/* Analytics Visualization Hub: Chart Tabs */}
      <div className="glass-surface rounded-3xl p-6 sm:p-8 border border-white/60 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#E2E8F0]">
          <div>
            <h2 className="text-lg sm:text-xl font-black text-[#0F172A] tracking-tight flex items-center gap-2.5">
              <BarChart3 className="h-5 w-5 text-[#176B63]" />
              Hospital Analytics & Workload Intelligence
            </h2>
            <p className="text-xs sm:text-sm text-[#475569] font-medium mt-1">
              Live database metrics aggregated across {chartDepts.length} department{chartDepts.length === 1 ? "" : "s"} over the last {timeframe}.
            </p>
          </div>

          {/* Interactive Chart Category Pills */}
          <div className="flex flex-wrap items-center gap-1.5 bg-[#F1F5F9]/90 p-1.5 rounded-2xl">
            {[
              { id: "volume", label: "Volume & Trends" },
              { id: "depts", label: "By Department" },
              { id: "status", label: "Status Doughnut" },
              { id: "sla", label: "SLA Breakdown" },
              { id: "resolution", label: "Resolution Speed" },
              { id: "workload", label: "Staff Workload" }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveChartTab(tab.id as any)}
                className={`px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-extrabold transition-all cursor-pointer ${
                  activeChartTab === tab.id
                    ? "bg-white text-[#176B63] shadow-xs"
                    : "text-[#64748B] hover:text-[#0F172A]"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* 1. Ticket Volume & Resolution Trends (Premium Glassmorphism Dual-Line Chart) */}
        {activeChartTab === "volume" && (
          <TicketVolumeTrendsChart
            data={chartVolume}
            timeframe={timeframe}
            onTimeframeChange={handleTimeframeChange}
            isLoading={isLoadingTimeframe}
            comparisons={metrics.kpis?.comparisons}
            onSelectDate={(date) => onViewAllTickets(undefined, undefined, undefined, date)}
            onViewAllTickets={() => onViewAllTickets("open")}
          />
        )}

        {/* 2. Tickets by Department (Chart 2) */}
        {activeChartTab === "depts" && (
          <div className="space-y-4">
            <p className="text-xs text-[#64748B] font-medium">
              Comparison of Open, In-Progress, Overdue, and Completed requests across hospital departments.
            </p>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#E2E8F0] text-[#0F172A] font-bold">
                    <th className="py-2.5 px-3">Department</th>
                    <th className="py-2.5 px-3 text-center">Open</th>
                    <th className="py-2.5 px-3 text-center">In Progress</th>
                    <th className="py-2.5 px-3 text-center">Overdue</th>
                    <th className="py-2.5 px-3 text-center">Completed</th>
                    <th className="py-2.5 px-3 text-right">Workload Proportion</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0]/60">
                  {chartDepts.map((d) => {
                    const totalAll = Math.max(1, chartDepts.reduce((acc, curr) => acc + curr.total, 0));
                    const propPct = Math.round((d.total / totalAll) * 100);

                    return (
                      <tr
                        key={d.department_id}
                        onClick={() => onViewAllTickets(undefined, d.department_id)}
                        className="hover:bg-white/90 transition-colors cursor-pointer font-medium text-[#334155]"
                      >
                        <td className="py-2.5 px-3 font-bold text-[#0F172A] flex items-center gap-2">
                          <span className="font-mono text-[10px] bg-[#F1F5F9] px-1.5 py-0.5 rounded text-[#475569]">
                            {d.code}
                          </span>
                          <span>{d.department_name}</span>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span className="font-bold text-[#334155] bg-[#F1F5F9] px-2 py-0.5 rounded-full">
                            {d.open}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span className="font-bold text-[#2563EB] bg-[#EEF4FD] px-2 py-0.5 rounded-full">
                            {d.in_progress}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span className={`font-bold px-2 py-0.5 rounded-full ${
                            d.overdue > 0 ? "text-[#DC2626] bg-[#FEF2F2]" : "text-[#64748B] bg-[#F1F5F9]"
                          }`}>
                            {d.overdue}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span className="font-bold text-[#059669] bg-[#ECFDF5] px-2 py-0.5 rounded-full">
                            {d.completed}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-24 bg-[#E2E8F0] h-2 rounded-full overflow-hidden">
                              <div
                                style={{ width: `${propPct}%` }}
                                className="h-full bg-[#176B63] rounded-full"
                              />
                            </div>
                            <span className="text-[11px] font-bold text-[#0F172A] min-w-8">
                              {propPct}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 3. Ticket Status Distribution (Doughnut Chart 3) */}
        {activeChartTab === "status" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
            {/* Custom SVG Doughnut */}
            <div className="flex flex-col items-center justify-center p-4">
              <div className="relative w-48 h-48">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    stroke="#F1F5F9"
                    strokeWidth="14"
                    fill="transparent"
                  />
                  {chartStatus.map((st, i) => {
                    const circum = 2 * Math.PI * 40;
                    const prevPcts = chartStatus.slice(0, i).reduce((acc, c) => acc + c.percentage, 0);
                    const strokeDasharray = `${(st.percentage / 100) * circum} ${circum}`;
                    const strokeDashoffset = -((prevPcts / 100) * circum);

                    return (
                      <circle
                        key={st.status}
                        cx="50"
                        cy="50"
                        r="40"
                        stroke={st.color}
                        strokeWidth="14"
                        strokeDasharray={strokeDasharray}
                        strokeDashoffset={strokeDashoffset}
                        fill="transparent"
                        className="transition-all duration-500 hover:opacity-80 cursor-pointer"
                      />
                    );
                  })}
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-2xl font-black text-[#0F172A]">{kpis.total_open_tickets}</span>
                  <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider">Open Tickets</span>
                </div>
              </div>
            </div>

            {/* Legend & Breakdown */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-[#0F172A] uppercase tracking-wider mb-2">
                Status Classification Breakdown
              </h4>
              {chartStatus.map((st) => (
                <div
                  key={st.status}
                  onClick={() => onViewAllTickets(st.status)}
                  className="p-2.5 rounded-xl bg-white/70 border border-[#E2E8F0] hover:bg-white flex items-center justify-between text-xs transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-2">
                    <span
                      style={{ backgroundColor: st.color }}
                      className="h-3 w-3 rounded-full shrink-0"
                    />
                    <span className="font-bold text-[#0F172A]">{st.label}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-[#0F172A]">{st.count}</span>
                    <span className="text-[11px] text-[#64748B]">({st.percentage}%)</span>
                    <ChevronRight className="h-3 w-3 text-[#64748B] group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 4. SLA Performance (Chart 4) */}
        {activeChartTab === "sla" && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-2xl bg-[#EDF7F2] border border-[#A6E1CE]">
                <span className="text-[11px] font-bold text-[#16805D]">Compliant Requests</span>
                <div className="text-2xl font-black text-[#16805D] mt-1">{chartSLA.compliant_count}</div>
                <span className="text-[10px] text-[#16805D]/80">Meeting SLA targets</span>
              </div>
              <div className="p-4 rounded-2xl bg-[#FEF2F2] border border-[#FECACA]">
                <span className="text-[11px] font-bold text-[#DC2626]">Breached Requests</span>
                <div className="text-2xl font-black text-[#DC2626] mt-1">{chartSLA.breached_count}</div>
                <span className="text-[10px] text-[#DC2626]/80">Overdue SLA deadlines</span>
              </div>
              <div className="p-4 rounded-2xl bg-[#E8F3F1] border border-[#B6DCD7]">
                <span className="text-[11px] font-bold text-[#176B63]">SLA Adherence Rate</span>
                <div className="text-2xl font-black text-[#176B63] mt-1">{chartSLA.compliance_rate}%</div>
                <span className="text-[10px] text-[#176B63]/80">Hospital-wide benchmark</span>
              </div>
            </div>

            {/* SLA by Priority Breakdown */}
            <div className="space-y-2 pt-2">
              <h4 className="text-xs font-bold text-[#0F172A] uppercase tracking-wider">
                Adherence by Priority Level
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                {chartSLA.by_priority.map((p) => (
                  <div key={p.priority} className="p-3 bg-white/70 rounded-xl border border-[#E2E8F0] space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-extrabold capitalize text-[#0F172A]">{p.priority}</span>
                      <span className="font-bold text-[#176B63]">{p.compliance_rate}%</span>
                    </div>
                    <div className="w-full bg-[#E2E8F0] h-2 rounded-full overflow-hidden">
                      <div
                        style={{ width: `${p.compliance_rate}%` }}
                        className="h-full bg-[#16805D] rounded-full"
                      />
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-[#64748B]">
                      <span>Compliant: {p.compliant}</span>
                      <span>Breached: {p.breached}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 5. Average Resolution Time by Department (Chart 5) */}
        {activeChartTab === "resolution" && (
          <div className="space-y-4">
            <p className="text-xs text-[#64748B] font-medium">
              Average turnaround duration (in minutes) from ticket creation to final resolution by department.
            </p>

            <div className="space-y-2.5">
              {chartAvgRes.map((d) => {
                const maxMins = Math.max(60, ...chartAvgRes.map((a) => a.avg_resolution_minutes));
                const barWidth = Math.max(8, Math.min(100, Math.round((d.avg_resolution_minutes / maxMins) * 100)));

                return (
                  <div key={d.department_id} className="p-3 bg-white/70 rounded-xl border border-[#E2E8F0] space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span className="text-[#0F172A]">{d.department_name}</span>
                      <span className="text-[#176B63] font-mono">{d.avg_resolution_minutes} mins</span>
                    </div>
                    <div className="w-full bg-[#E2E8F0] h-2.5 rounded-full overflow-hidden">
                      <div
                        style={{ width: `${barWidth}%` }}
                        className="h-full bg-gradient-to-r from-[#176B63] to-[#2563EB] rounded-full"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 6. Workload Distribution (Chart 6) */}
        {activeChartTab === "workload" && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-2xl bg-white/80 border border-[#E2E8F0]">
                <span className="text-xs font-bold text-[#64748B]">Assigned Requests</span>
                <div className="text-2xl font-black text-[#176B63] mt-1">{chartWorkload.assigned_tickets}</div>
                <span className="text-[10px] text-[#64748B]">Actively handled by staff</span>
              </div>
              <div className="p-4 rounded-2xl bg-white/80 border border-[#E2E8F0]">
                <span className="text-xs font-bold text-[#64748B]">Unassigned Requests</span>
                <div className="text-2xl font-black text-[#B45309] mt-1">{chartWorkload.unassigned_tickets}</div>
                <span className="text-[10px] text-[#64748B]">Awaiting supervisor dispatch</span>
              </div>
            </div>

            {/* Individual Staff Workload (where permissions allow) */}
            {chartWorkload.staff_workload && chartWorkload.staff_workload.length > 0 && (
              <div className="space-y-2 pt-2">
                <h4 className="text-xs font-bold text-[#0F172A] uppercase tracking-wider">
                  Staff Active Workload & Completed Tasks
                </h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-[#E2E8F0] text-[#0F172A] font-bold">
                        <th className="py-2 px-3">Staff Member</th>
                        <th className="py-2 px-3">Department</th>
                        <th className="py-2 px-3 text-center">Active Tasks</th>
                        <th className="py-2 px-3 text-center">Completed Tasks</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E2E8F0]/60">
                      {chartWorkload.staff_workload.map((s) => (
                        <tr key={s.staff_id} className="hover:bg-white/90">
                          <td className="py-2.5 px-3 font-bold text-[#0F172A]">
                            <div>{s.name}</div>
                            <div className="text-[10px] text-[#64748B] font-normal">{s.email}</div>
                          </td>
                          <td className="py-2.5 px-3 capitalize text-[#334155]">{s.department_id}</td>
                          <td className="py-2.5 px-3 text-center">
                            <span className="font-bold px-2 py-0.5 rounded-full bg-[#E8F3F1] text-[#176B63]">
                              {s.active_tasks}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span className="font-bold px-2 py-0.5 rounded-full bg-[#ECFDF5] text-[#059669]">
                              {s.completed_tasks}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Priority Overdue Action Table */}
      {priority_overdue.length > 0 && (
        <div className="glass-surface rounded-3xl p-6 sm:p-7 border border-white/60 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <AlertTriangle className="h-5 w-5 text-[#DC2626]" />
              <h3 className="text-base font-black text-[#0F172A]">Priority Overdue Tickets Awaiting Escalation Action</h3>
            </div>
            <button
              onClick={() => onViewAllTickets("open", undefined, "overdue")}
              className="text-xs sm:text-sm font-bold text-[#176B63] hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span>View all overdue ({kpis.overdue_tickets})</span>
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-[#E2E8F0] text-[#0F172A] font-bold">
                  <th className="py-3 px-4">Ticket</th>
                  <th className="py-3 px-4">Room</th>
                  <th className="py-3 px-4">Title</th>
                  <th className="py-3 px-4">Priority</th>
                  <th className="py-3 px-4 text-right">Overdue By</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0]/60">
                {priority_overdue.map((t) => (
                  <tr
                    key={t.id}
                    onClick={() => onSelectTicket(t.id)}
                    className="hover:bg-white/90 transition-colors cursor-pointer text-[#334155] font-medium"
                  >
                    <td className="py-3.5 px-4 font-bold text-[#176B63] font-mono">{t.ticket_number}</td>
                    <td className="py-3.5 px-4 font-bold text-[#0F172A]">{t.room_number}</td>
                    <td className="py-3.5 px-4 truncate max-w-xs">{t.title}</td>
                    <td className="py-3.5 px-4">
                      <span className="font-extrabold uppercase text-xs px-2.5 py-1 rounded-full bg-[#FEF2F2] text-[#DC2626] border border-[#FECACA]">
                        {t.priority}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right font-black text-[#DC2626] tabular-nums">
                      {t.minutes_overdue}m overdue
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <span className="font-bold text-[#176B63] hover:underline">
                        Open Ticket →
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
