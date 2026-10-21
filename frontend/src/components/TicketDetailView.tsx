"use client";

import React, { useState } from "react";
import {
  X,
  Clock,
  User,
  ShieldCheck,
  AlertTriangle,
  Sparkles,
  Send,
  Lock,
  Globe,
  CheckCircle2,
  Play,
  Upload,
  Calendar,
  Layers,
  ArrowRight,
  ExternalLink,
  Volume2,
  Loader2,
  Mail,
  Check,
  Edit2
} from "lucide-react";
import { api, Ticket, User as UserType, getFileUrl, formatTime, formatDateTime, parseUtcDate, formatDurationHoursMinutes } from "@/lib/api";

interface TicketDetailViewProps {
  ticket: Ticket;
  currentUser: UserType | null;
  onClose: () => void;
  onAcknowledge: (ticketId: number) => void;
  onStartWork: (ticketId: number) => void;
  onSubmitResolution: (ticketId: number, data: { summary: string; parts?: string; test_notes?: string }) => void;
  onCloseTicket: (ticketId: number, approvalNote?: string) => void;
  onAddNote: (ticketId: number, content: string, isInternal: boolean) => void;
  onUploadEvidence: (ticketId: number, stage: "before" | "after", file: File, mediaType: "image" | "video") => void;
}

