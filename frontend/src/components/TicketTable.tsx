"use client";

import React, { useState, useMemo } from "react";
import {
  Search,
  Filter,
  ArrowUpDown,
  AlertCircle,
  Clock,
  Sparkles,
  ChevronRight,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  Flame,
  User,
  ShieldAlert
} from "lucide-react";
import { Ticket, Department, type User as UserType, parseUtcDate } from "@/lib/api";

interface TicketTableProps {
  tickets: Ticket[];
  departments: Department[];
  currentUser?: UserType | null;
  onSelectTicket: (ticketId: number) => void;
  onOpenCreateModal: () => void;
  initialDeptFilter?: string;
  initialStatusFilter?: string;
  initialSlaFilter?: string;
}

export function TicketTable({
  tickets,
  departments,
  currentUser,
  onSelectTicket,
  onOpenCreateModal,
  initialDeptFilter,
  initialStatusFilter,
  initialSlaFilter,
}: TicketTableProps) {
  const isStaff = currentUser?.role === "staff";
  const staffDept = currentUser?.department_id;

  const [searchTerm, setSearchTerm] = useState("");
  const [deptFilter, setDeptFilter] = useState(initialDeptFilter || (isStaff && staffDept ? staffDept : "all"));
  const [statusFilter, setStatusFilter] = useState(initialStatusFilter || "all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [slaFilter, setSlaFilter] = useState(initialSlaFilter || "all"); // "all", "overdue", "due_soon"

  React.useEffect(() => {
    if (initialDeptFilter !== undefined) setDeptFilter(initialDeptFilter);
    if (initialStatusFilter !== undefined) setStatusFilter(initialStatusFilter);
    if (initialSlaFilter !== undefined) setSlaFilter(initialSlaFilter);
  }, [initialDeptFilter, initialStatusFilter, initialSlaFilter]);

  const filteredTickets = useMemo(() => {
    return tickets.filter((t) => {
      // Search
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const matches =
          t.ticket_number.toLowerCase().includes(term) ||
          t.title.toLowerCase().includes(term) ||
          t.room_number.toLowerCase().includes(term) ||
          (t.category && t.category.toLowerCase().includes(term));
        if (!matches) return false;
      }

      // Dept
      if (deptFilter !== "all" && t.department_id !== deptFilter) return false;

      // Status
      if (statusFilter === "open") {
        if (t.status === "closed") return false;
      } else if (statusFilter !== "all" && t.status !== statusFilter) {
        return false;
      }

      // Priority
      if (priorityFilter !== "all" && t.priority !== priorityFilter) return false;

      // SLA
      if (slaFilter === "overdue") {
        if (!t.sla_resolution_deadline || t.status === "closed") return false;
        const dl = new Date(t.sla_resolution_deadline).getTime();
        if (Date.now() <= dl) return false;
      } else if (slaFilter === "due_soon") {
        if (!t.sla_resolution_deadline || t.status === "closed") return false;
        const dl = new Date(t.sla_resolution_deadline).getTime();
        const now = Date.now();
        if (now > dl || dl > now + 60 * 60 * 1000) return false;
      }

      return true;
    });
  }, [tickets, searchTerm, deptFilter, statusFilter, priorityFilter, slaFilter]);

  // Formatter for SLA time remaining
  const renderSLATimeRemaining = (ticket: Ticket) => {
    if (ticket.status === "closed") {
      return (
        <span className="text-[11px] text-[#16805D] bg-[#EDF7F2] px-2 py-0.5 rounded font-medium">
          Resolved
        </span>
      );
    }
    if (!ticket.sla_resolution_deadline) {
      return <span className="text-[11px] text-[#98A2B3]">—</span>;
    }

    const parsed = parseUtcDate(ticket.sla_resolution_deadline);
    if (!parsed) return <span className="text-[11px] text-[#98A2B3]">—</span>;
    const dl = parsed.getTime();
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
          <span>{diffMins}m left</span>
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

  const getPriorityBadge = (priority: string) => {
    const config: Record<string, { label: string; style: string }> = {
      critical: { label: "Critical", style: "bg-[#FEE2E2] text-[#991B1B] border border-[#FCA5A5]" },
      high: { label: "High", style: "bg-[#FEF3C7] text-[#92400E] border border-[#FCD34D]" },
      medium: { label: "Medium", style: "bg-[#E0E7FF] text-[#3730A3] border border-[#C7D2FE]" },
      low: { label: "Low", style: "bg-[#F1F5F9] text-[#334155] border border-[#CBD5E1]" },
    };
    const c = config[priority] || config.medium;
    return (
      <span className={`text-xs uppercase font-black tracking-wider px-2.5 py-1 rounded-md ${c.style}`}>
        {c.label}
      </span>
    );
  };

  const getStatusBadge = (status: string, isEscalated: boolean) => {
    if (isEscalated && status !== "closed") {
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-black text-[#991B1B] bg-[#FEE2E2] border border-[#FCA5A5] px-2.5 py-1 rounded-md">
          <ShieldAlert className="h-3.5 w-3.5" />
          <span>Escalated</span>
        </span>
      );
    }

    const map: Record<string, { label: string; style: string }> = {
      submitted: { label: "Submitted", style: "bg-[#F1F5F9] text-[#1E293B] border border-[#CBD5E1]" },
      assigned: { label: "Assigned", style: "bg-[#E0E7FF] text-[#3730A3] border border-[#C7D2FE]" },
      acknowledged: { label: "Acknowledged", style: "bg-[#E8F3F1] text-[#176B63] border border-[#99F6E4]" },
      in_progress: { label: "In Progress", style: "bg-[#FEF3C7] text-[#92400E] border border-[#FCD34D]" },
      resolution_submitted: { label: "Awaiting Verification", style: "bg-[#E8F3F1] text-[#0D9488] border border-[#99F6E4] font-bold" },
      closed: { label: "Closed", style: "bg-[#EDF7F2] text-[#16805D] border border-[#A6E1CE]" },
      reopened: { label: "Reopened", style: "bg-[#FEE2E2] text-[#991B1B] border border-[#FCA5A5]" },
    };

    const s = map[status] || { label: status, style: "bg-[#F1F5F9] text-[#334155]" };
    return (
      <span className={`text-xs font-black uppercase px-2.5 py-1 rounded-md ${s.style}`}>
        {s.label}
      </span>
    );
  };

  const getAIStateBadge = (t: Ticket) => {
    const ai = t.latest_ai_verification;
    if (!ai) {
      return (
        <span className="text-xs text-[#64748B] bg-[#F1F5F9] border border-[#CBD5E1] px-2.5 py-1 rounded-md font-semibold">
          No Evidence
        </span>
      );
    }
    if (ai.ai_recommendation === "likely_resolved") {
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#16805D] bg-[#EDF7F2] border border-[#A6E1CE] px-2.5 py-1 rounded-md">
          <Sparkles className="h-3.5 w-3.5" />
          <span>AI Resolved ({Math.round(ai.confidence_score * 100)}%)</span>
        </span>
      );
    } else if (ai.ai_recommendation === "inconclusive") {
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#92400E] bg-[#FEF3C7] border border-[#FCD34D] px-2.5 py-1 rounded-md">
          <AlertCircle className="h-3.5 w-3.5" />
          <span>Inconclusive</span>
        </span>
      );
    } else {
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#991B1B] bg-[#FEE2E2] border border-[#FCA5A5] px-2.5 py-1 rounded-md">
          <AlertTriangle className="h-3.5 w-3.5" />
          <span>Unresolved</span>
        </span>
      );
    }
  };

  return (
    <div className="p-5 sm:p-6 space-y-5 max-w-7xl mx-auto">
      {/* Title Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-[#0F172A] tracking-tight">
            {isStaff
              ? `${staffDept ? staffDept.charAt(0).toUpperCase() + staffDept.slice(1) : "Department"} Tickets`
              : "Hospital Service Tickets"}
          </h1>
          <p className="text-xs sm:text-sm text-[#475569] mt-0.5 font-medium">
            {isStaff
              ? "Operational work orders assigned to your hospital department team"
              : "Centralized register across all medical & operational facilities"}
          </p>
        </div>
        <button
          onClick={onOpenCreateModal}
          className="self-start sm:self-auto px-4 py-2 rounded-xl bg-[#176B63] hover:bg-[#10574F] text-white text-xs sm:text-sm font-bold shadow-sm transition-all cursor-pointer"
        >
          Create New Ticket
        </button>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white rounded-xl border border-[#CBD5E1] p-3.5 shadow-2xs space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-2.5">
          {/* Search */}
          <div className="relative md:col-span-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#475569]" />
            <input
              type="text"
              placeholder="Search by ticket #, description, room..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3.5 py-1.5 rounded-lg border border-[#CBD5E1] bg-[#F8FAFC] text-xs font-semibold text-[#0F172A] focus:outline-none focus:border-[#176B63] focus:bg-white placeholder-[#64748B]"
            />
          </div>

          {/* Department Filter */}
          <div>
            <select
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
              disabled={isStaff}
              className={`w-full px-2.5 py-1.5 rounded-lg border border-[#CBD5E1] text-xs font-bold focus:outline-none ${
                isStaff
                  ? "bg-[#EEF4FD] text-[#3868C9] border-[#BFDBFE] cursor-not-allowed"
                  : "bg-[#F8FAFC] text-[#0F172A] focus:border-[#176B63]"
              }`}
            >
              {!isStaff && <option value="all">All Departments</option>}
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} {isStaff && d.id === staffDept ? "(Your Department)" : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-lg border border-[#CBD5E1] bg-[#F8FAFC] text-xs font-bold text-[#0F172A] focus:outline-none focus:border-[#176B63]"
            >
              <option value="all">All Statuses</option>
              <option value="open">All Open (Active)</option>
              <option value="submitted">Submitted</option>
              <option value="assigned">Assigned</option>
              <option value="acknowledged">Acknowledged</option>
              <option value="in_progress">In Progress</option>
              <option value="resolution_submitted">Resolution Submitted</option>
              <option value="closed">Closed</option>
            </select>
          </div>

          {/* SLA Filter */}
          <div>
            <select
              value={slaFilter}
              onChange={(e) => setSlaFilter(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-lg border border-[#CBD5E1] bg-[#F8FAFC] text-xs font-bold text-[#0F172A] focus:outline-none focus:border-[#176B63]"
            >
              <option value="all">SLA: All Timers</option>
              <option value="overdue">SLA: Overdue Only</option>
              <option value="due_soon">SLA: Due in 60m</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table Container */}
      <div className="bg-white rounded-xl border border-[#CBD5E1] shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#CBD5E1] bg-[#F1F5F9] text-xs font-bold text-[#1E293B] uppercase tracking-wider">
                <th className="py-2.5 px-3.5">Ticket ID</th>
                <th className="py-2.5 px-3.5">Issue Summary</th>
                <th className="py-2.5 px-3.5">Department</th>
                <th className="py-2.5 px-3.5">Location</th>
                <th className="py-2.5 px-3.5">Priority</th>
                <th className="py-2.5 px-3.5">Assigned Staff</th>
                <th className="py-2.5 px-3.5">Status</th>
                <th className="py-2.5 px-3.5">SLA Deadline</th>
                <th className="py-2.5 px-3.5">AI Verification</th>
                <th className="py-2.5 px-3.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E8F0] text-xs sm:text-sm text-[#0F172A]">
              {filteredTickets.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-10 text-center text-[#475569]">
                    <div className="max-w-sm mx-auto space-y-1.5">
                      <p className="font-extrabold text-sm text-[#0F172A]">No matching tickets found</p>
                      <p className="text-xs">Adjust your search filters or create a new service ticket.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredTickets.map((ticket) => (
                  <tr
                    key={ticket.id}
                    onClick={() => onSelectTicket(ticket.id)}
                    className="hover:bg-[#F8FAFC] cursor-pointer transition-colors"
                  >
                    {/* Ticket ID */}
                    <td className="py-2.5 px-3.5 font-bold text-[#176B63] tabular-nums whitespace-nowrap text-xs">
                      {ticket.ticket_number}
                    </td>

                    {/* Summary */}
                    <td className="py-2.5 px-3.5 max-w-xs">
                      <div className="font-bold text-[#0F172A] text-xs sm:text-sm truncate">{ticket.title}</div>
                      <div className="text-[11px] text-[#475569] font-normal truncate">{ticket.description}</div>
                    </td>

                    {/* Department */}
                    <td className="py-2.5 px-3.5 whitespace-nowrap">
                      <span className="capitalize font-semibold text-[#0F172A] text-xs">
                        {ticket.department_id}
                      </span>
                    </td>

                    {/* Location */}
                    <td className="py-2.5 px-3.5 font-semibold whitespace-nowrap text-[#0F172A] text-xs">
                      {ticket.room_number}
                    </td>

                    {/* Priority */}
                    <td className="py-2.5 px-3.5 whitespace-nowrap">
                      {getPriorityBadge(ticket.priority)}
                    </td>

                    {/* Assigned Staff */}
                    <td className="py-2.5 px-3.5 whitespace-nowrap font-medium text-[#334155] text-xs">
                      {ticket.assigned_staff_name ? (
                        <div className="flex items-center gap-1.5 text-[#0F172A]">
                          <User className="h-3.5 w-3.5 text-[#176B63]" />
                          <span className="font-semibold">{ticket.assigned_staff_name}</span>
                        </div>
                      ) : (
                        <span className="text-[#94A3B8] italic font-normal">Unassigned</span>
                      )}
                    </td>

                    {/* Status */}
                    <td className="py-2.5 px-3.5 whitespace-nowrap">
                      {getStatusBadge(ticket.status, ticket.is_escalated)}
                    </td>

                    {/* SLA Time */}
                    <td className="py-2.5 px-3.5 whitespace-nowrap">
                      {renderSLATimeRemaining(ticket)}
                    </td>

                    {/* AI Verification */}
                    <td className="py-2.5 px-3.5 whitespace-nowrap">
                      {getAIStateBadge(ticket)}
                    </td>

                    {/* Action */}
                    <td className="py-2.5 px-3.5 text-right whitespace-nowrap">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectTicket(ticket.id);
                        }}
                        className="p-1 rounded-lg hover:bg-[#E2E8F0] text-[#334155] hover:text-[#0F172A] cursor-pointer"
                        title="View Ticket Details"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer info */}
        <div className="px-4 py-3 bg-[#F7F8FA] border-t border-[#E5E9EF] flex items-center justify-between text-xs text-[#667085]">
          <span>
            Showing <strong className="text-[#17212F]">{filteredTickets.length}</strong> of{" "}
            <strong>{tickets.length}</strong> total operational tickets
          </span>
          <span className="text-[11px]">CareOps Automated SLA Enforcement Active</span>
        </div>
      </div>
    </div>
  );
}
