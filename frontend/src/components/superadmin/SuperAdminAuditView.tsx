"use client";

import React, { useState, useEffect } from "react";
import {
  ScrollText,
  ShieldCheck,
  Search,
  RefreshCw,
  Filter,
  User,
  Calendar,
  Lock
} from "lucide-react";
import { api, AuditLog, formatDateTime } from "@/lib/api";

export function SuperAdminAuditView() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedAction, setSelectedAction] = useState<string>("all");

  const loadLogs = async () => {
    setIsLoading(true);
    try {
      const res: any = await api.getSuperAdminAuditLogs();
      if (Array.isArray(res)) {
        setLogs(res);
      }
    } catch (err: any) {
      console.error("Failed to load privileged audit logs:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, []);

  const filteredLogs = logs.filter((log) => {
    const matchesSearch =
      (log.actor_name && log.actor_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (log.action && log.action.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (log.details && log.details.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesAction = selectedAction === "all" || log.action === selectedAction;
    return matchesSearch && matchesAction;
  });

  const uniqueActions = Array.from(new Set(logs.map((l) => l.action).filter(Boolean)));

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#E5E9EF] pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-[#EEF4FD] rounded-xl text-[#3868C9]">
              <ScrollText className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-[#17212F] flex items-center gap-2">
                Privileged Administrative Audit Trail
                <span className="px-2 py-0.5 rounded-full bg-[#3868C9]/10 text-[#3868C9] text-[10px] font-bold uppercase tracking-wider">
                  Immutable Security Records
                </span>
              </h1>
              <p className="text-xs text-[#667085] mt-0.5">
                Audit logs for root Super Admin actions: Admin provisioning, permission modifications, security parameter updates, and database purges.
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={loadLogs}
          disabled={isLoading}
          className="p-2 bg-white hover:bg-[#F7F8FA] border border-[#E5E9EF] rounded-lg text-[#667085] hover:text-[#17212F] transition cursor-pointer"
          title="Refresh audit logs"
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-[#E5E9EF] shadow-xs">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-[#98A2B3]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by actor name, action, or payload detail..."
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-[#F7F8FA] border border-[#E5E9EF] rounded-lg focus:outline-hidden focus:border-[#3868C9] focus:bg-white"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="h-3.5 w-3.5 text-[#667085]" />
          <select
            value={selectedAction}
            onChange={(e) => setSelectedAction(e.target.value)}
            className="text-xs bg-[#F7F8FA] border border-[#E5E9EF] rounded-lg px-2.5 py-1.5 text-[#344054] focus:outline-hidden focus:border-[#3868C9]"
          >
            <option value="all">All Action Types ({logs.length})</option>
            {uniqueActions.map((act) => (
              <option key={act} value={act}>
                {act}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-[#E5E9EF] overflow-hidden shadow-xs">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-[#F8F9FA] border-b border-[#E5E9EF] text-[#667085] uppercase tracking-wider text-[10px]">
              <th className="py-3 px-4">Timestamp (UTC)</th>
              <th className="py-3 px-4">Actor</th>
              <th className="py-3 px-4">Action</th>
              <th className="py-3 px-4">Target / Entity</th>
              <th className="py-3 px-4">Details & Payload</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E5E9EF]">
            {filteredLogs.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-12 text-center text-[#667085]">
                  No privileged administrative audit logs found.
                </td>
              </tr>
            ) : (
              filteredLogs.map((log) => {
                let parsedDetails = log.details;
                try {
                  const obj = JSON.parse(log.details || "{}");
                  parsedDetails = JSON.stringify(obj, null, 2);
                } catch (e) {}

                return (
                  <tr key={log.id} className="hover:bg-[#F9FAFB] transition">
                    <td className="py-3 px-4 font-mono text-[#475467] whitespace-nowrap">
                      {formatDateTime(log.created_at)}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="font-semibold text-[#17212F]">{log.actor_name}</div>
                      <span className="text-[10px] text-[#667085] uppercase font-mono">{log.actor_role}</span>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded-md bg-[#EEF4FD] text-[#3868C9] font-mono text-[10px] font-bold">
                        {log.action}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-[#475467] whitespace-nowrap">
                      {log.ticket_id ? `Ticket #${log.ticket_id}` : "System / Security"}
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px] text-[#344054] max-w-md truncate" title={parsedDetails}>
                      {log.details || "—"}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
