"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  ShieldAlert,
  Lock,
  Unlock,
  KeyRound,
  UserX,
  UserCheck,
  AlertTriangle,
  RefreshCw,
  Search
} from "lucide-react";
import { SecurityEvent, api, formatDateTime } from "@/lib/api";

interface SecurityEventsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SecurityEventsModal({
  isOpen,
  onClose,
}: SecurityEventsModalProps) {
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    if (isOpen) {
      loadEvents();
    }
  }, [isOpen]);

  const loadEvents = async () => {
    setIsLoading(true);
    try {
      const data = await api.getSecurityEvents();
      setEvents(data);
    } catch (err) {
      console.error("Failed to load security events", err);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  const filteredEvents = events.filter((ev) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      ev.action.toLowerCase().includes(term) ||
      ev.actor_name.toLowerCase().includes(term) ||
      (typeof ev.details === "object" && JSON.stringify(ev.details).toLowerCase().includes(term))
    );
  });

  const getActionBadge = (action: string) => {
    if (action.includes("LOCKED")) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-black uppercase bg-[#FEE2E2] text-[#991B1B] border border-[#FCA5A5]">
          <Lock className="h-3.5 w-3.5" />
          {action}
        </span>
      );
    } else if (action.includes("UNLOCKED")) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-black uppercase bg-[#EDF7F2] text-[#16805D] border border-[#A6E1CE]">
          <Unlock className="h-3.5 w-3.5" />
          {action}
        </span>
      );
    } else if (action.includes("DEACTIVATED")) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-black uppercase bg-[#FEF3C7] text-[#92400E] border border-[#FCD34D]">
          <UserX className="h-3.5 w-3.5" />
          {action}
        </span>
      );
    } else if (action.includes("ACTIVATED")) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-black uppercase bg-[#EDF7F2] text-[#16805D] border border-[#A6E1CE]">
          <UserCheck className="h-3.5 w-3.5" />
          {action}
        </span>
      );
    } else if (action.includes("PASSWORD")) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-black uppercase bg-[#EEF4FD] text-[#3868C9] border border-[#BFDBFE]">
          <KeyRound className="h-3.5 w-3.5" />
          {action}
        </span>
      );
    } else {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-black uppercase bg-[#F1F5F9] text-[#475569] border border-[#CBD5E1]">
          {action}
        </span>
      );
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 sm:p-6">
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity"
      />

      <div className="relative w-full max-w-4xl bg-white rounded-3xl shadow-2xl border-2 border-[#CBD5E1] overflow-hidden z-10 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-6 border-b-2 border-[#E2E8F0] bg-[#F8FAFC] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-[#DC2626] text-white shadow-sm">
              <ShieldAlert className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-xl font-black text-[#0F172A]">Security Audit Ledger & Lockout Telemetry</h2>
              <p className="text-xs font-semibold text-[#475569]">
                Immutable hospital security events, failed authentication tracking, and administrative account modifications
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-[#64748B] hover:text-[#0F172A] hover:bg-[#E2E8F0] transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Toolbar */}
        <div className="p-4 bg-white border-b-2 border-[#E2E8F0] flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#64748B]" />
            <input
              type="text"
              placeholder="Search security events, actors, emails..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl border-2 border-[#CBD5E1] bg-[#F8FAFC] text-xs font-bold text-[#0F172A] focus:outline-none focus:border-[#176B63] focus:bg-white"
            />
          </div>

          <button
            onClick={loadEvents}
            disabled={isLoading}
            className="p-2.5 rounded-xl border-2 border-[#CBD5E1] text-[#475569] hover:text-[#0F172A] hover:bg-[#F8FAFC] transition-colors cursor-pointer"
            title="Refresh Ledger"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          </button>
        </div>

        {/* Events Table */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="p-12 text-center text-sm font-bold text-[#64748B]">Loading audit ledger...</div>
          ) : filteredEvents.length === 0 ? (
            <div className="p-12 text-center text-sm font-bold text-[#64748B]">
              No security events matching filter
            </div>
          ) : (
            <div className="divide-y-2 divide-[#E2E8F0]">
              {filteredEvents.map((ev) => (
                <div key={ev.id} className="p-4.5 hover:bg-[#F8FAFC] transition-colors space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      {getActionBadge(ev.action)}
                      <span className="text-xs font-black text-[#0F172A]">
                        Actor: {ev.actor_name} ({ev.actor_role})
                      </span>
                    </div>
                    <span className="text-xs font-bold text-[#64748B] tabular-nums">
                      {formatDateTime(ev.created_at)}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-[#F8FAFC] border border-[#CBD5E1] font-mono text-xs text-[#334155] break-all">
                    {typeof ev.details === "object" ? JSON.stringify(ev.details) : ev.details}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t-2 border-[#E2E8F0] bg-[#F8FAFC] flex justify-between items-center text-xs font-bold text-[#64748B]">
          <span>Showing {filteredEvents.length} security entries</span>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-[#0F172A] hover:bg-[#1E293B] text-white text-sm font-bold cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
