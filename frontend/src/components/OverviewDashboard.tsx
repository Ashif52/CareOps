"use client";

import React, { useState } from "react";
import {
  Inbox,
  Clock,
  AlertOctagon,
  Percent,
  Timer,
  Sparkles,
  ArrowUpRight,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  ChevronRight,
  Wrench,
  Stethoscope,
  Sparkle,
  Bed,
  Monitor,
  PlusCircle,
  PlayCircle,
  BarChart3,
  ListFilter,
  RefreshCw,
  Activity,
  ShieldCheck
} from "lucide-react";
import { DashboardMetrics, Ticket, User, formatDurationHoursMinutes, formatTime } from "@/lib/api";

interface OverviewDashboardProps {
  metrics: DashboardMetrics | null;
  currentUser?: User | null;
  onSelectTicket: (ticketId: number) => void;
  onViewAllTickets: (filterStatus?: string, departmentId?: string, slaFilter?: string) => void;
  onViewAIVerification: () => void;
  onNavigateTab?: (tab: string) => void;
  onOpenCreateTicket?: () => void;
  onRunSLACheck?: () => void;
  isRunningSLACheck?: boolean;
}

export function OverviewDashboard({
  metrics,
  currentUser,
  onSelectTicket,
  onViewAllTickets,
  onViewAIVerification,
  onNavigateTab,
  onOpenCreateTicket,
  onRunSLACheck,
  isRunningSLACheck = false,
}: OverviewDashboardProps) {
  const [selectedDayHover, setSelectedDayHover] = useState<{ day: string; created: number; resolved: number } | null>(null);

  if (!metrics) {
    return (
      <div className="p-12 flex flex-col items-center justify-center space-y-3">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#176B63]" />
        <p className="text-xs font-bold text-[#64748B]">Loading hospital operational metrics...</p>
      </div>
    );
  }

  const { kpis, department_workload, sla_by_department, volume_trends, priority_overdue } = metrics;
  const deptCount = department_workload.length || 5;

  const deptIcons: Record<string, any> = {
    maintenance: Wrench,
    housekeeping: Sparkles,
    linen: Bed,
    medical: Stethoscope,
    it: Monitor,
  };

  const kpiCards = [
    {
      id: "open_tickets",
      title: "Total Open Tickets",
      value: kpis.total_open_tickets,
      sub: `Active across ${deptCount} canonical departments`,
      icon: Inbox,
      iconBg: "bg-[#F1F5F9] text-[#0F172A]",
      color: "text-[#0F172A]",
      border: "border-[#CBD5E1]",
      badge: "In Progress",
      badgeColor: "bg-[#F1F5F9] text-[#334155] border border-[#CBD5E1]",
      actionHint: "Filter Open Tickets",
      onClick: () => onViewAllTickets("open"),
    },
    {
      id: "due_soon",
      title: "Tickets Due Soon",
      value: kpis.tickets_due_soon,
      sub: "Within next 60 minutes",
      icon: Clock,
      iconBg: "bg-[#FEF3C7] text-[#B45309]",
      color: "text-[#B45309]",
      border: "border-[#FCD34D]",
      badge: "Warning",
      badgeColor: "bg-[#FEF3C7] text-[#92400E] border border-[#FDE68A]",
      actionHint: "Inspect Due Soon",
      onClick: () => onViewAllTickets("open", undefined, "due_soon"),
    },
    {
      id: "overdue",
      title: "Overdue Tickets",
      value: kpis.overdue_tickets,
      sub: "Escalated to supervisors",
      icon: AlertOctagon,
      iconBg: "bg-[#FEE2E2] text-[#DC2626]",
      color: "text-[#DC2626]",
      border: "border-[#FCA5A5]",
      badge: "Action Required",
      badgeColor: "bg-[#FEF2F2] text-[#991B1B] border border-[#FECACA]",
      actionHint: "Triage Overdue",
      onClick: () => onViewAllTickets("open", undefined, "overdue"),
    },
    {
      id: "sla_compliance",
      title: "SLA Compliance",
      value: `${kpis.sla_compliance_rate}%`,
      sub: "Target: 95.0% adherence",
      icon: Percent,
      iconBg: "bg-[#E8F3F1] text-[#176B63]",
      color: "text-[#16805D]",
      border: "border-[#99F6E4]",
      badge: "Live Metric",
      badgeColor: "bg-[#EDF7F2] text-[#16805D] border border-[#A6E1CE]",
      actionHint: "Inspect SLA Policies",
      onClick: () => (onNavigateTab ? onNavigateTab("sla") : onViewAllTickets()),
    },
    {
      id: "avg_resolution",
      title: "Avg Resolution Time",
      value: `${kpis.avg_resolution_time_minutes}m`,
      sub: "Average time to resolution",
      icon: Timer,
      iconBg: "bg-[#EEF4FD] text-[#2563EB]",
      color: "text-[#2563EB]",
      border: "border-[#BFDBFE]",
      badge: "Historical",
      badgeColor: "bg-[#EEF4FD] text-[#1D4ED8] border border-[#DBEAFE]",
      actionHint: "Detailed Analytics",
      onClick: () => (onNavigateTab ? onNavigateTab("analytics") : onViewAllTickets()),
    },
    {
      id: "pending_ai",
      title: "Pending AI Verifications",
      value: kpis.pending_ai_verifications,
      sub: "Media evidence review required",
      icon: Sparkles,
      iconBg: "bg-[#F5F3FF] text-[#7C3AED]",
      color: "text-[#7C3AED]",
      border: "border-[#DDD6FE]",
      badge: "Review Queue",
      badgeColor: "bg-[#F5F3FF] text-[#6D28D9] border border-[#E9D5FF]",
      actionHint: "Open AI Verification",
      onClick: onViewAIVerification,
    },
  ];

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-7xl mx-auto">
      {/* Top Banner & Quick Operations Bar */}
      <div className="bg-white rounded-2xl border border-[#CBD5E1] p-4 sm:p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-black text-[#0F172A] tracking-tight">
              Hospital Operations Command Center
            </h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#EDF7F2] text-[#16805D] border border-[#A6E1CE]">
              <span className="h-2 w-2 rounded-full bg-[#16805D] animate-pulse" />
              Live Telemetry
            </span>
          </div>
          <p className="text-xs sm:text-sm text-[#475569] mt-0.5 font-medium">
            Real-time triage, cross-department ticket tracking, and AI-governed SLA enforcement.
          </p>
        </div>

        {/* Operational Action Shortcuts */}
        <div className="flex flex-wrap items-center gap-2">
          {onOpenCreateTicket && (
            <button
              onClick={onOpenCreateTicket}
              className="px-3.5 py-2 rounded-xl bg-[#176B63] hover:bg-[#10574F] text-white text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <PlusCircle className="h-4 w-4" />
              <span>New Ticket</span>
            </button>
          )}

          <button
            onClick={onViewAIVerification}
            className="px-3.5 py-2 rounded-xl bg-[#F5F3FF] hover:bg-[#EDE9FE] text-[#6D28D9] border border-[#DDD6FE] text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <Sparkles className="h-4 w-4" />
            <span>AI Review Queue ({kpis.pending_ai_verifications})</span>
          </button>

          {onRunSLACheck && (
            <button
              onClick={onRunSLACheck}
              disabled={isRunningSLACheck}
              className="px-3 py-2 rounded-xl bg-[#F8FAFC] hover:bg-[#F1F5F9] text-[#0F172A] border border-[#CBD5E1] text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
              title="Run instant SLA compliance evaluation across all open hospital tickets"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isRunningSLACheck ? "animate-spin text-[#176B63]" : "text-[#475569]"}`} />
              <span>{isRunningSLACheck ? "Scanning SLAs..." : "Run SLA Scan"}</span>
            </button>
          )}

          <button
            onClick={() => onViewAllTickets("all")}
            className="px-3 py-2 rounded-xl bg-[#F8FAFC] hover:bg-[#F1F5F9] text-[#0F172A] border border-[#CBD5E1] text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <ListFilter className="h-3.5 w-3.5 text-[#475569]" />
            <span>All Tickets</span>
          </button>
        </div>
      </div>

      {/* 6 Responsive Interactive KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3.5">
        {kpiCards.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div
              key={kpi.id}
              onClick={kpi.onClick}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  kpi.onClick();
                }
              }}
              className={`bg-white rounded-2xl p-4 border ${kpi.border} shadow-2xs hover:shadow-md hover:border-[#176B63] transition-all cursor-pointer group flex flex-col justify-between select-none active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-[#176B63]`}
            >
              {/* Card Header: Icon & Status Badge */}
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <div className={`p-2 rounded-xl ${kpi.iconBg}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${kpi.badgeColor}`}>
                    {kpi.badge}
                  </span>
                </div>

                {/* Title: Generous typography, NOT truncated */}
                <span className="text-xs font-bold text-[#475569] uppercase tracking-wide block leading-snug">
                  {kpi.title}
                </span>

                {/* Value: LargeNumeral */}
                <div className="my-1.5">
                  <span className={`text-2xl sm:text-3xl font-black tracking-tight tabular-nums ${kpi.color}`}>
                    {kpi.value}
                  </span>
                </div>

                {/* Subtext: Informational context */}
                <p className="text-[11px] font-semibold text-[#64748B] leading-tight">
                  {kpi.sub}
                </p>
              </div>

              {/* Action Hint on Hover */}
              <div className="mt-3 pt-2.5 border-t border-[#F1F5F9] flex items-center justify-between text-[11px] font-bold text-[#176B63] group-hover:text-[#10574F]">
                <span>{kpi.actionHint}</span>
                <ChevronRight className="h-3.5 w-3.5 transform group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          );
        })}
      </div>

      {/* Middle Operations Grid: Charts & Department Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Ticket Volume Trends (Interactive 7-Day Histogram) */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-[#CBD5E1] p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-[#0F172A]">Ticket Volume & Resolution Trends</h3>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#F1F5F9] text-[#475569]">Last 7 Days</span>
                </div>
                <p className="text-xs text-[#64748B] mt-0.5">Daily comparison of submitted complaints versus verified resolutions</p>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <span className="flex items-center gap-1.5 text-[#176B63] font-bold">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#176B63]" /> Created
                </span>
                <span className="flex items-center gap-1.5 text-[#2563EB] font-bold">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#2563EB]" /> Resolved
                </span>
              </div>
            </div>

            {/* Interactive Bar Chart */}
            <div className="h-52 flex items-end justify-between gap-2.5 pt-4 px-2 border-b border-[#F1F5F9] pb-2">
              {volume_trends.map((item, idx) => {
                const maxVal = Math.max(30, ...volume_trends.map((v) => Math.max(v.created, v.resolved)));
                const createdH = Math.max(8, Math.min(100, Math.round((item.created / maxVal) * 100)));
                const resolvedH = Math.max(8, Math.min(100, Math.round((item.resolved / maxVal) * 100)));
                const isHovered = selectedDayHover?.day === item.day;

                return (
                  <div
                    key={idx}
                    onMouseEnter={() => setSelectedDayHover(item)}
                    onMouseLeave={() => setSelectedDayHover(null)}
                    onClick={() => onViewAllTickets("open")}
                    className="flex-1 flex flex-col items-center gap-2 group cursor-pointer"
                  >
                    <div className="w-full flex items-end justify-center gap-1.5 h-38 relative">
                      {/* Created Bar */}
                      <div
                        style={{ height: `${createdH}%` }}
                        className={`w-3 sm:w-4 bg-[#176B63] rounded-t-md transition-all ${
                          isHovered ? "bg-[#10574F] shadow-xs" : "group-hover:bg-[#10574F]"
                        }`}
                      />
                      {/* Resolved Bar */}
                      <div
                        style={{ height: `${resolvedH}%` }}
                        className={`w-3 sm:w-4 bg-[#2563EB] rounded-t-md transition-all ${
                          isHovered ? "bg-[#1D4ED8] shadow-xs" : "group-hover:bg-[#1D4ED8]"
                        }`}
                      />
                    </div>
                    <span className={`text-[11px] font-bold ${isHovered ? "text-[#0F172A]" : "text-[#64748B]"}`}>
                      {item.day}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Interactive Hover Telemetry or Summary */}
            <div className="pt-3 flex items-center justify-between text-xs">
              {selectedDayHover ? (
                <div className="flex items-center gap-3 font-semibold text-[#0F172A] animate-in fade-in">
                  <span className="font-bold text-[#176B63]">{selectedDayHover.day}:</span>
                  <span>Created: <strong className="text-[#176B63]">{selectedDayHover.created}</strong></span>
                  <span>•</span>
                  <span>Resolved: <strong className="text-[#2563EB]">{selectedDayHover.resolved}</strong></span>
                </div>
              ) : (
                <span className="text-[11px] text-[#64748B]">
                  Hover over bars to inspect daily throughput metrics. Click any day to view matching tickets.
                </span>
              )}
              {onNavigateTab && (
                <button
                  onClick={() => onNavigateTab("analytics")}
                  className="text-xs font-bold text-[#176B63] hover:text-[#10574F] flex items-center gap-1 cursor-pointer"
                >
                  <span>Detailed Trends</span>
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Department Workload Distribution (Interactive 5 Canonical Departments) */}
        <div className="bg-white rounded-2xl border border-[#CBD5E1] p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-bold text-[#0F172A]">Department Workload</h3>
                <p className="text-xs text-[#64748B]">Active tickets distributed across departments</p>
              </div>
              <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-[#E8F3F1] text-[#176B63] border border-[#99F6E4]">
                {department_workload.reduce((acc, curr) => acc + curr.count, 0)} Active
              </span>
            </div>

            {/* Department List */}
            <div className="space-y-2.5 pt-1">
              {department_workload.map((dept) => {
                const Icon = deptIcons[dept.department_id] || Wrench;
                const totalOpen = Math.max(1, kpis.total_open_tickets);
                const pct = Math.round((dept.count / totalOpen) * 100);

                return (
                  <div
                    key={dept.department_id}
                    onClick={() => onViewAllTickets("open", dept.department_id)}
                    role="button"
                    tabIndex={0}
                    className="p-2.5 rounded-xl border border-[#F1F5F9] hover:border-[#176B63] hover:bg-[#F8FAFC] transition-all cursor-pointer group"
                    title={`Click to filter all ${dept.department_name} tickets`}
                  >
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <div className="flex items-center gap-2">
                        <div className="p-1 rounded-md bg-[#E8F3F1] text-[#176B63] group-hover:bg-[#176B63] group-hover:text-white transition-colors">
                          <Icon className="h-3.5 w-3.5" />
                        </div>
                        <span className="font-bold text-[#0F172A]">
                          {dept.department_name}
                        </span>
                        {dept.code && (
                          <span className="text-[9px] font-mono px-1.5 py-0.2 bg-[#F1F5F9] text-[#64748B] rounded">
                            {dept.code}
                          </span>
                        )}
                      </div>
                      <span className="font-bold text-[#0F172A] tabular-nums flex items-center gap-1">
                        <span>{dept.count}</span>
                        <span className="text-[#64748B] font-normal text-[11px]">({pct}%)</span>
                        <ChevronRight className="h-3.5 w-3.5 text-[#94A3B8] group-hover:text-[#176B63] group-hover:translate-x-0.5 transition-all" />
                      </span>
                    </div>

                    <div className="w-full h-1.5 bg-[#F1F5F9] rounded-full overflow-hidden">
                      <div
                        style={{ width: `${pct}%` }}
                        className="h-full bg-[#176B63] rounded-full transition-all"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <button
            onClick={() => onViewAllTickets("open")}
            className="w-full mt-4 py-2 px-3 rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] hover:bg-[#E8F3F1] text-xs font-bold text-[#176B63] flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <span>View All Department Tickets</span>
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Lower Row: SLA Compliance by Department & Prioritized Overdue Tickets */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* SLA Adherence by Department */}
        <div className="bg-white rounded-2xl border border-[#CBD5E1] p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-bold text-[#0F172A]">SLA Adherence by Department</h3>
                <p className="text-xs text-[#64748B]">Percentage of tickets resolved within SLA target</p>
              </div>
              <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-[#EDF7F2] text-[#16805D] border border-[#A6E1CE]">
                Target 95%
              </span>
            </div>

            <div className="space-y-3 pt-1">
              {sla_by_department.map((item) => {
                const isHigh = item.compliance_rate >= 90;
                const isMid = item.compliance_rate >= 75 && item.compliance_rate < 90;
                const barColor = isHigh ? "bg-[#16805D]" : isMid ? "bg-[#B45309]" : "bg-[#DC2626]";
                const badgeColor = isHigh
                  ? "text-[#16805D] bg-[#EDF7F2] border-[#A6E1CE]"
                  : isMid
                  ? "text-[#B45309] bg-[#FEF3C7] border-[#FDE68A]"
                  : "text-[#DC2626] bg-[#FEF2F2] border-[#FECACA]";

                return (
                  <div
                    key={item.department_id}
                    onClick={() => onViewAllTickets("open", item.department_id)}
                    className="p-2 rounded-xl border border-[#F1F5F9] hover:border-[#CBD5E1] hover:bg-[#F8FAFC] transition-all cursor-pointer group"
                    title={`Click to view tickets for ${item.department_name}`}
                  >
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-bold text-[#0F172A]">
                        {item.department_name}
                      </span>
                      <span className={`text-[10px] font-black px-1.5 py-0.5 rounded border ${badgeColor} tabular-nums`}>
                        {item.compliance_rate}%
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-[#F1F5F9] rounded-full overflow-hidden">
                      <div
                        style={{ width: `${item.compliance_rate}%` }}
                        className={`h-full ${barColor} rounded-full transition-all`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {onNavigateTab && (
            <button
              onClick={() => onNavigateTab("sla")}
              className="w-full mt-4 py-2 px-3 rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] hover:bg-[#F1F5F9] text-xs font-bold text-[#0F172A] flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <ShieldCheck className="h-3.5 w-3.5 text-[#176B63]" />
              <span>Configure SLA & Escalation Rules</span>
            </button>
          )}
        </div>

        {/* Prioritized Overdue Tickets (Interactive List with 1-Click Triage) */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-[#CBD5E1] p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3.5">
              <div>
                <h3 className="text-sm font-bold text-[#0F172A] flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-[#DC2626]" />
                  <span>Prioritized Overdue Tickets</span>
                </h3>
                <p className="text-xs text-[#64748B]">Immediate supervisor triage and staff intervention required</p>
              </div>
              <span className="text-[11px] font-black text-[#991B1B] bg-[#FEF2F2] px-2.5 py-1 rounded-full border border-[#FECACA]">
                {priority_overdue.length} Breached SLA
              </span>
            </div>

            {priority_overdue.length === 0 ? (
              <div className="py-10 text-center text-xs text-[#64748B] bg-[#F8FAFC] rounded-2xl border border-dashed border-[#CBD5E1] my-2">
                <CheckCircle2 className="h-9 w-9 text-[#16805D] mx-auto mb-2" />
                <strong className="text-sm font-bold text-[#0F172A] block">Zero Breached Tickets</strong>
                <span>All departments are currently operating strictly within target SLA adherence.</span>
              </div>
            ) : (
              <div className="space-y-2.5">
                {priority_overdue.map((ticket) => (
                  <div
                    key={ticket.id}
                    onClick={() => onSelectTicket(ticket.id)}
                    className="p-3.5 rounded-xl border border-[#FECACA] bg-[#FEF2F2]/40 hover:bg-[#FEF2F2] cursor-pointer transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 group shadow-2xs"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-black text-xs text-[#DC2626]">
                          {ticket.ticket_number}
                        </span>
                        <span className="text-xs font-bold text-[#0F172A] group-hover:text-[#991B1B] transition-colors">
                          {ticket.title}
                        </span>
                      </div>
                      <div className="text-[11px] text-[#64748B] flex flex-wrap items-center gap-2 font-medium">
                        <span className="px-1.5 py-0.5 rounded bg-white border border-[#CBD5E1] font-bold text-[#0F172A]">
                          {ticket.room_number}
                        </span>
                        <span>•</span>
                        <span className="capitalize font-semibold text-[#334155]">{ticket.department_id}</span>
                        <span>•</span>
                        <span className="font-black text-[#DC2626] bg-[#FEE2E2] px-2 py-0.5 rounded border border-[#FCA5A5] tabular-nums">
                          {formatDurationHoursMinutes(ticket.minutes_overdue)} overdue
                          {ticket.sla_resolution_deadline && ` (${formatTime(ticket.sla_resolution_deadline)})`}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectTicket(ticket.id);
                        }}
                        className="px-3 py-1.5 rounded-xl bg-white hover:bg-[#F8FAFC] border border-[#CBD5E1] text-xs font-bold text-[#0F172A] shadow-2xs flex items-center gap-1 cursor-pointer"
                      >
                        <span>Triage & Assign</span>
                        <ArrowRight className="h-3 w-3 text-[#176B63]" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Bottom Bar: Direct Link to AI Verification */}
          <div className="pt-4 border-t border-[#F1F5F9] mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
            <span className="text-[#64748B]">
              AI Verification Queue: <strong className="text-[#6D28D9]">{kpis.pending_ai_verifications}</strong> pending evidence reviews
            </span>
            <button
              onClick={onViewAIVerification}
              className="font-bold text-[#176B63] hover:text-[#10574F] flex items-center gap-1 cursor-pointer"
            >
              <span>Open AI Verification Center</span>
              <ArrowUpRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
