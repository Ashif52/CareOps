"use client";

import React, { use, useState, useEffect } from "react";
import {
  ShieldCheck,
  ArrowLeft,
  RefreshCw,
  AlertCircle
} from "lucide-react";
import { api, formatTime, formatDateTime } from "@/lib/api";

export default function TrackClient({
  paramsPromise,
}: {
  paramsPromise: Promise<{ ticket_number: string }>;
}) {
  const { ticket_number: ticketNumber } = use(paramsPromise);

  const [ticket, setTicket] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string>("");

  const fetchStatus = async () => {
    try {
      const data = await api.getPatientTicketStatus(ticketNumber);
      setTicket(data);
      setError(null);
      setLastUpdated(new Date().toLocaleTimeString());
    } catch (err: any) {
      setError(err.message || "Failed to load service ticket.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();

    // Setup Real-time SSE listener
    let sse: EventSource | null = null;
    try {
      const sseUrl = api.getPatientStreamUrl(ticketNumber);
      sse = new EventSource(sseUrl);

      sse.onmessage = (e) => {
        try {
          const payload = jsonParse(e.data);
          if (payload.event === "ticket_updated" && payload.data) {
            fetchStatus();
          }
        } catch (_) {}
      };

      sse.addEventListener("ticket_updated", () => {
        fetchStatus();
      });
    } catch (_) {}

    const interval = setInterval(fetchStatus, 4000);

    return () => {
      clearInterval(interval);
      if (sse) sse.close();
    };
  }, [ticketNumber]);

  function jsonParse(str: string) {
    try {
      return JSON.parse(str);
    } catch (_) {
      return {};
    }
  }

  return (
    <div className="min-h-screen bg-[#17212F] flex flex-col items-center justify-center p-3 sm:p-6">
      <div className="w-full max-w-lg mb-3 flex items-center justify-between text-xs text-white/90 px-2">
        <a
          href="/"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-medium transition-colors text-xs"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Home</span>
        </a>
        <span className="font-mono bg-white/10 px-2 py-0.5 rounded text-white text-xs">
          Ref: {ticketNumber}
        </span>
      </div>

      <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <header className="bg-white border-b border-[#E5E9EF] p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-[#176B63] flex items-center justify-center text-white shadow-sm">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-[#17212F]">
                CareOps Patient Service Tracker
              </h1>
              <p className="text-xs text-[#667085]">Live Status & Updates</p>
            </div>
          </div>
          <button
            onClick={fetchStatus}
            className="p-2 rounded-xl text-[#667085] hover:text-[#17212F] hover:bg-[#F7F8FA] transition-colors cursor-pointer"
            title="Refresh status"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </header>

        {/* Content */}
        <div className="p-6 space-y-6">
          {loading ? (
            <div className="py-20 text-center text-sm text-[#667085]">
              <div className="animate-spin h-8 w-8 border-3 border-[#176B63] border-t-transparent rounded-full mx-auto mb-3" />
              <span>Loading request status...</span>
            </div>
          ) : error ? (
            <div className="p-6 rounded-2xl bg-[#FEF2F2] border border-[#FCA5A5] text-[#991B1B] text-center space-y-2">
              <AlertCircle className="h-8 w-8 mx-auto" />
              <h3 className="font-bold text-sm">Request Not Found</h3>
              <p className="text-xs">{error}</p>
            </div>
          ) : ticket ? (
            <div className="space-y-6 animate-in fade-in duration-200">
              {/* Status Header Badge */}
              <div className="p-4 rounded-2xl bg-[#E8F3F1] border border-[#A7D7D1] flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-[#176B63] uppercase tracking-wider block">
                    Current Stage
                  </span>
                  <span className="text-base font-black text-[#17212F]">
                    {ticket.friendly_status}
                  </span>
                </div>
                <div className="px-3 py-1 rounded-full bg-white text-xs font-bold text-[#176B63] shadow-xs">
                  {ticket.status.replace("_", " ").toUpperCase()}
                </div>
              </div>

              {/* Ticket Details */}
              <div className="bg-[#F8FAFC] p-4 rounded-2xl border border-[#E2E8F0] space-y-2.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-[#64748B]">Reference Number:</span>
                  <strong className="font-mono text-[#0F172A]">{ticket.ticket_number}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#64748B]">Location:</span>
                  <strong className="text-[#0F172A]">{ticket.room_number}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#64748B]">Department:</span>
                  <strong className="text-[#0F172A]">{ticket.department_name}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#64748B]">Category:</span>
                  <strong className="text-[#0F172A]">{ticket.category}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#64748B]">Submitted At:</span>
                  <span className="text-[#0F172A]">
                    {formatDateTime(ticket.created_at)}
                  </span>
                </div>
              </div>

              {/* 5-Step Visual Progress Tracker */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-[#0F172A] uppercase tracking-wider">
                  Live Resolution Progress
                </h3>

                <div className="relative pl-6 space-y-5 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-[#CBD5E1]">
                  {[
                    {
                      label: "1. Request Received & Registered",
                      active: true,
                      timestamp: ticket.created_at,
                    },
                    {
                      label: "2. Assigned to On-Duty Care Team",
                      active: ticket.status !== "submitted",
                      timestamp: ticket.status !== "submitted" ? ticket.created_at : null,
                    },
                    {
                      label: "3. Staff Acknowledged & En Route",
                      active: ["acknowledged", "in_progress", "resolution_submitted", "closed"].includes(
                        ticket.status
                      ),
                      timestamp: ticket.acknowledged_at,
                    },
                    {
                      label: "4. Service in Progress at Location",
                      active: ["in_progress", "resolution_submitted", "closed"].includes(ticket.status),
                      timestamp: ticket.in_progress_at,
                    },
                    {
                      label: "5. Work Completed & Verified",
                      active: ticket.status === "closed",
                      timestamp: ticket.closed_at,
                    },
                  ].map((step, idx) => (
                    <div key={idx} className="relative flex items-start gap-3">
                      <div
                        className={`absolute -left-6 top-0.5 h-5 w-5 rounded-full flex items-center justify-center text-xs font-bold ${
                          step.active
                            ? "bg-[#176B63] text-white shadow-sm"
                            : "bg-white border-2 border-[#CBD5E1] text-[#94A3B8]"
                        }`}
                      >
                        {step.active ? "✓" : idx + 1}
                      </div>
                      <div>
                        <span
                          className={`text-xs block font-bold ${
                            step.active ? "text-[#0F172A]" : "text-[#94A3B8]"
                          }`}
                        >
                          {step.label}
                        </span>
                        {step.timestamp && (
                          <span className="text-[10px] text-[#64748B]">
                            {formatTime(step.timestamp)}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Public updates log */}
              {ticket.updates && ticket.updates.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-[#E5E9EF]">
                  <h4 className="text-xs font-bold text-[#0F172A]">Staff Messages to Patient:</h4>
                  <div className="space-y-2">
                    {ticket.updates.map((u: any, idx: number) => (
                      <div key={idx} className="p-3 bg-[#F8FAFC] rounded-xl border border-[#E2E8F0] text-xs">
                        <div className="flex justify-between text-[10px] text-[#64748B] mb-1">
                          <span className="font-semibold text-[#176B63]">{u.author}</span>
                          <span>{formatTime(u.timestamp)}</span>
                        </div>
                        <p className="text-[#334155]">{u.message}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {lastUpdated && (
                <div className="text-center text-[10px] text-[#94A3B8]">
                  Live real-time sync active • Last verified {lastUpdated}
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