export function TicketDetailView({
  ticket,
  currentUser,
  onClose,
  onAcknowledge,
  onStartWork,
  onSubmitResolution,
  onCloseTicket,
  onAddNote,
  onUploadEvidence,
}: TicketDetailViewProps) {
  const [activeTab, setActiveTab] = useState<"overview" | "evidence" | "notes" | "audit">("overview");
  const [newNote, setNewNote] = useState("");
  const [isInternalNote, setIsInternalNote] = useState(true);

  // Resolution form states
  const [showResModal, setShowResModal] = useState(false);
  const [resSummary, setResSummary] = useState("");
  const [resParts, setResParts] = useState("");
  const [resNotes, setResNotes] = useState("");

  // Evidence upload states
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadStage, setUploadStage] = useState<"before" | "after">("before");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isActionPending, setIsActionPending] = useState(false);

  // Client Follow-up Email states
  const [clientEmail, setClientEmail] = useState(ticket.patient_email || "");
  const [isEditingEmail, setIsEditingEmail] = useState(false);
  const [isSavingEmail, setIsSavingEmail] = useState(false);
  const [emailSendStatus, setEmailSendStatus] = useState<{ stage: string; msg: string; type: "success" | "error" } | null>(null);
  const [isSendingEmail, setIsSendingEmail] = useState<string | null>(null);

  const handleSaveEmail = async () => {
    setIsSavingEmail(true);
    try {
      await api.updateTicketContact(ticket.id, {
        patient_email: clientEmail.trim() || undefined,
      });
      setIsEditingEmail(false);
      setEmailSendStatus({ stage: "save", msg: "Client email saved successfully.", type: "success" });
      setTimeout(() => setEmailSendStatus(null), 4000);
    } catch (e: any) {
      setEmailSendStatus({ stage: "save", msg: e.message || "Failed to save email", type: "error" });
    } finally {
      setIsSavingEmail(false);
    }
  };

  const handleSendFollowup = async (stage: "work_started" | "work_finished") => {
    const targetEmail = clientEmail.trim() || ticket.patient_email;
    if (!targetEmail) {
      setIsEditingEmail(true);
      setEmailSendStatus({ stage, msg: "Please enter a client email address first.", type: "error" });
      return;
    }
    setIsSendingEmail(stage);
    setEmailSendStatus(null);
    try {
      const res = await api.sendFollowupEmail(ticket.id, stage, targetEmail);
      setEmailSendStatus({
        stage,
        msg: res.message || `Follow-up '${stage === "work_started" ? "Work Started" : "Work Finished"}' email dispatched to ${targetEmail}`,
        type: "success"
      });
      setTimeout(() => setEmailSendStatus(null), 5000);
    } catch (e: any) {
      setEmailSendStatus({
        stage,
        msg: e.message || `Failed to dispatch ${stage} email. Check SMTP settings.`,
        type: "error"
      });
    } finally {
      setIsSendingEmail(null);
    }
  };

  const canAcknowledge = ticket.status === "submitted" || ticket.status === "assigned";
  const canStartWork = ticket.status === "acknowledged";
  const canSubmitResolution = ticket.status === "in_progress" || ticket.status === "acknowledged";
  const canClose = (currentUser?.role === "admin" || currentUser?.role === "supervisor") && ticket.status !== "closed";

  const handleSendNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNote.trim()) return;
    onAddNote(ticket.id, newNote.trim(), isInternalNote);
    setNewNote("");
  };

  const handleResolveSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!resSummary.trim()) return;
    onSubmitResolution(ticket.id, {
      summary: resSummary,
      parts: resParts || undefined,
      test_notes: resNotes || undefined,
    });
    setShowResModal(false);
  };

  const handleFileUpload = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) return;
    const isVideo = selectedFile.type.includes("video") || selectedFile.name.endsWith(".mp4") || selectedFile.name.endsWith(".webm");
    onUploadEvidence(ticket.id, uploadStage, selectedFile, isVideo ? "video" : "image");
    setShowUploadModal(false);
    setSelectedFile(null);
  };

  const beforeEvidence = ticket.evidences?.find((e) => e.stage === "before");
  const afterEvidence = ticket.evidences?.find((e) => e.stage === "after");
  const aiJob = ticket.latest_ai_verification;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-4xl w-full border border-[#E5E9EF] shadow-2xl flex flex-col max-h-[92vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header Bar */}
        <div className="px-6 py-4 border-b border-[#E5E9EF] flex items-center justify-between bg-[#F7F8FA]">
          <div className="flex items-center gap-3">
            <span className="font-bold text-base text-[#176B63] tabular-nums">
              {ticket.ticket_number}
            </span>
            <span className="text-xs capitalize font-semibold px-2 py-0.5 rounded bg-white border border-[#E5E9EF] text-[#17212F]">
              {ticket.department_id}
            </span>
            <span className="text-xs capitalize font-bold px-2 py-0.5 rounded bg-[#FEF7EC] text-[#B7791F] border border-[#FAD7A0]">
              {ticket.priority} Priority
            </span>
            {ticket.is_escalated && (
              <span className="text-xs font-bold px-2 py-0.5 rounded bg-[#FDF2F2] text-[#C43D4B] border border-[#F8D7DA] flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                <span>Escalated</span>
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#667085] hover:text-[#17212F] hover:bg-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Action Workflow Ribbon */}
        <div className="px-6 py-2.5 bg-white border-b border-[#E5E9EF] flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-[#667085] font-medium">Workflow Status:</span>
            <span className="font-bold text-[#17212F] capitalize px-2 py-0.5 rounded bg-[#F1F4F9]">
              {ticket.status.replace("_", " ")}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {canAcknowledge && (
              <button
                disabled={isActionPending}
                onClick={async () => {
                  setIsActionPending(true);
                  try {
                    await onAcknowledge(ticket.id);
                  } finally {
                    setIsActionPending(false);
                  }
                }}
                className="px-3 py-1.5 rounded-lg bg-[#176B63] text-white font-semibold hover:bg-[#10574F] transition-all shadow-sm disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
              >
                {isActionPending ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Acknowledging...</span>
                  </>
                ) : (
                  <span>Acknowledge Receipt</span>
                )}
              </button>
            )}

            {canStartWork && (
              <button
                disabled={isActionPending}
                onClick={async () => {
                  setIsActionPending(true);
                  try {
                    await onStartWork(ticket.id);
                  } finally {
                    setIsActionPending(false);
                  }
                }}
                className="px-3 py-1.5 rounded-lg bg-[#3868C9] text-white font-semibold hover:bg-[#2A52A3] transition-all shadow-sm disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
              >
                {isActionPending ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Starting...</span>
                  </>
                ) : (
                  <span>Start Work</span>
                )}
              </button>
            )}

            {canSubmitResolution && (
              <button
                onClick={() => setShowResModal(true)}
                className="px-3 py-1.5 rounded-lg bg-[#16805D] text-white font-semibold hover:bg-[#116348] transition-all shadow-sm"
              >
                Submit Resolution
              </button>
            )}

            <button
              onClick={() => setShowUploadModal(true)}
              className="px-3 py-1.5 rounded-lg border border-[#E5E9EF] text-[#17212F] hover:bg-[#F7F8FA] font-medium flex items-center gap-1.5"
            >
              <Upload className="h-3.5 w-3.5 text-[#176B63]" />
              <span>Attach Evidence</span>
            </button>

            {canClose && (
              <button
                onClick={() => onCloseTicket(ticket.id, "Supervisor verified and approved.")}
                className="px-3 py-1.5 rounded-lg bg-[#17212F] text-white font-semibold hover:bg-black transition-all"
              >
                Approve & Close
              </button>
            )}
          </div>
        </div>

        {/* Tab navigation */}
        <div className="px-6 border-b border-[#E5E9EF] flex gap-6 text-xs font-semibold text-[#667085]">
          <button
            onClick={() => setActiveTab("overview")}
            className={`py-2.5 border-b-2 transition-all ${
              activeTab === "overview"
                ? "border-[#176B63] text-[#176B63]"
                : "border-transparent hover:text-[#17212F]"
            }`}
          >
            Overview & Context
          </button>
          <button
            onClick={() => setActiveTab("evidence")}
            className={`py-2.5 border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === "evidence"
                ? "border-[#176B63] text-[#176B63]"
                : "border-transparent hover:text-[#17212F]"
            }`}
          >
            <span>Evidence & AI Report</span>
            {aiJob && (
              <span className="text-[10px] bg-[#E8F3F1] text-[#176B63] px-1 rounded-full">
                1
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("notes")}
            className={`py-2.5 border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === "notes"
                ? "border-[#176B63] text-[#176B63]"
                : "border-transparent hover:text-[#17212F]"
            }`}
          >
            <span>Communication & Notes</span>
            <span className="text-[10px] bg-[#F1F4F9] text-[#17212F] px-1 rounded-full">
              {ticket.notes?.length || 0}
            </span>
          </button>
        </div>

        {/* Body Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {activeTab === "overview" && (
            <div className="space-y-6">
              {/* Title & Description */}
              <div className="space-y-2">
                <h2 className="text-lg font-bold text-[#17212F]">{ticket.title}</h2>
                <p className="text-xs text-[#667085] leading-relaxed bg-[#F7F8FA] p-3.5 rounded-xl border border-[#E5E9EF]">
                  {ticket.description}
                </p>
                {(ticket.voice_transcription || ticket.voice_recording_url) && (
                  <div className="p-3.5 bg-[#F0FDF4] rounded-xl border border-[#BBF7D0] text-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[#16805D] flex items-center gap-1.5">
                        <Volume2 className="h-4 w-4" />
                        <span>Patient Bedside Voice Note</span>
                      </span>
                      <span className="text-[11px] text-[#64748B] font-medium">Recorded at Room</span>
                    </div>
                    {ticket.voice_transcription && (
                      <p className="text-[#17212F] italic bg-white/70 p-2.5 rounded-lg border border-[#DCFCE7]">
                        "{ticket.voice_transcription}"
                      </p>
                    )}
                    {ticket.voice_recording_url && (
                      <div className="pt-1">
                        <audio
                          controls
                          src={getFileUrl(ticket.voice_recording_url)}
                          className="w-full h-8 max-w-md"
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Location & Personnel Meta Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="bg-white p-4 rounded-xl border border-[#E5E9EF] space-y-2.5">
                  <h4 className="font-bold text-[#17212F] uppercase tracking-wider text-[11px] text-[#667085]">
                    Location & Service Context
                  </h4>
                  <div className="flex justify-between py-1 border-b border-[#F1F4F9]">
                    <span className="text-[#667085]">Room Number:</span>
                    <span className="font-semibold text-[#17212F]">{ticket.room_number}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-[#F1F4F9]">
                    <span className="text-[#667085]">Category / Appliance:</span>
                    <span className="font-semibold text-[#17212F]">{ticket.category}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-[#F1F4F9]">
                    <span className="text-[#667085]">Patient Phone:</span>
                    <span className="font-medium text-[#17212F]">
                      {ticket.patient_contact || "Not provided"}
                    </span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-[#667085]">Client Email:</span>
                    <span className="font-medium text-[#17212F] truncate max-w-[180px]">
                      {clientEmail || ticket.patient_email || "Not registered"}
                    </span>
                  </div>
                </div>

                <div className="bg-white p-4 rounded-xl border border-[#E5E9EF] space-y-2.5">
                  <h4 className="font-bold text-[#17212F] uppercase tracking-wider text-[11px] text-[#667085]">
                    Assignment & Operational SLA
                  </h4>
                  <div className="flex justify-between py-1 border-b border-[#F1F4F9]">
                    <span className="text-[#667085]">Assigned Staff:</span>
                    <span className="font-semibold text-[#176B63]">
                      {ticket.assigned_staff_name || "Awaiting Assignment"}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-[#F1F4F9]">
                    <span className="text-[#667085]">Duty Supervisor:</span>
                    <span className="font-semibold text-[#17212F]">
                      {ticket.assigned_supervisor_name || "Operations Lead"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-1">
                    <span className="text-[#667085]">Resolution Target:</span>
                    <span className="font-semibold text-[#17212F] tabular-nums text-right">
                      {ticket.sla_resolution_deadline ? (
                        (() => {
                          const parsed = parseUtcDate(ticket.sla_resolution_deadline);
                          if (!parsed) return "N/A";
                          const targetClock = formatTime(parsed);
                          if (ticket.status === "closed") {
                            return <span className="text-[#16805D]">{targetClock} (Resolved)</span>;
                          }
                          const diffMins = Math.round((parsed.getTime() - Date.now()) / 60000);
                          const durationText = formatDurationHoursMinutes(diffMins);
                          if (diffMins < 0) {
                            return (
                              <span className="text-[#991B1B] font-bold">
                                {targetClock} ({durationText} Overdue)
                              </span>
                            );
                          }
                          return (
                            <span>
                              {targetClock} ({durationText} left)
                            </span>
                          );
                        })()
                      ) : (
                        "N/A"
                      )}
                    </span>
                  </div>
                </div>
              </div>

              {/* Client Email & Direct Follow-up Notification Dispatches */}
              <div className="bg-gradient-to-br from-[#F0F7F6] to-white p-4 rounded-xl border border-[#176B63]/25 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-[#176B63]/10 text-[#176B63]">
                      <Mail className="h-4 w-4" />
                    </div>
                    <div>
                      <h4 className="font-bold text-[#17212F] text-xs">Client / Patient Follow-up Emails</h4>
                      <p className="text-[11px] text-[#667085]">Automated and manual status updates for the client</p>
                    </div>
                  </div>
                  {clientEmail && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#E8F3F1] text-[#176B63]">
                      Email Ready
                    </span>
                  )}
                </div>

                {/* Client Email Input / Display */}
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-[#667085] whitespace-nowrap font-medium">Recipient:</span>
                  {isEditingEmail ? (
                    <div className="flex items-center gap-1.5 flex-1">
                      <input
                        type="email"
                        value={clientEmail}
                        onChange={(e) => setClientEmail(e.target.value)}
                        placeholder="client@gmail.com"
                        className="flex-1 p-1.5 rounded-lg border border-[#176B63] bg-white text-xs focus:outline-none"
                      />
                      <button
                        onClick={handleSaveEmail}
                        disabled={isSavingEmail}
                        className="px-2.5 py-1.5 bg-[#176B63] text-white rounded-lg font-bold text-xs hover:bg-[#10574F] transition-all flex items-center gap-1 cursor-pointer"
                      >
                        {isSavingEmail ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                        <span>Save</span>
                      </button>
                      <button
                        onClick={() => {
                          setClientEmail(ticket.patient_email || "");
                          setIsEditingEmail(false);
                        }}
                        className="px-2 py-1.5 border border-[#E5E9EF] rounded-lg text-xs hover:bg-gray-100 cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between flex-1 bg-white px-2.5 py-1.5 rounded-lg border border-[#E5E9EF]">
                      <span className={`font-mono text-xs ${clientEmail ? "text-[#17212F] font-semibold" : "text-[#94A3B8] italic"}`}>
                        {clientEmail || "No client email configured"}
                      </span>
                      <button
                        onClick={() => setIsEditingEmail(true)}
                        className="text-[#176B63] hover:underline text-[11px] font-bold flex items-center gap-1 cursor-pointer ml-2"
                      >
                        <Edit2 className="h-3 w-3" />
                        <span>{clientEmail ? "Edit" : "+ Add Client Email"}</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Status feedback message */}
                {emailSendStatus && (
                  <div
                    className={`p-2.5 rounded-lg text-xs font-medium flex items-center gap-2 ${
                      emailSendStatus.type === "success"
                        ? "bg-[#EDF7F2] text-[#16805D] border border-[#A6E1CE]"
                        : "bg-[#FEF2F2] text-[#DC2626] border border-[#FCA5A5]"
                    }`}
                  >
                    {emailSendStatus.type === "success" ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertTriangle className="h-4 w-4 shrink-0" />}
                    <span>{emailSendStatus.msg}</span>
                  </div>
                )}

                {/* Fast Follow-up Dispatch Buttons */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  <button
                    onClick={() => handleSendFollowup("work_started")}
                    disabled={isSendingEmail !== null}
                    className="p-2.5 rounded-lg bg-white border border-[#E5E9EF] hover:border-[#176B63] hover:bg-[#F0F7F6] text-left transition-all group cursor-pointer disabled:opacity-50"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-[#17212F] flex items-center gap-1">
                        <Play className="h-3.5 w-3.5 text-[#176B63]" /> Send &quot;Work Started&quot; Email
                      </span>
                      {isSendingEmail === "work_started" ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-[#176B63]" />
                      ) : (
                        <Send className="h-3.5 w-3.5 text-[#667085] group-hover:text-[#176B63]" />
                      )}
                    </div>
                    <p className="text-[10px] text-[#667085] mt-1">Alerts client that technician is on-site and work is in progress</p>
                  </button>

                  <button
                    onClick={() => handleSendFollowup("work_finished")}
                    disabled={isSendingEmail !== null}
                    className="p-2.5 rounded-lg bg-white border border-[#E5E9EF] hover:border-[#16805D] hover:bg-[#EDF7F2] text-left transition-all group cursor-pointer disabled:opacity-50"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-[#17212F] flex items-center gap-1">
                        <CheckCircle2 className="h-3.5 w-3.5 text-[#16805D]" /> Send &quot;Work Finished&quot; Email
                      </span>
                      {isSendingEmail === "work_finished" ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-[#16805D]" />
                      ) : (
                        <Send className="h-3.5 w-3.5 text-[#667085] group-hover:text-[#16805D]" />
                      )}
                    </div>
                    <p className="text-[10px] text-[#667085] mt-1">Sends completion confirmation, repair details &amp; feedback link</p>
                  </button>
                </div>
              </div>

              {/* Resolution Report if submitted */}
              {ticket.resolution_summary && (
                <div className="p-4 rounded-xl bg-[#EDF7F2] border border-[#A6E1CE] space-y-2 text-xs">
                  <div className="flex items-center gap-2 font-bold text-[#16805D]">
                    <CheckCircle2 className="h-4 w-4" />
                    <span>Submitted Work Resolution Summary</span>
                  </div>
                  <p className="text-[#17212F]">{ticket.resolution_summary}</p>
                  {ticket.parts_replaced && (
                    <div className="text-[11px] text-[#667085]">
                      <strong>Parts Replaced:</strong> {ticket.parts_replaced}
                    </div>
                  )}
                  {ticket.functional_test_notes && (
                    <div className="text-[11px] text-[#667085]">
                      <strong>Functional Checks:</strong> {ticket.functional_test_notes}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === "evidence" && (
            <div className="space-y-6">
              {/* Evidence side-by-side comparison */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* BEFORE REPAIR */}
                <div className="bg-[#F7F8FA] border border-[#E5E9EF] rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs uppercase tracking-wider text-[#667085]">
                      Before Repair
                    </span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-[#FEF7EC] text-[#B7791F]">
                      Baseline Fault
                    </span>
                  </div>
                  {beforeEvidence ? (
                    <div className="space-y-2">
                      <div className="h-44 rounded-lg bg-black/5 flex items-center justify-center overflow-hidden border border-[#E5E9EF] relative group">
                        {beforeEvidence.media_type === "video" ? (
                          <div className="text-center p-4">
                            <Play className="h-8 w-8 text-[#176B63] mx-auto mb-1" />
                            <span className="text-[11px] text-[#667085] block font-mono">
                              Video Recording ({Math.round(beforeEvidence.file_size_bytes / 1024 / 1024)}MB)
                            </span>
                          </div>
                        ) : (
                          <img
                            src={getFileUrl(beforeEvidence.file_url)}
                            alt="Before Repair"
                            className="w-full h-full object-cover transition-transform group-hover:scale-105 duration-200"
                            onError={(e) => {
                              const target = e.currentTarget;
                              if (!target.dataset.fallback && beforeEvidence.file_url) {
                                target.dataset.fallback = "true";
                                target.src = beforeEvidence.file_url;
                              }
                            }}
                          />
                        )}
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <p className="text-[#667085] truncate">{beforeEvidence.notes || "Baseline evidence captured."}</p>
                        {beforeEvidence.media_type !== "video" && (
                          <a
                            href={getFileUrl(beforeEvidence.file_url)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 font-bold text-[#176B63] hover:underline shrink-0 ml-2"
                            title="Open full size"
                          >
                            <ExternalLink className="h-3 w-3" />
                            <span>View Full</span>
                          </a>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="h-44 border-2 border-dashed border-[#E5E9EF] rounded-lg flex flex-col items-center justify-center text-[#98A2B3] text-xs">
                      <span>No pre-repair media attached.</span>
                    </div>
                  )}
                </div>

                {/* AFTER REPAIR */}
                <div className="bg-[#F7F8FA] border border-[#E5E9EF] rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs uppercase tracking-wider text-[#667085]">
                      After Repair
                    </span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-[#EDF7F2] text-[#16805D]">
                      Verification Proof
                    </span>
                  </div>
                  {afterEvidence ? (
                    <div className="space-y-2">
                      <div className="h-44 rounded-lg bg-black/5 flex items-center justify-center overflow-hidden border border-[#E5E9EF] relative group">
                        {afterEvidence.media_type === "video" ? (
                          <div className="text-center p-4">
                            <Play className="h-8 w-8 text-[#16805D] mx-auto mb-1" />
                            <span className="text-[11px] text-[#667085] block font-mono">
                              Verification Video ({Math.round(afterEvidence.file_size_bytes / 1024 / 1024)}MB)
                            </span>
                          </div>
                        ) : (
                          <img
                            src={getFileUrl(afterEvidence.file_url)}
                            alt="After Repair"
                            className="w-full h-full object-cover transition-transform group-hover:scale-105 duration-200"
                            onError={(e) => {
                              const target = e.currentTarget;
                              if (!target.dataset.fallback && afterEvidence.file_url) {
                                target.dataset.fallback = "true";
                                target.src = afterEvidence.file_url;
                              }
                            }}
                          />
                        )}
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <p className="text-[#667085] truncate">{afterEvidence.notes || "Post-repair verification media."}</p>
                        {afterEvidence.media_type !== "video" && (
                          <a
                            href={getFileUrl(afterEvidence.file_url)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 font-bold text-[#16805D] hover:underline shrink-0 ml-2"
                            title="Open full size"
                          >
                            <ExternalLink className="h-3 w-3" />
                            <span>View Full</span>
                          </a>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="h-44 border-2 border-dashed border-[#E5E9EF] rounded-lg flex flex-col items-center justify-center text-[#98A2B3] text-xs">
                      <span>Awaiting post-repair evidence from technician.</span>
                    </div>
                  )}
                </div>
              </div>

              {/* AI Verification Report Card */}
              {aiJob ? (
                <div className="p-5 rounded-xl border border-[#A7D7D1] bg-[#F4FAF9] space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-[#176B63] text-white">
                        <Sparkles className="h-4 w-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-[#17212F]">
                          CareOps Vision AI Diagnostics Report
                        </h4>
                        <span className="text-[10px] text-[#667085]">
                          Model: {aiJob.model_version} • Evaluated via temporal frame analysis
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-bold px-2 py-0.5 rounded bg-[#176B63] text-white uppercase tracking-wider">
                        {aiJob.ai_recommendation.replace("_", " ")}
                      </span>
                      <div className="text-[10px] text-[#667085] mt-0.5 tabular-nums">
                        Confidence: {Math.round(aiJob.confidence_score * 100)}%
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div className="bg-white p-2.5 rounded-lg border border-[#E5E9EF]">
                      <span className="text-[#667085] text-[10px] block">Equipment Match</span>
                      <strong className="text-[#17212F] capitalize">
                        {aiJob.equipment_match.replace("_", " ")}
                      </strong>
                    </div>
                    <div className="bg-white p-2.5 rounded-lg border border-[#E5E9EF]">
                      <span className="text-[#667085] text-[10px] block">Fault Status</span>
                      <strong className="text-[#17212F] capitalize">
                        {aiJob.visible_fault_assessment.replace("_", " ")}
                      </strong>
                    </div>
                    <div className="bg-white p-2.5 rounded-lg border border-[#E5E9EF]">
                      <span className="text-[#667085] text-[10px] block">Motion / Flow</span>
                      <strong className="text-[#17212F] capitalize">
                        {aiJob.after_repair_functional_evidence.replace("_", " ")}
                      </strong>
                    </div>
                    <div className="bg-white p-2.5 rounded-lg border border-[#E5E9EF]">
                      <span className="text-[#667085] text-[10px] block">Review Policy</span>
                      <strong className="text-[#17212F] capitalize">
                        {aiJob.review_requirement.replace("_", " ")}
                      </strong>
                    </div>
                  </div>

                  <p className="text-xs text-[#17212F] leading-relaxed bg-white p-3 rounded-lg border border-[#E5E9EF]">
                    {aiJob.analysis_notes}
                  </p>
                </div>
              ) : (
                <div className="p-6 text-center text-xs text-[#667085] bg-[#F7F8FA] rounded-xl border border-[#E5E9EF]">
                  <span>AI analysis runs automatically when both pre- and post-repair evidence are submitted.</span>
                </div>
              )}
            </div>
          )}

          {activeTab === "notes" && (
            <div className="space-y-4">
              <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                {ticket.notes && ticket.notes.length > 0 ? (
                  ticket.notes.map((note) => (
                    <div
                      key={note.id}
                      className={`p-3 rounded-xl border text-xs space-y-1 ${
                        note.is_internal
                          ? "bg-[#FEF7EC] border-[#FAD7A0]"
                          : "bg-[#F7F8FA] border-[#E5E9EF]"
                      }`}
                    >
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-semibold text-[#17212F] flex items-center gap-1.5">
                          {note.is_internal ? (
                            <Lock className="h-3 w-3 text-[#B7791F]" />
                          ) : (
                            <Globe className="h-3 w-3 text-[#176B63]" />
                          )}
                          <span>{note.author_name}</span>
                          <span className="font-normal text-[#667085]">
                            ({note.is_internal ? "Internal Staff Note" : "Patient-Visible Update"})
                          </span>
                        </span>
                        <span className="text-[#98A2B3] tabular-nums font-medium">
                          {formatTime(note.created_at)}
                        </span>
                      </div>
                      <p className="text-[#17212F]">{note.content}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-[#667085] text-center py-4">No notes recorded yet.</p>
                )}
              </div>

              {/* Add Note Form */}
              <form onSubmit={handleSendNote} className="pt-3 border-t border-[#E5E9EF] space-y-2">
                <div className="flex items-center gap-4 text-xs">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="note_privacy"
                      checked={isInternalNote}
                      onChange={() => setIsInternalNote(true)}
                    />
                    <span className="font-semibold text-[#B7791F]">Internal Only (Private)</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="note_privacy"
                      checked={!isInternalNote}
                      onChange={() => setIsInternalNote(false)}
                    />
                    <span className="font-semibold text-[#176B63]">Patient Visible (Public)</span>
                  </label>
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder={
                      isInternalNote
                        ? "Log technical note, parts status, internal handoff..."
                        : "Send reassuring progress update visible to patient..."
                    }
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-lg border border-[#E5E9EF] text-xs text-[#17212F] focus:outline-none focus:border-[#176B63]"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-lg bg-[#176B63] hover:bg-[#10574F] text-white text-xs font-semibold flex items-center gap-1.5"
                  >
                    <Send className="h-3.5 w-3.5" />
                    <span>Post</span>
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>

      {/* Resolution Submission Modal */}
      {showResModal && (
        <div className="fixed inset-0 z-60 bg-black/50 flex items-center justify-center p-4">
          <form
            onSubmit={handleResolveSubmit}
            className="bg-white rounded-xl max-w-md w-full p-6 border border-[#E5E9EF] shadow-xl space-y-4 text-xs"
          >
            <div className="flex items-center justify-between border-b pb-3 border-[#E5E9EF]">
              <h3 className="font-bold text-sm text-[#17212F]">Submit Repair Resolution</h3>
              <button
                type="button"
                onClick={() => setShowResModal(false)}
                className="text-[#667085] hover:text-black"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-1">
              <label className="font-semibold text-[#17212F]">Work Summary *</label>
              <textarea
                required
                rows={3}
                placeholder="Details of repair work completed..."
                value={resSummary}
                onChange={(e) => setResSummary(e.target.value)}
                className="w-full p-2.5 rounded-lg border border-[#E5E9EF] focus:outline-none focus:border-[#176B63]"
              />
            </div>
            <div className="space-y-1">
              <label className="font-semibold text-[#17212F]">Parts Replaced (Optional)</label>
              <input
                type="text"
                placeholder="e.g. 3.15uF Capacitor, Ball bearing"
                value={resParts}
                onChange={(e) => setResParts(e.target.value)}
                className="w-full p-2 rounded-lg border border-[#E5E9EF] focus:outline-none focus:border-[#176B63]"
              />
            </div>
            <div className="space-y-1">
              <label className="font-semibold text-[#17212F]">Functional Test Notes (Optional)</label>
              <input
                type="text"
                placeholder="e.g. Tested at Step 5 for 10 minutes without heat buildup"
                value={resNotes}
                onChange={(e) => setResNotes(e.target.value)}
                className="w-full p-2 rounded-lg border border-[#E5E9EF] focus:outline-none focus:border-[#176B63]"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowResModal(false)}
                className="px-3 py-1.5 rounded-lg border border-[#E5E9EF] hover:bg-[#F7F8FA]"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded-lg bg-[#16805D] text-white font-semibold hover:bg-[#116348]"
              >
                Submit Resolution
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Upload Evidence Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-60 bg-black/50 flex items-center justify-center p-4">
          <form
            onSubmit={handleFileUpload}
            className="bg-white rounded-xl max-w-sm w-full p-5 border border-[#E5E9EF] shadow-xl space-y-4 text-xs"
          >
            <div className="flex items-center justify-between border-b pb-2 border-[#E5E9EF]">
              <h3 className="font-bold text-sm text-[#17212F]">Upload Verification Evidence</h3>
              <button
                type="button"
                onClick={() => setShowUploadModal(false)}
                className="text-[#667085] hover:text-black"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-1">
              <label className="font-semibold text-[#17212F]">Stage *</label>
              <select
                value={uploadStage}
                onChange={(e) => setUploadStage(e.target.value as "before" | "after")}
                className="w-full p-2 rounded-lg border border-[#E5E9EF]"
              >
                <option value="before">Before Repair (Baseline fault)</option>
                <option value="after">After Repair (Operational proof)</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="font-semibold text-[#17212F]">Select Photo or Video File *</label>
              <input
                required
                type="file"
                accept="image/*,video/*"
                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                className="w-full p-2 border rounded-lg border-[#E5E9EF]"
              />
              <span className="text-[10px] text-[#667085] block">
                Supports MP4, WebM, PNG, JPG up to 50MB.
              </span>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowUploadModal(false)}
                className="px-3 py-1.5 rounded-lg border border-[#E5E9EF]"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded-lg bg-[#176B63] text-white font-semibold"
              >
                Upload File
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
