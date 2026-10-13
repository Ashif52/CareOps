"use client";

import React from "react";
import {
  Inbox,
  Clock,
  AlertOctagon,
  Percent,
  Timer,
  Sparkles,
  ArrowUpRight,
  ArrowDownRight,
  TrendingUp,
  CheckCircle2,
  AlertTriangle,
  ChevronRight,
  Wrench,
  Stethoscope,
  HeartPulse,
  Sparkle,
  Receipt,
  Pill
} from "lucide-react";
import { DashboardMetrics, Ticket } from "@/lib/api";

interface OverviewDashboardProps {
  metrics: DashboardMetrics | null;
  onSelectTicket: (ticketId: number) => void;
  onViewAllTickets: () => void;
  onViewAIVerification: () => void;
}

export function OverviewDashboard({
  metrics,
  onSelectTicket,
  onViewAllTickets,
  onViewAIVerification,
}: OverviewDashboardProps) {
  if (!metrics) {
    return (
      <div className="p-8 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#176B63]" />
      </div>
    );
  }

  const { kpis, department_workload, sla_by_department, volume_trends, priority_overdue } = metrics;

  const kpiCards = [
    {
      title: "Total Open Tickets",
      value: kpis.total_open_tickets,
      sub: "Active across 6 departments",
      icon: Inbox,
      color: "text-[#17212F]",
      border: "border-[#E5E9EF]",
      badge: "In Progress",
      badgeColor: "bg-[#F1F4F9] text-[#17212F]",
    },
    {
      title: "Tickets Due Soon",
      value: kpis.tickets_due_soon,
      sub: "Within next 60 minutes",
      icon: Clock,
      color: "text-[#B7791F]",
      border: "border-[#FAD7A0]",
      badge: "Warning",
      badgeColor: "bg-[#FEF7EC] text-[#B7791F]",
    },
    {
      title: "Overdue Tickets",
      value: kpis.overdue_tickets,
      sub: "Escalated to supervisors",
      icon: AlertOctagon,
      color: "text-[#C43D4B]",
      border: "border-[#F8D7DA]",
      badge: "Action Required",
      badgeColor: "bg-[#FDF2F2] text-[#C43D4B]",
    },
    {
      title: "SLA Compliance",
      value: `${kpis.sla_compliance_rate}%`,
      sub: "Target: 95.0% adherence",
      icon: Percent,
      color: "text-[#16805D]",
      border: "border-[#A6E1CE]",
      badge: "Live Metric",
      badgeColor: "bg-[#EDF7F2] text-[#16805D]",
    },
    {
      title: "Avg Resolution Time",
      value: `${kpis.avg_resolution_time_minutes}m`,
      sub: "Average time to resolution",
      icon: Timer,
      color: "text-[#3868C9]",
      border: "border-[#BFDBFE]",
      badge: "Historical",
      badgeColor: "bg-[#EEF4FD] text-[#3868C9]",
    },
    {
      title: "Pending AI Verifications",
      value: kpis.pending_ai_verifications,
      sub: "Media evidence review required",
      icon: Sparkles,
      color: "text-[#176B63]",
      border: "border-[#A7D7D1]",
      badge: "Review Queue",
      badgeColor: "bg-[#E8F3F1] text-[#176B63]",
    },
  ];

  const deptIcons: Record<string, any> = {
    maintenance: Wrench,
    doctors: Stethoscope,
    nursing: HeartPulse,
    housekeeping: Sparkle,
    billing: Receipt,
    pharmacy: Pill,
  };

  return (
    <div className="p-5 sm:p-6 space-y-5 max-w-7xl mx-auto">
      {/* 6 KPI Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3.5">
        {kpiCards.map((kpi, idx) => {
          const Icon = kpi.icon;
          return (
            <div
              key={idx}
              className={`bg-white rounded-xl p-3.5 border ${kpi.border} shadow-2xs flex flex-col justify-between hover:shadow-sm transition-all`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#64748B] truncate">
                  {kpi.title}
                </span>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${kpi.badgeColor}`}>
                  {kpi.badge}
                </span>
              </div>
              <div className="my-2 flex items-baseline justify-between">
                <span className={`text-2xl font-black tracking-tight tabular-nums ${kpi.color}`}>
                  {kpi.value}
                </span>
                <div className="p-1.5 rounded-lg bg-[#F8FAFC]">
                  <Icon className={`h-4 w-4 ${kpi.color}`} />
                </div>
              </div>
              <div className="text-[11px] text-[#64748B] truncate font-medium">
                {kpi.sub}
              </div>
            </div>
          );
        })}
      </div>

      {/* Main Grid: Charts & Operations */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Ticket Volume Trends */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-[#E5E9EF] p-5 shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-[#17212F]">Ticket Volume Trends</h3>
              <p className="text-xs text-[#667085]">Daily submitted vs resolved hospital tickets</p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1.5 text-[#176B63] font-medium">
                <span className="h-2 w-2 rounded-full bg-[#176B63]" /> Created
              </span>
              <span className="flex items-center gap-1.5 text-[#3868C9] font-medium">
                <span className="h-2 w-2 rounded-full bg-[#3868C9]" /> Resolved
              </span>
            </div>
          </div>

          {/* Bar Chart Representation */}
          <div className="h-56 flex items-end justify-between gap-3 pt-6 px-2">
            {volume_trends.map((item, idx) => {
              const maxVal = 32;
              const createdH = Math.min(100, Math.round((item.created / maxVal) * 100));
              const resolvedH = Math.min(100, Math.round((item.resolved / maxVal) * 100));
              return (
                <div key={idx} className="flex-1 flex flex-col items-center gap-2 group">
                  <div className="w-full flex items-end justify-center gap-1.5 h-40">
                    <div
                      style={{ height: `${createdH}%` }}
                      className="w-3.5 bg-[#176B63] rounded-t transition-all group-hover:opacity-90 relative"
                      title={`Created: ${item.created}`}
                    />
                    <div
                      style={{ height: `${resolvedH}%` }}
                      className="w-3.5 bg-[#3868C9] rounded-t transition-all group-hover:opacity-90 relative"
                      title={`Resolved: ${item.resolved}`}
                    />
                  </div>
                  <span className="text-[11px] font-medium text-[#667085]">{item.day}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Department Workload Distribution */}
        <div className="bg-white rounded-xl border border-[#E5E9EF] p-5 shadow-[0_1px_3px_rgba(0,0,0,0.02)] flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-semibold text-[#17212F]">Department Workload</h3>
            <p className="text-xs text-[#667085] mb-4">Active open tickets by department</p>
            <div className="space-y-3">
              {department_workload.map((dept) => {
                const Icon = deptIcons[dept.department_id] || Wrench;
                const totalOpen = Math.max(1, kpis.total_open_tickets);
                const pct = Math.round((dept.count / totalOpen) * 100);
                return (
                  <div key={dept.department_id} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <Icon className="h-3.5 w-3.5 text-[#176B63]" />
                        <span className="font-medium text-[#17212F] truncate max-w-[140px]">
                          {dept.department_name}
                        </span>
                      </div>
                      <span className="font-semibold text-[#17212F] tabular-nums">
                        {dept.count} <span className="text-[#667085] font-normal">({pct}%)</span>
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-[#F1F4F9] rounded-full overflow-hidden">
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
            onClick={onViewAllTickets}
            className="w-full mt-4 py-2 px-3 rounded-lg border border-[#E5E9EF] bg-[#F7F8FA] hover:bg-[#E8F3F1] text-xs font-semibold text-[#176B63] flex items-center justify-center gap-1.5 transition-colors"
          >
            <span>View All Tickets</span>
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Lower Row: SLA Compliance by Dept & Overdue Tickets */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* SLA Compliance by Department */}
        <div className="bg-white rounded-xl border border-[#E5E9EF] p-5 shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
          <h3 className="text-sm font-semibold text-[#17212F]">SLA Adherence by Department</h3>
          <p className="text-xs text-[#667085] mb-4">Percentage of tickets resolved within deadline</p>
          <div className="space-y-3">
            {sla_by_department.map((item) => {
              const isHigh = item.compliance_rate >= 90;
              const isMid = item.compliance_rate >= 75 && item.compliance_rate < 90;
              const barColor = isHigh ? "bg-[#16805D]" : isMid ? "bg-[#B7791F]" : "bg-[#C43D4B]";
              const badgeColor = isHigh
                ? "text-[#16805D] bg-[#EDF7F2]"
                : isMid
                ? "text-[#B7791F] bg-[#FEF7EC]"
                : "text-[#C43D4B] bg-[#FDF2F2]";

              return (
                <div key={item.department_id} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-[#17212F] truncate max-w-[160px]">
                      {item.department_name}
                    </span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${badgeColor} tabular-nums`}>
                      {item.compliance_rate}%
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-[#F1F4F9] rounded-full overflow-hidden">
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

        {/* Priority Overdue List */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-[#E5E9EF] p-5 shadow-[0_1px_3px_rgba(0,0,0,0.02)] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-semibold text-[#17212F] flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-[#C43D4B]" />
                  <span>Prioritized Overdue Tickets</span>
                </h3>
                <p className="text-xs text-[#667085]">Tickets requiring immediate supervisor intervention</p>
              </div>
              <span className="text-[11px] font-semibold text-[#C43D4B] bg-[#FDF2F2] px-2 py-0.5 rounded-full border border-[#F8D7DA]">
                {priority_overdue.length} Breached
              </span>
            </div>

            {priority_overdue.length === 0 ? (
              <div className="py-8 text-center text-xs text-[#667085]">
                <CheckCircle2 className="h-8 w-8 text-[#16805D] mx-auto mb-2" />
                <span>Zero overdue tickets. All departments operating within target SLA.</span>
              </div>
            ) : (
              <div className="space-y-2">
                {priority_overdue.map((ticket) => (
                  <div
                    key={ticket.id}
                    onClick={() => onSelectTicket(ticket.id)}
                    className="p-3 rounded-lg border border-[#F8D7DA] bg-[#FFFBFB] hover:bg-[#FDF2F2] cursor-pointer transition-colors flex items-center justify-between"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-[#C43D4B] tabular-nums">
                          {ticket.ticket_number}
                        </span>
                        <span className="text-xs font-semibold text-[#17212F]">
                          {ticket.title}
                        </span>
                      </div>
                      <div className="text-[11px] text-[#667085] flex items-center gap-2">
                        <span>{ticket.room_number}</span>
                        <span>•</span>
                        <span className="capitalize">{ticket.department_id}</span>
                        <span>•</span>
                        <span className="font-semibold text-[#C43D4B]">
                          {ticket.minutes_overdue}m overdue
                        </span>
                      </div>
                    </div>

                    <button className="px-2.5 py-1 rounded bg-white border border-[#E5E9EF] text-xs font-semibold text-[#17212F] hover:bg-[#F7F8FA] shrink-0">
                      Triage
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-[#E5E9EF] flex items-center justify-between">
            <span className="text-xs text-[#667085]">
              AI Verification Queue: <strong className="text-[#176B63]">{kpis.pending_ai_verifications}</strong> pending review
            </span>
            <button
              onClick={onViewAIVerification}
              className="text-xs font-semibold text-[#176B63] hover:underline flex items-center gap-1"
            >
              <span>Go to AI Verification Center</span>
              <ArrowUpRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
