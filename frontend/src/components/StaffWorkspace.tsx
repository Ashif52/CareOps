"use client";

import React, { useState } from "react";
import {
  Briefcase,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Play,
  Upload,
  ArrowRight,
  Flame,
  Check,
  RotateCcw,
  Sparkles,
  UserCheck,
  Loader2
} from "lucide-react";
import { Ticket, User } from "@/lib/api";

interface StaffWorkspaceProps {
  tickets: Ticket[];
  currentUser: User | null;
  onSelectTicket: (ticketId: number) => void;
  onAcknowledge: (ticketId: number) => void;
  onStartWork: (ticketId: number) => void;
}

export function StaffWorkspace({
  tickets,
  currentUser,
  onSelectTicket,
  onAcknowledge,
  onStartWork,
}: StaffWorkspaceProps) {
  const [filterTab, setFilterTab] = useState<
    "all" | "unacknowledged" | "due_soon" | "in_progress" | "overdue" | "awaiting_verification" | "completed"
  >("all");
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);

  const myTickets = tickets.filter(
    (t) => !currentUser?.department_id || t.department_id === currentUser.department_id || t.assigned_staff_id === currentUser?.id
  );

  const filteredTickets = myTickets.filter((t) => {
    const now = Date.now();
    const resDl = t.sla_resolution_deadline ? new Date(t.sla_resolution_deadline).getTime() : null;

    if (filterTab === "unacknowledged") return t.status === "assigned" || t.status === "submitted";
    if (filterTab === "in_progress") return t.status === "in_progress";
    if (filterTab === "due_soon") {
      if (!resDl || t.status === "closed") return false;
      return resDl > now && resDl - now <= 60 * 60 * 1000;
    }
    if (filterTab === "overdue") {
      if (!resDl || t.status === "closed") return false;
      return resDl < now;
    }
    if (filterTab === "awaiting_verification") return t.status === "resolution_submitted";
    if (filterTab === "completed") return t.status === "closed";
    return true;
  });

  const getSLABadge = (ticket: Ticket) => {
    if (ticket.status === "closed") {
      return (
        <span className="text-xs font-bold text-[#16805D] bg-[#EDF7F2] border border-[#A6E1CE] px-2.5 py-1 rounded-md">
          Completed
        </span>
      );
    }
    if (!ticket.sla_resolution_deadline) return null;

    const dl = new Date(ticket.sla_resolution_deadline).getTime();
    const now = Date.now();
    const diffMins = Math.round((dl - now) / 60000);

    if (diffMins < 0) {
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-black text-[#991B1B] bg-[#FEE2E2] border border-[#FCA5A5] px-2.5 py-1 rounded-md tabular-nums">
          <Flame className="h-3.5 w-3.5" />
          <span>{Math.abs(diffMins)}m Overdue</span>
        </span>
      );
    } else if (diffMins <= 30) {
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-black text-[#92400E] bg-[#FEF3C7] border border-[#FCD34D] px-2.5 py-1 rounded-md tabular-nums">
          <Clock className="h-3.5 w-3.5" />
          <span>{diffMins}m Remaining</span>
        </span>
      );
    } else {
      const hours = Math.floor(diffMins / 60);
      const mins = diffMins % 60;
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#0D9488] bg-[#E8F3F1] border border-[#99F6E4] px-2.5 py-1 rounded-md tabular-nums">
          <Clock className="h-3.5 w-3.5" />
          <span>{hours > 0 ? `${hours}h ${mins}m` : `${mins}m`}</span>
        </span>
      );
    }
  };

  return (
    <div className="p-5 sm:p-6 space-y-5 max-w-7xl mx-auto">
      {/* Workspace Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-[#176B63] text-white shadow-sm">
              <Briefcase className="h-5 w-5" />
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-[#0F172A] tracking-tight">
              Staff Operational Workspace
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-[#475569] mt-0.5 font-medium">
            Logged in as <strong className="text-[#0F172A]">{currentUser?.name}</strong> (
            <span className="capitalize">{currentUser?.role}</span> • {currentUser?.department_id || "All Facilities"})
          </p>
        </div>

        {/* Live SSE Status Badge */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#EDF7F2] border border-[#A6E1CE] text-[#16805D] text-[11px] font-bold shadow-xs">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#16805D] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#16805D]"></span>
            </span>
            <span>Real-Time SSE Connected</span>
          </div>
        </div>
      </div>

      {/* Unacknowledged Complaint Alert Banner */}
      {myTickets.some((t) => t.status === "assigned" || t.status === "submitted") && (
        <div className="p-3.5 rounded-xl bg-gradient-to-r from-[#FEF2F2] to-[#FFF1F2] border border-[#FCA5A5] flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs animate-in fade-in duration-200">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-[#EF4444] text-white shrink-0">
              <AlertTriangle className="h-4.5 w-4.5" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-[#991B1B]">
                {myTickets.filter((t) => t.status === "assigned" || t.status === "submitted").length} Unacknowledged Patient Complaint(s)
              </h3>
              <p className="text-[11px] text-[#7F1D1D]">
                Immediate attention required. Acknowledge tickets to notify patients that staff is en route.
              </p>
            </div>
          </div>
          <button
            onClick={() => setFilterTab("unacknowledged")}
            className="px-3.5 py-1.5 rounded-lg bg-[#DC2626] hover:bg-[#B91C1C] text-white text-xs font-bold transition-all shadow-sm cursor-pointer whitespace-nowrap self-start sm:self-auto"
          >
            View Unacknowledged Queue →
          </button>
        </div>
      )}

      {/* Triage Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2 border-b border-[#CBD5E1] text-xs font-bold">
        {[
          { id: "all", label: "My Assigned", count: myTickets.length },
          { id: "unacknowledged", label: "Unacknowledged", count: myTickets.filter((t) => t.status === "assigned" || t.status === "submitted").length },
          { id: "in_progress", label: "In Progress", count: myTickets.filter((t) => t.status === "in_progress").length },
          { id: "due_soon", label: "Due Soon (<60m)", count: myTickets.filter((t) => t.sla_resolution_deadline && new Date(t.sla_resolution_deadline).getTime() > Date.now() && new Date(t.sla_resolution_deadline).getTime() - Date.now() <= 3600000).length },
          { id: "overdue", label: "Overdue", count: myTickets.filter((t) => t.sla_resolution_deadline && new Date(t.sla_resolution_deadline).getTime() < Date.now() && t.status !== "closed").length },
          { id: "awaiting_verification", label: "Awaiting Verification", count: myTickets.filter((t) => t.status === "resolution_submitted").length },
          { id: "completed", label: "Completed", count: myTickets.filter((t) => t.status === "closed").length },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setFilterTab(tab.id as any)}
            className={`px-3 py-1.5 rounded-lg transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer text-xs ${
              filterTab === tab.id
                ? "bg-[#176B63] text-white shadow-sm"
                : "bg-white border border-[#CBD5E1] text-[#334155] hover:text-[#0F172A] hover:bg-[#F8FAFC]"
            }`}
          >
            <span>{tab.label}</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                filterTab === tab.id ? "bg-white/20 text-white" : "bg-[#F1F5F9] text-[#0F172A]"
              }`}
            >
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Ticket Action Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredTickets.length === 0 ? (
          <div className="col-span-full py-14 text-center text-xs text-[#475569] bg-white rounded-xl border border-[#CBD5E1] shadow-2xs">
            <CheckCircle2 className="h-8 w-8 text-[#16805D] mx-auto mb-2" />
            <span className="font-extrabold text-sm text-[#0F172A] block">Zero items in this queue</span>
            <span>All tasks up to date for this operational filter.</span>
          </div>
        ) : (
          filteredTickets.map((ticket) => {
            const hasBefore = ticket.evidences?.some((e) => e.stage === "before");
            const hasAfter = ticket.evidences?.some((e) => e.stage === "after");

            return (
              <div
                key={ticket.id}
                onClick={() => onSelectTicket(ticket.id)}
                className="bg-white rounded-xl border border-[#CBD5E1] hover:border-[#176B63] p-4.5 shadow-2xs hover:shadow-md transition-all cursor-pointer flex flex-col justify-between space-y-3.5 group"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-black text-sm sm:text-base text-[#176B63] tabular-nums">
                      {ticket.ticket_number}
                    </span>
                    {getSLABadge(ticket)}
                  </div>

                  <div>
                    <h3 className="font-bold text-base text-[#0F172A] group-hover:text-[#176B63] transition-colors line-clamp-1">
                      {ticket.title}
                    </h3>
                    <p className="text-sm text-[#475569] line-clamp-2 mt-1 font-medium">
                      {ticket.description}
                    </p>
                  </div>

                  <div className="flex items-center justify-between text-sm text-[#334155] pt-3 border-t border-[#F1F5F9] font-bold">
                    <span className="text-[#0F172A]">{ticket.room_number}</span>
                    <span className="capitalize">{ticket.category}</span>
                  </div>

                  {/* Evidence Checklist Indicators */}
                  <div className="flex items-center gap-2 text-xs pt-1">
                    <span
                      className={`px-2.5 py-1 rounded-md font-bold flex items-center gap-1.5 ${
                        hasBefore ? "bg-[#EDF7F2] text-[#16805D] border border-[#A6E1CE]" : "bg-[#FEF7EC] text-[#B7791F] border border-[#FAD7A0]"
                      }`}
                    >
                      {hasBefore ? "✓ Before Media" : "○ Need Before"}
                    </span>
                    <span
                      className={`px-2.5 py-1 rounded-md font-bold flex items-center gap-1.5 ${
                        hasAfter ? "bg-[#EDF7F2] text-[#16805D] border border-[#A6E1CE]" : "bg-[#F1F5F9] text-[#64748B] border border-[#CBD5E1]"
                      }`}
                    >
                      {hasAfter ? "✓ After Media" : "○ Need After"}
                    </span>
                  </div>
                </div>

                {/* Primary Action Button */}
                <div className="pt-2">
                  {ticket.status === "assigned" || ticket.status === "submitted" ? (
                    <button
                      disabled={actionLoadingId === ticket.id}
                      onClick={async (e) => {
                        e.stopPropagation();
                        setActionLoadingId(ticket.id);
                        try {
                          await onAcknowledge(ticket.id);
                        } finally {
                          setActionLoadingId(null);
                        }
                      }}
                      className="w-full py-3 rounded-2xl bg-[#176B63] hover:bg-[#10574F] text-white text-sm font-bold shadow-md shadow-[#176B63]/25 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                    >
                      {actionLoadingId === ticket.id ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span>Acknowledging Receipt...</span>
                        </>
                      ) : (
                        <>
                          <span>1. Acknowledge Receipt</span>
                          <ArrowRight className="h-4 w-4" />
                        </>
                      )}
                    </button>
                  ) : ticket.status === "acknowledged" ? (
                    <button
                      disabled={actionLoadingId === ticket.id}
                      onClick={async (e) => {
                        e.stopPropagation();
                        setActionLoadingId(ticket.id);
                        try {
                          await onStartWork(ticket.id);
                        } finally {
                          setActionLoadingId(null);
                        }
                      }}
                      className="w-full py-3 rounded-2xl bg-[#3868C9] hover:bg-[#2A52A3] text-white text-sm font-bold shadow-md shadow-[#3868C9]/25 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                    >
                      {actionLoadingId === ticket.id ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span>Starting Repair...</span>
                        </>
                      ) : (
                        <>
                          <span>2. Start Repair Work</span>
                          <ArrowRight className="h-4 w-4" />
                        </>
                      )}
                    </button>
                  ) : ticket.status === "in_progress" ? (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectTicket(ticket.id);
                      }}
                      className="w-full py-3 rounded-2xl bg-[#16805D] hover:bg-[#116348] text-white text-sm font-bold shadow-md shadow-[#16805D]/25 flex items-center justify-center gap-2 transition-all cursor-pointer"
                    >
                      <span>3. Submit Resolution & Evidence</span>
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  ) : (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectTicket(ticket.id);
                      }}
                      className="w-full py-3 rounded-2xl border-2 border-[#CBD5E1] bg-[#F8FAFC] hover:bg-[#E2E8F0] text-sm font-bold text-[#0F172A] flex items-center justify-center gap-2 transition-all cursor-pointer"
                    >
                      <span>View Details</span>
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
