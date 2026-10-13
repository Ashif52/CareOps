"use client";

import React, { use, useState, useEffect } from "react";
import {
  ShieldCheck,
  ArrowLeft,
  RefreshCw,
  AlertCircle,
  AlertTriangle,
  Clock,
  Sparkles,
  CheckCircle2,
  Send,
  MessageSquare,
  Smile,
  Meh,
  Frown
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
  const [isEscalating, setIsEscalating] = useState(false);

  // Patient Feedback State
  const [selectedEmoji, setSelectedEmoji] = useState<"happy" | "okay" | "unhappy" | null>(null);
  const [npsScore, setNpsScore] = useState<number | null>(null);
  const [feedbackComment, setFeedbackComment] = useState("");
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);

  const fetchStatus = async () => {
    try {
      // Check query parameter for secure tracking token if present
      const token = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("token") : null;
      const data = await api.getPatientTicketStatus(ticketNumber, token || undefined);
      setTicket(data);
      setError(null);
      setLastUpdated(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
    } catch (err: any) {
      setError(err.message || "Failed to load service ticket.");
    } finally {
      setLoading(false);
    }
  };

  const handleEscalate = async () => {
    if (!confirm("Dispatch an urgent escalation alert directly to the department supervisor via SMS and operational priority queue?")) {
      return;
    }
    setIsEscalating(true);
    try {
      await api.escalatePatientTicket(ticketNumber, "Patient requested urgent escalation from tracking portal.");
      alert("Alert dispatched! The on-duty supervisor has been notified.");
      await fetchStatus();
    } catch (err: any) {
      alert(`Escalation failed: ${err.message || err}`);
    } finally {
      setIsEscalating(false);
    }
  };

  const handleSubmitFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmoji) {
      alert("Please select one of the satisfaction emojis (Unhappy, Okay, or Happy).");
      return;
    }

    setIsSubmittingFeedback(true);
    try {
      const token = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("token") : null;
      await api.submitNPSFeedback({
        ticket_id: ticket.id,
        tracking_token: token || undefined,
        emoji_rating: selectedEmoji,
        nps_score: npsScore !== null ? npsScore : undefined,
        feedback_comment: feedbackComment.trim() || undefined,
      });
      setFeedbackSubmitted(true);
    } catch (err: any) {
      alert(`Failed to record feedback: ${err.message || err}`);
    } finally {
      setIsSubmittingFeedback(false);
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
          const payload = JSON.parse(e.data);
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

  return (
    <div className="min-h-screen bg-[#F0F2F5] flex flex-col items-center justify-center p-3 sm:p-6">
      <div className="w-full max-w-lg mb-3 flex items-center justify-between text-xs text-[#475467] px-2">
        <a
          href="/"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-[#E5E9EF] hover:bg-[#F8F9FA] text-[#17212F] font-semibold transition text-xs shadow-2xs"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Home</span>
        </a>
        <span className="font-mono bg-white border border-[#E5E9EF] px-2.5 py-1 rounded-lg text-[#17212F] font-bold text-xs shadow-2xs">
          Ref: {ticketNumber}
        </span>
      </div>

      <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl border border-[#E5E9EF] overflow-hidden flex flex-col">
        {/* Header */}
        <header className="bg-white border-b border-[#E5E9EF] p-4.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-[#3868C9] flex items-center justify-center text-white shadow-xs">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-[#17212F]">
                CareOps Patient Service Tracker
              </h1>
              <p className="text-xs text-[#667085]">Live Resolution Updates & ETA</p>
            </div>
          </div>
          <button
            onClick={fetchStatus}
            className="p-2 rounded-xl text-[#667085] hover:text-[#17212F] hover:bg-[#F7F8FA] transition cursor-pointer"
            title="Refresh status"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </header>

        {/* Content */}
        <div className="p-5 sm:p-6 space-y-5">
          {loading ? (
            <div className="py-20 text-center text-sm text-[#667085]">
              <div className="animate-spin h-7 w-7 border-3 border-[#3868C9] border-t-transparent rounded-full mx-auto mb-3" />
              <span>Connecting to hospital service desk...</span>
            </div>
          ) : error ? (
            <div className="p-6 rounded-2xl bg-[#FEF2F2] border border-[#FCA5A5] text-[#991B1B] text-center space-y-2">
              <AlertCircle className="h-8 w-8 mx-auto" />
              <h3 className="font-bold text-sm">Request Not Found</h3>
              <p className="text-xs">{error}</p>
            </div>
          ) : ticket ? (
            <div className="space-y-5 animate-in fade-in duration-200">
              {/* ETA Live Banner (Active after acknowledgement) */}
              {ticket.status !== "closed" && ticket.acknowledged_at && (
                <div className="p-4 rounded-xl bg-[#EEF4FD] border border-[#BFDBFE] text-xs flex items-center justify-between shadow-2xs">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-white rounded-lg text-[#3868C9] shadow-2xs">
                      <Clock className="h-5 w-5 animate-pulse" />
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#3868C9] block">
                        Estimated Arrival
                      </span>
                      <strong className="text-sm font-bold text-[#17212F]">
                        {ticket.estimated_arrival_minutes || 15}–{((ticket.estimated_arrival_minutes || 15) + 5)} Minutes
                      </strong>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-white text-[11px] font-bold text-[#3868C9] border border-[#BFDBFE]">
                    Technician En Route
                  </span>
                </div>
              )}

              {/* Status Header Badge */}
              <div className="p-4 rounded-xl bg-[#F8F9FA] border border-[#E5E9EF] flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-[#667085] uppercase tracking-wider block">
                    Current Stage
                  </span>
                  <span className="text-sm font-bold text-[#17212F]">
                    {ticket.friendly_status}
                  </span>
                </div>
                <div className="px-3 py-1 rounded-full bg-white border border-[#E5E9EF] text-xs font-bold text-[#17212F] shadow-2xs capitalize">
                  {ticket.status.replace("_", " ")}
                </div>
              </div>

              {/* Ticket Details */}
              <div className="bg-[#FAFBFD] p-4 rounded-xl border border-[#E5E9EF] space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-[#667085]">Reference Number:</span>
                  <strong className="font-mono text-[#17212F]">{ticket.ticket_number}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#667085]">Location:</span>
                  <strong className="text-[#17212F]">{ticket.room_number}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#667085]">Department:</span>
                  <strong className="text-[#17212F] capitalize">{ticket.department_name || ticket.department_id}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#667085]">Category:</span>
                  <strong className="text-[#17212F]">{ticket.category}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#667085]">Submitted At:</span>
                  <span className="text-[#17212F]">
                    {formatDateTime(ticket.created_at)}
                  </span>
                </div>
              </div>

              {/* Escalation alert or button */}
              {ticket.is_escalated ? (
                <div className="p-3.5 rounded-xl bg-[#FEF3F2] border border-[#FECDCA] text-[#B42318] text-xs space-y-1">
                  <div className="flex items-center gap-2 font-bold">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    <span>Priority Escalation Active (Level {ticket.escalation_level || 1})</span>
                  </div>
                  <p className="text-[11px] text-[#B42318]/90">
                    Department supervisor notified. Direct monitoring in progress.
                  </p>
                </div>
              ) : ticket.status !== "closed" ? (
                <div className="p-3 bg-[#FFFBEB] border border-[#FDE68A] rounded-xl flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-[#92400E] block">Need Urgent Attention?</span>
                    <span className="text-[11px] text-[#A16207]">
                      Dispatches priority alert to department lead
                    </span>
                  </div>
                  <button
                    onClick={handleEscalate}
                    disabled={isEscalating}
                    className="px-3 py-1.5 bg-[#DC2626] hover:bg-[#B91C1C] text-white font-bold text-xs rounded-lg transition cursor-pointer disabled:opacity-50"
                  >
                    {isEscalating ? "Alerting..." : "Escalate Request"}
                  </button>
                </div>
              ) : null}

              {/* 5-Step Visual Progress Tracker */}
              <div className="space-y-3 pt-1">
                <h3 className="text-xs font-bold text-[#17212F] uppercase tracking-wider">
                  Resolution Milestones
                </h3>

                <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-[#E5E9EF]">
                  {[
                    {
                      label: "1. Request Registered",
                      active: true,
                      timestamp: ticket.created_at,
                    },
                    {
                      label: "2. Assigned to Care Team",
                      active: ticket.status !== "submitted",
                      timestamp: ticket.assigned_at || (ticket.status !== "submitted" ? ticket.created_at : null),
                    },
                    {
                      label: "3. Staff Acknowledged & En Route",
                      active: ["acknowledged", "in_progress", "work_started", "work_completed", "resolution_submitted", "closed"].includes(ticket.status),
                      timestamp: ticket.acknowledged_at,
                    },
                    {
                      label: "4. Work in Progress at Location",
                      active: ["in_progress", "work_started", "work_completed", "resolution_submitted", "closed"].includes(ticket.status),
                      timestamp: ticket.in_progress_at || ticket.work_started_at,
                    },
                    {
                      label: "5. Work Completed & Verified",
                      active: ["closed", "work_completed", "resolution_submitted"].includes(ticket.status),
                      timestamp: ticket.closed_at || ticket.work_completed_at,
                    },
                  ].map((st, idx) => (
                    <div key={idx} className="relative flex items-start gap-3">
                      <div
                        className={`absolute -left-6 top-0.5 h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                          st.active
                            ? "bg-[#3868C9] text-white shadow-2xs"
                            : "bg-white border border-[#D0D5DD] text-[#98A2B3]"
                        }`}
                      >
                        {st.active ? "✓" : idx + 1}
                      </div>
                      <div>
                        <span
                          className={`text-xs block font-bold ${
                            st.active ? "text-[#17212F]" : "text-[#98A2B3]"
                          }`}
                        >
                          {st.label}
                        </span>
                        {st.timestamp && (
                          <span className="text-[10px] text-[#667085]">
                            {formatTime(st.timestamp)}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Patient Experience Feedback Card (When closed or completed) */}
              {(ticket.ready_for_feedback || ["closed", "work_completed", "resolution_submitted"].includes(ticket.status)) && (
                <div className="bg-white rounded-xl border-2 border-[#3868C9] p-5 shadow-sm space-y-4">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-[#3868C9]" />
                    <h3 className="text-sm font-bold text-[#17212F]">
                      How was your hospital service experience?
                    </h3>
                  </div>

                  {feedbackSubmitted ? (
                    <div className="p-4 rounded-xl bg-[#EDF7F2] border border-[#A6E1CE] text-[#16805D] text-xs font-semibold text-center space-y-1">
                      <CheckCircle2 className="h-6 w-6 mx-auto" />
                      <p className="text-sm font-bold">Thank you for your valuable feedback!</p>
                      <p className="text-[11px] text-[#16805D]/80">
                        Your response helps us continually refine and deliver dignified patient care.
                      </p>
                    </div>
                  ) : (
                    <form onSubmit={handleSubmitFeedback} className="space-y-4 text-xs">
                      {/* 3 Emoji Buttons */}
                      <div className="space-y-1.5">
                        <label className="text-[#344054] font-semibold block">
                          Overall Satisfaction: <span className="text-[#DC2626]">*</span>
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                          <button
                            type="button"
                            onClick={() => setSelectedEmoji("unhappy")}
                            className={`p-3 rounded-xl border text-center transition cursor-pointer flex flex-col items-center gap-1 ${
                              selectedEmoji === "unhappy"
                                ? "bg-[#FEF3F2] border-[#DC2626] text-[#DC2626] font-bold"
                                : "bg-[#F8F9FA] border-[#E5E9EF] text-[#667085] hover:bg-[#F2F4F7]"
                            }`}
                          >
                            <span className="text-2xl">😞</span>
                            <span className="text-xs">Unhappy</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setSelectedEmoji("okay")}
                            className={`p-3 rounded-xl border text-center transition cursor-pointer flex flex-col items-center gap-1 ${
                              selectedEmoji === "okay"
                                ? "bg-[#FEF7EC] border-[#F79009] text-[#B54708] font-bold"
                                : "bg-[#F8F9FA] border-[#E5E9EF] text-[#667085] hover:bg-[#F2F4F7]"
                            }`}
                          >
                            <span className="text-2xl">😐</span>
                            <span className="text-xs">Okay</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setSelectedEmoji("happy")}
                            className={`p-3 rounded-xl border text-center transition cursor-pointer flex flex-col items-center gap-1 ${
                              selectedEmoji === "happy"
                                ? "bg-[#EDF7F2] border-[#16805D] text-[#16805D] font-bold"
                                : "bg-[#F8F9FA] border-[#E5E9EF] text-[#667085] hover:bg-[#F2F4F7]"
                            }`}
                          >
                            <span className="text-2xl">😊</span>
                            <span className="text-xs">Happy</span>
                          </button>
                        </div>
                      </div>

                      {/* Optional Formal NPS (0 to 10) */}
                      <div className="space-y-1.5 pt-1">
                        <div className="flex items-center justify-between">
                          <label className="text-[#344054] font-semibold">
                            Likelihood to recommend (0 = Unlikely, 10 = Extremely Likely):
                          </label>
                          {npsScore !== null && (
                            <span className="font-bold text-[#3868C9] font-mono">{npsScore} / 10</span>
                          )}
                        </div>
                        <div className="flex items-center justify-between gap-1 overflow-x-auto pb-1">
                          {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((score) => (
                            <button
                              key={score}
                              type="button"
                              onClick={() => setNpsScore(score)}
                              className={`flex-1 min-w-[28px] h-8 rounded-lg font-mono text-xs font-bold transition cursor-pointer ${
                                npsScore === score
                                  ? score >= 9
                                    ? "bg-[#16805D] text-white"
                                    : score >= 7
                                    ? "bg-[#F79009] text-white"
                                    : "bg-[#DC2626] text-white"
                                  : "bg-[#F8F9FA] border border-[#E5E9EF] text-[#475467] hover:bg-[#EEF4FD]"
                              }`}
                            >
                              {score}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Optional Comment */}
                      <div className="space-y-1 pt-1">
                        <label className="text-[#344054] font-semibold block">
                          Additional Comments (Optional):
                        </label>
                        <textarea
                          value={feedbackComment}
                          onChange={(e) => setFeedbackComment(e.target.value)}
                          placeholder="Tell us what went well or how we can improve..."
                          rows={2}
                          className="w-full p-2.5 rounded-lg border border-[#D0D5DD] text-xs focus:outline-hidden focus:border-[#3868C9]"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={isSubmittingFeedback || !selectedEmoji}
                        className="w-full py-2.5 rounded-lg bg-[#3868C9] hover:bg-[#2C52A4] text-white font-bold text-xs transition cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5 shadow-2xs"
                      >
                        <Send className="h-3.5 w-3.5" />
                        <span>{isSubmittingFeedback ? "Submitting Feedback..." : "Submit Experience Feedback"}</span>
                      </button>
                    </form>
                  )}
                </div>
              )}

              {lastUpdated && (
                <div className="text-center text-[10px] text-[#98A2B3]">
                  Live hospital telemetry active &bull; Last updated at {lastUpdated}
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
