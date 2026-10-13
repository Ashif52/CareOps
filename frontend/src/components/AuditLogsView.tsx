"use client";

import React, { useState } from "react";
import {
  ScrollText,
  Search,
  ShieldCheck,
  User,
  Clock,
  Sparkles,
  AlertTriangle
} from "lucide-react";
import { AuditLog, formatDateTime } from "@/lib/api";

interface AuditLogsViewProps {
  logs: AuditLog[];
}

export function AuditLogsView({ logs }: AuditLogsViewProps) {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredLogs = logs.filter((l) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      l.action.toLowerCase().includes(term) ||
      l.actor_name.toLowerCase().includes(term) ||
      (l.ticket_id && String(l.ticket_id).includes(term))
    );
  });

  return (
    <div className="p-5 sm:p-6 space-y-5 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-[#176B63] text-white shadow-sm">
              <ScrollText className="h-5 w-5" />
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-[#0F172A] tracking-tight">
              Immutable Operations Audit Log
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-[#475569] mt-0.5 font-medium">
            Cryptographic ledger tracking all workflow state transitions, AI outputs, and supervisor overrides
          </p>
        </div>

        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#64748B]" />
          <input
            type="text"
            placeholder="Filter audit actions..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-8 pr-3.5 py-1.5 rounded-lg border border-[#CBD5E1] bg-white text-xs font-medium text-[#0F172A] focus:outline-none focus:border-[#176B63]"
          />
        </div>
      </div>

      <div className="bg-white rounded-xl border border-[#CBD5E1] shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#F1F5F9] border-b border-[#CBD5E1] text-xs font-bold text-[#1E293B] uppercase tracking-wider">
                <th className="py-2.5 px-4">Timestamp</th>
                <th className="py-2.5 px-4">Action</th>
                <th className="py-2.5 px-4">Ticket</th>
                <th className="py-2.5 px-4">Actor</th>
                <th className="py-2.5 px-4">Role</th>
                <th className="py-2.5 px-4">Audit Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E8F0] text-xs sm:text-sm">
              {filteredLogs.map((log) => (
                <tr key={log.id} className="hover:bg-[#F8FAFC] transition-colors">
                  <td className="py-2.5 px-4 text-[#475569] font-medium tabular-nums whitespace-nowrap">
                    {formatDateTime(log.created_at)}
                  </td>
                  <td className="py-2.5 px-4 font-mono font-bold text-[#176B63] text-xs">
                    {log.action}
                  </td>
                  <td className="py-2.5 px-4 tabular-nums font-semibold text-[#0F172A]">
                    {log.ticket_id ? `#${log.ticket_id}` : "System"}
                  </td>
                  <td className="py-2.5 px-4 font-semibold text-[#0F172A]">
                    {log.actor_name}
                  </td>
                  <td className="py-2.5 px-4 capitalize">
                    <span className="text-[11px] font-bold uppercase px-2 py-0.5 rounded bg-[#F1F5F9] text-[#334155] border border-[#CBD5E1]">
                      {log.actor_role}
                    </span>
                  </td>
                  <td className="py-2.5 px-4 max-w-md font-mono text-xs text-[#334155] truncate font-normal">
                    {typeof log.details === "string" ? log.details : JSON.stringify(log.details)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
