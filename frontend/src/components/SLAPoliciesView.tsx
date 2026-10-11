"use client";

import React, { useState } from "react";
import {
  Clock,
  AlertTriangle,
  Play,
  CheckCircle2,
  Bell,
  ShieldAlert,
  Flame,
  ArrowRight,
  RefreshCw
} from "lucide-react";
import { SLAPolicy, EscalationLog } from "@/lib/api";

interface SLAPoliciesViewProps {
  policies: SLAPolicy[];
  escalations: EscalationLog[];
  onRunSLACheck: () => void;
  isRunningCheck?: boolean;
  onSelectTicket: (ticketId: number) => void;
}

export function SLAPoliciesView({
  policies,
  escalations,
  onRunSLACheck,
  isRunningCheck = false,
  onSelectTicket,
}: SLAPoliciesViewProps) {
  return (
    <div className="p-8 sm:p-10 space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-[#176B63] text-white shadow-md shadow-[#176B63]/20">
              <Clock className="h-6 w-6" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-[#0F172A] tracking-tight">
              SLA Policies & Escalation Engine
            </h1>
          </div>
          <p className="text-sm sm:text-base text-[#475569] mt-1 font-medium">
            Configurable hospital operational response targets & automated supervisor escalation
          </p>
        </div>

        <button
          onClick={onRunSLACheck}
          disabled={isRunningCheck}
          className="px-5 py-2.5 rounded-2xl bg-[#176B63] hover:bg-[#10574F] text-white text-sm font-bold shadow-md shadow-[#176B63]/25 flex items-center gap-2.5 transition-all disabled:opacity-50 cursor-pointer"
        >
          <RefreshCw className={`h-4 w-4 ${isRunningCheck ? "animate-spin" : ""}`} />
          <span>{isRunningCheck ? "Scanning Tickets..." : "Run SLA Scan Cycle Now"}</span>
        </button>
      </div>

      {/* SLA Policy Table */}
      <div className="bg-white rounded-3xl border-2 border-[#94A3B8] shadow-lg overflow-hidden space-y-0">
        <div className="p-6 sm:p-7 border-b-2 border-[#CBD5E1] flex items-center justify-between bg-[#F8FAFC]">
          <div>
            <h3 className="font-black text-xl sm:text-2xl text-[#0F172A]">Active SLA Target Matrix</h3>
            <p className="text-sm sm:text-base text-[#334155] font-semibold mt-1">
              Response and resolution deadlines enforced by persistent background worker
            </p>
          </div>
          <span className="text-sm sm:text-base font-black text-[#0D9488] bg-[#E8F3F1] px-4 py-1.5 rounded-full border-2 border-[#99F6E4] shadow-xs">
            {policies.length} Active Policies
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#E2E8F0] border-b-2 border-[#94A3B8] text-sm sm:text-base font-black text-[#0F172A] uppercase tracking-wider">
                <th className="py-4.5 px-6">Department</th>
                <th className="py-4.5 px-6">Priority</th>
                <th className="py-4.5 px-6">Ack Target</th>
                <th className="py-4.5 px-6">Resolution Target</th>
                <th className="py-4.5 px-6">Reminders</th>
                <th className="py-4.5 px-6">Escalation Trigger</th>
                <th className="py-4.5 px-6">Closure Policy</th>
              </tr>
            </thead>
            <tbody className="divide-y-2 divide-[#E2E8F0]">
              {policies.map((p) => {
                const hoursFormatted =
                  p.resolution_target_minutes >= 60
                    ? ` (${
                        p.resolution_target_minutes % 60 === 0
                          ? p.resolution_target_minutes / 60
                          : (p.resolution_target_minutes / 60).toFixed(1)
                      }h)`
                    : "";

                return (
                  <tr key={p.id} className="hover:bg-[#F1F5F9] transition-colors">
                    <td className="py-5 px-6 font-black text-base sm:text-lg text-[#0F172A] capitalize">
                      {p.department_id}
                    </td>
                    <td className="py-5 px-6">
                      <span
                        className={`text-xs sm:text-sm font-black uppercase tracking-wider px-3 py-1.5 rounded-lg border-2 shadow-xs ${
                          p.priority === "critical"
                            ? "bg-[#FEE2E2] text-[#991B1B] border-[#EF4444]"
                            : p.priority === "high"
                            ? "bg-[#FEF3C7] text-[#92400E] border-[#F59E0B]"
                            : "bg-[#E0E7FF] text-[#3730A3] border-[#6366F1]"
                        }`}
                      >
                        {p.priority}
                      </span>
                    </td>
                    <td className="py-5 px-6 font-black tabular-nums text-base sm:text-lg text-[#0F172A]">
                      {p.ack_target_minutes} mins
                    </td>
                    <td className="py-5 px-6 font-black tabular-nums text-base sm:text-lg text-[#0F766E]">
                      {p.resolution_target_minutes} mins{hoursFormatted}
                    </td>
                    <td className="py-5 px-6 text-[#1E293B] font-bold text-sm sm:text-base tabular-nums">
                      T-{p.reminder_1_minutes_before}m & T-{p.reminder_2_minutes_before}m
                    </td>
                    <td className="py-5 px-6 text-[#DC2626] font-extrabold text-sm sm:text-base">
                      At deadline breach (Level {p.priority === "critical" ? "2" : "1"})
                    </td>
                    <td className="py-5 px-6">
                      <span className="text-xs sm:text-sm text-[#0F766E] bg-[#E6FFFA] border-2 border-[#5EEAD4] px-3.5 py-1.5 rounded-xl font-black inline-block whitespace-nowrap shadow-xs">
                        Supervisor Approval Required
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Escalation Breach History */}
      <div className="bg-white rounded-3xl border-2 border-[#94A3B8] shadow-lg overflow-hidden">
        <div className="p-6 sm:p-7 border-b-2 border-[#CBD5E1] flex items-center justify-between bg-[#F8FAFC]">
          <div>
            <h3 className="font-black text-xl sm:text-2xl text-[#0F172A] flex items-center gap-3">
              <ShieldAlert className="h-6 w-6 text-[#DC2626]" />
              <span>Escalation Breach Ledger</span>
            </h3>
            <p className="text-sm sm:text-base text-[#334155] font-semibold mt-1">
              Real-time audit record of tickets that exceeded configured targets
            </p>
          </div>
          <span className="text-sm sm:text-base font-black text-[#B91C1C] bg-[#FEE2E2] px-4 py-1.5 rounded-full border-2 border-[#FCA5A5] shadow-xs">
            {escalations.length} Breach Incidents
          </span>
        </div>

        <div className="divide-y-2 divide-[#E2E8F0]">
          {escalations.length === 0 ? (
            <div className="p-12 text-center text-[#334155]">
              <CheckCircle2 className="h-10 w-10 text-[#16805D] mx-auto mb-3" />
              <span className="text-base font-bold">No active escalation breaches logged. All tickets operating on schedule.</span>
            </div>
          ) : (
            escalations.map((esc) => (
              <div
                key={esc.id}
                onClick={() => onSelectTicket(esc.ticket_id)}
                className="p-6 hover:bg-[#FFF5F5] cursor-pointer transition-colors flex flex-col md:flex-row md:items-center justify-between gap-5"
              >
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="font-black text-base sm:text-lg text-[#DC2626] tabular-nums">
                      {esc.ticket_number}
                    </span>
                    <span className="font-black text-base sm:text-lg text-[#0F172A]">{esc.ticket_title}</span>
                    <span className="text-xs sm:text-sm font-black px-3 py-1 rounded-lg bg-[#FEE2E2] text-[#991B1B] border-2 border-[#FCA5A5]">
                      Level {esc.escalation_level} Breach
                    </span>
                  </div>
                  <p className="text-[#1E293B] text-sm sm:text-base font-bold">{esc.trigger_reason}</p>
                  <div className="text-sm sm:text-base text-[#334155] font-semibold flex flex-wrap items-center gap-3">
                    <span>Location: <strong className="text-[#0F172A] font-black">{esc.room_number}</strong></span>
                    <span>•</span>
                    <span>Supervisor: <strong className="text-[#0F172A] font-black">{esc.notified_supervisor}</strong></span>
                    <span>•</span>
                    <span className="text-[#16805D] font-black">Status: {esc.delivery_status}</span>
                  </div>
                </div>

                <button className="px-5 py-2.5 rounded-2xl border-2 border-[#94A3B8] bg-white hover:bg-[#F8FAFC] hover:border-[#64748B] font-black text-sm sm:text-base text-[#0F172A] shrink-0 flex items-center gap-2 shadow-sm cursor-pointer self-start md:self-auto">
                  <span>Inspect</span>
                  <ArrowRight className="h-5 w-5" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
