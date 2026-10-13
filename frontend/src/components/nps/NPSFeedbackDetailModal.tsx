"use client";

import React, { useState } from "react";
import {
  X,
  MapPin,
  QrCode,
  Phone,
  MessageSquare,
  AlertTriangle,
  CheckCircle2,
  Clock,
  User as UserIcon,
  Ticket as TicketIcon,
  Building2,
  ShieldCheck,
  Send,
  Save,
  Check,
  ExternalLink,
  Sparkles,
  Smartphone
} from "lucide-react";
import { api, formatDateTime } from "@/lib/api";

export interface NPSFeedbackItem {
  id: number;
  ticket_id: number | null;
  ticket_number?: string;
  ticket_title?: string;
  ticket_description?: string;
  department_id?: string;
  department_name?: string;
  room_number: string;
  source?: string;
  patient_contact?: string | null;
  assigned_staff_name?: string | null;
  emoji_rating: string;
  nps_score: number | null;
  feedback_comment: string | null;
  investigation_notes?: string | null;
  corrective_action?: string | null;
  resolution_status?: string | null;
  resolved_by?: string | null;
  resolved_at?: string | null;
  is_critical?: boolean;
  created_at: string;
}

interface NPSFeedbackDetailModalProps {
  feedback: NPSFeedbackItem;
  currentUser: any;
  onClose: () => void;
  onRefresh: () => void;
}

