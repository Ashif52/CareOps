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
    <div className="p-8 sm:p-10 space-y-8 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-[#176B63] text-white shadow-md shadow-[#176B63]/20">
              <ScrollText className="h-6 w-6" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-[#0F172A] tracking-tight">
              Immutable Operations Audit Log
            </h1>
          </div>
          <p className="text-sm sm:text-base text-[#475569] mt-1 font-medium">
            Cryptographic ledger tracking all workflow state transitions, AI outputs, and supervisor overrides
          </p>
        </div>

        <div className="relative w-72">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#64748B]" />
          <input
            type="text"
            placeholder="Filter audit actions..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-2xl border-2 border-[#CBD5E1] bg-white text-sm font-medium text-[#0F172A] focus:outline-none focus:border-[#176B63]"
          />
        </div>
      </div>

      <div className="bg-white rounded-3xl border-2 border-[#CBD5E1] shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#F1F5F9] border-b-2 border-[#CBD5E1] text-xs sm:text-sm font-black text-[#1E293B] uppercase tracking-wider">
                <th className="py-4.5 px-5">Timestamp</th>
                <th className="py-4.5 px-5">Action</th>
                <th className="py-4.5 px-5">Ticket</th>
                <th className="py-4.5 px-5">Actor</th>
                <th className="py-4.5 px-5">Role</th>
                <th className="py-4.5 px-5">Audit Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E8F0] text-sm sm:text-base">
              {filteredLogs.map((log) => (
                <tr key={log.id} className="hover:bg-[#F8FAFC] transition-colors">
                  <td className="py-4.5 px-5 text-[#475569] font-medium tabular-nums whitespace-nowrap">
                    {formatDateTime(log.created_at)}
                  </td>
                  <td className="py-4.5 px-5 font-mono font-black text-[#176B63] text-xs sm:text-sm">
                    {log.action}
                  </td>
                  <td className="py-4.5 px-5 tabular-nums font-bold text-[#0F172A]">
                    {log.ticket_id ? `#${log.ticket_id}` : "System"}
                  </td>
                  <td className="py-4.5 px-5 font-bold text-[#0F172A]">
                    {log.actor_name}
                  </td>
                  <td className="py-4.5 px-5 capitalize">
                    <span className="text-xs font-black uppercase px-2.5 py-1 rounded-md bg-[#F1F5F9] text-[#334155] border border-[#CBD5E1]">
                      {log.actor_role}
                    </span>
                  </td>
                  <td className="py-4.5 px-5 max-w-md font-mono text-xs sm:text-sm text-[#334155] truncate font-medium">
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