export function NPSFeedbackDetailModal({
  feedback,
  currentUser,
  onClose,
  onRefresh,
}: NPSFeedbackDetailModalProps) {
  const [investigationNotes, setInvestigationNotes] = useState(feedback.investigation_notes || "");
  const [correctiveAction, setCorrectiveAction] = useState(feedback.corrective_action || "");
  const [resolutionStatus, setResolutionStatus] = useState(feedback.resolution_status || (feedback.is_critical ? "critical_attention" : "acknowledged"));
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const isStaff = currentUser?.role === "staff";

  const handleSaveAction = async () => {
    setIsSaving(true);
    try {
      await api.updateNPSAction(feedback.id, {
        investigation_notes: investigationNotes,
        corrective_action: correctiveAction,
        resolution_status: resolutionStatus,
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
      onRefresh();
    } catch (err: any) {
      alert(`Failed to save feedback action: ${err.message || err}`);
    } finally {
      setIsSaving(false);
    }
  };

  const getSourceDisplay = () => {
    if (feedback.source) return feedback.source;
    if (feedback.room_number) return `Bedside QR Placard (${feedback.room_number})`;
    return "Patient Voice Portal";
  };

  const cleanPhone = feedback.patient_contact?.replace(/[^0-9+]/g, "") || "";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-6 max-h-[92vh] flex flex-col">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className={`h-10 w-10 rounded-xl flex items-center justify-center font-bold text-lg border ${
              feedback.emoji_rating === "happy" 
                ? "bg-emerald-50 border-emerald-200 text-emerald-600" 
                : feedback.emoji_rating === "unhappy" 
                ? "bg-rose-50 border-rose-200 text-rose-600" 
                : "bg-amber-50 border-amber-200 text-amber-600"
            }`}>
              {feedback.emoji_rating === "happy" ? "😊" : feedback.emoji_rating === "unhappy" ? "😞" : "😐"}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900">
                  Patient Voice & Experience Detail
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-[10px] font-bold border border-indigo-200">
                  ID #{feedback.id}
                </span>
                {feedback.is_critical && (
                  <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 text-[10px] font-bold flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" /> Critical Attention
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Submitted {formatDateTime(feedback.created_at)} • Verified Patient Record
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6 overflow-y-auto">
          {/* Top Info Banner: Room & Origin Source Highlight */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Room Identifier Card */}
            <div className="p-4 rounded-xl bg-gradient-to-br from-blue-50/80 to-indigo-50/50 border border-blue-200/80">
              <div className="flex items-center gap-2 text-xs font-semibold text-blue-800 uppercase tracking-wider mb-1">
                <MapPin className="h-4 w-4 text-blue-600" />
                <span>Room & Bed Origin</span>
              </div>
              <div className="text-xl font-black text-slate-900 tracking-tight">
                {feedback.room_number || "Bedside Placard"}
              </div>
              <p className="text-xs text-slate-600 mt-1">
                Inpatient Department: <strong className="text-slate-800">{feedback.department_name || feedback.department_id || "General"}</strong>
              </p>
            </div>

            {/* Source Verification Card */}
            <div className="p-4 rounded-xl bg-gradient-to-br from-emerald-50/80 to-teal-50/50 border border-emerald-200/80">
              <div className="flex items-center gap-2 text-xs font-semibold text-emerald-800 uppercase tracking-wider mb-1">
                <QrCode className="h-4 w-4 text-emerald-600" />
                <span>Detailed Feedback Source</span>
              </div>
              <div className="text-base font-bold text-slate-900">
                {getSourceDisplay()}
              </div>
              <p className="text-xs text-slate-600 mt-1 flex items-center gap-1">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 inline shrink-0" />
                Physical QR Stand or verified tracking link
              </p>
            </div>
          </div>

          {/* Patient Review Content & NPS Rating */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Patient Feedback & Sentiment
              </span>
              <div className="flex items-center gap-2">
                <span className={`px-2.5 py-1 rounded-lg text-xs font-bold uppercase flex items-center gap-1.5 ${
                  feedback.emoji_rating === "happy"
                    ? "bg-emerald-100 text-emerald-800"
                    : feedback.emoji_rating === "unhappy"
                    ? "bg-rose-100 text-rose-800"
                    : "bg-amber-100 text-amber-800"
                }`}>
                  <span>{feedback.emoji_rating === "happy" ? "😊" : feedback.emoji_rating === "unhappy" ? "😞" : "😐"}</span>
                  <span>{feedback.emoji_rating} Experience</span>
                </span>

                {feedback.nps_score !== null && (
                  <span className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold ${
                    feedback.nps_score >= 9
                      ? "bg-emerald-100 text-emerald-800"
                      : feedback.nps_score >= 7
                      ? "bg-amber-100 text-amber-800"
                      : "bg-rose-100 text-rose-800"
                  }`}>
                    NPS Score: {feedback.nps_score} / 10
                  </span>
                )}
              </div>
            </div>

            <div className="bg-white p-3.5 rounded-lg border border-slate-200 text-sm text-slate-800 leading-relaxed italic">
              {feedback.feedback_comment ? `“${feedback.feedback_comment}”` : <span className="text-slate-400 not-italic">No additional comment text submitted.</span>}
            </div>
          </div>

          {/* Linked Ticket & Assigned Staff */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <TicketIcon className="h-4 w-4 text-slate-600" />
                Linked Service Request & Operations Context
              </span>
              {feedback.ticket_number && (
                <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-mono text-xs font-bold">
                  {feedback.ticket_number}
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Service Request Title</span>
                <span className="font-semibold text-slate-900 mt-0.5 block">
                  {feedback.ticket_title || "Bedside Service Assistance"}
                </span>
                {feedback.ticket_description && (
                  <p className="text-slate-600 text-[11px] mt-1 line-clamp-2">
                    {feedback.ticket_description}
                  </p>
                )}
              </div>

              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100 flex flex-col justify-between">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Assigned Staff Specialist</span>
                  <span className="font-semibold text-slate-900 mt-0.5 block flex items-center gap-1.5">
                    <UserIcon className="h-3.5 w-3.5 text-indigo-500" />
                    {feedback.assigned_staff_name || "Assigned Duty Nurse / Specialist"}
                  </span>
                </div>
                <div className="text-[11px] text-slate-500 mt-2">
                  Department: <span className="font-bold text-slate-700 capitalize">{feedback.department_name || feedback.department_id}</span>
                </div>
              </div>
            </div>

            {/* Patient Contact & Direct Outreach */}
            {feedback.patient_contact && (
              <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div className="flex items-center gap-2 text-xs text-slate-600">
                  <Phone className="h-3.5 w-3.5 text-slate-400" />
                  <span>Patient Contact: <strong className="text-slate-900 font-mono">{feedback.patient_contact}</strong></span>
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href={`tel:${cleanPhone}`}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition"
                  >
                    <Phone className="h-3 w-3" />
                    Call Patient
                  </a>
                  <a
                    href={`https://wa.me/${cleanPhone.replace("+", "")}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-semibold transition"
                  >
                    <MessageSquare className="h-3 w-3 text-emerald-600" />
                    WhatsApp
                  </a>
                </div>
              </div>
            )}
          </div>

          {/* Supervisor Investigation & Action Section */}
          <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-indigo-600" />
                Supervisor Root-Cause Investigation & Action
              </span>

              <select
                value={resolutionStatus}
                onChange={(e) => setResolutionStatus(e.target.value)}
                disabled={isStaff}
                className="text-xs bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-slate-700 font-medium focus:outline-none focus:border-indigo-500"
              >
                <option value="new">New Submission</option>
                <option value="critical_attention">Critical Attention Required</option>
                <option value="investigating">Under Clinical Investigation</option>
                <option value="action_taken">Corrective Action Taken</option>
                <option value="resolved">Resolved & Closed</option>
              </select>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                  Root-Cause Investigation Notes
                </label>
                <textarea
                  value={investigationNotes}
                  onChange={(e) => setInvestigationNotes(e.target.value)}
                  disabled={isStaff}
                  rows={2}
                  placeholder="Record supervisor investigation findings (e.g. Linen supply delay during shift change, Room 302 call bell verified)..."
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-indigo-500 text-slate-800 disabled:bg-slate-100"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                  Corrective Action Plan (CAP)
                </label>
                <textarea
                  value={correctiveAction}
                  onChange={(e) => setCorrectiveAction(e.target.value)}
                  disabled={isStaff}
                  rows={2}
                  placeholder="Specific operational intervention taken (e.g. Dispatched additional warm linens immediately, reassigned floor supervisor)..."
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-indigo-500 text-slate-800 disabled:bg-slate-100"
                />
              </div>
            </div>

            {!isStaff && (
              <div className="flex items-center justify-end gap-2 pt-2">
                {saveSuccess && (
                  <span className="text-xs text-emerald-600 font-bold flex items-center gap-1">
                    <Check className="h-3.5 w-3.5" /> Action notes saved successfully
                  </span>
                )}
                <button
                  onClick={handleSaveAction}
                  disabled={isSaving}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition cursor-pointer disabled:opacity-50"
                >
                  <Save className="h-3.5 w-3.5" />
                  {isSaving ? "Saving..." : "Save Supervisor Action"}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <span className="text-[11px] text-slate-400">
            CareOps Patient Experience Audit Registry
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-xs font-semibold text-slate-700 transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
