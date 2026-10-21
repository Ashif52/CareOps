"use client";

import React, { useState, useEffect } from "react";
import {
  Smile,
  Meh,
  Frown,
  TrendingUp,
  Download,
  Filter,
  RefreshCw,
  AlertTriangle,
  HeartHandshake,
  Building2,
  Calendar,
  MessageSquare,
  Sparkles,
  ChevronRight,
  MapPin,
  QrCode,
  Search,
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
  Clock,
  LayoutGrid,
  List,
  BarChart3,
  Phone
} from "lucide-react";
import { api, formatDateTime, getApiBase } from "@/lib/api";
import { NPSFeedbackDetailModal, NPSFeedbackItem } from "./NPSFeedbackDetailModal";
import { HospitalFeedbackQRModal } from "./HospitalFeedbackQRModal";
import { QRCodeSVG } from "qrcode.react";

interface NPSDashboardData {
  tagline: string;
  total_responses: number;
  response_rate_pct: number;
  emoji_satisfaction: {
    happy_count: number;
    okay_count: number;
    unhappy_count: number;
    happy_pct: number;
    okay_pct: number;
    unhappy_pct: number;
  };
  formal_nps: {
    score: number;
    total_rated: number;
    promoters: number;
    passives: number;
    detractors: number;
    promoter_pct: number;
    detractor_pct: number;
    passive_pct: number;
  };
  departments: Array<{
    department_id: string;
    department_name: string;
    total_responses: number;
    satisfaction_pct: number;
    formal_nps: number | null;
    critical_count: number;
  }>;
  trend_7d: Array<{
    date: string;
    happy: number;
    okay: number;
    unhappy: number;
    total: number;
  }>;
  critical_alerts: NPSFeedbackItem[];
}

export function NPSModuleView({ currentUser }: { currentUser: any }) {
  const [dashboard, setDashboard] = useState<NPSDashboardData | null>(null);
  const [responses, setResponses] = useState<NPSFeedbackItem[]>([]);
  const [selectedDept, setSelectedDept] = useState<string>("");
  const [selectedEmoji, setSelectedEmoji] = useState<string>("");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  
  // Default to reviews feed view with NO graphs
  const [activeTab, setActiveTab] = useState<"reviews" | "analytics">("reviews");
  const [viewLayout, setViewLayout] = useState<"cards" | "table">("cards");
  const [selectedFeedbackModal, setSelectedFeedbackModal] = useState<NPSFeedbackItem | null>(null);
  const [showMasterQRModal, setShowMasterQRModal] = useState(false);
  const [feedbackURL, setFeedbackURL] = useState("http://localhost:3000/feedback");

  useEffect(() => {
    if (typeof window !== "undefined") {
      setFeedbackURL(`${window.location.origin}/feedback`);
    }
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const dashRes: any = await api.getNPSDashboard(selectedDept || undefined);
      setDashboard(dashRes);

      const listRes: any = await api.getNPSResponses({
        department_id: selectedDept || undefined,
        emoji_rating: selectedEmoji || undefined,
        limit: 100,
      });
      if (listRes && Array.isArray(listRes.items)) {
        setResponses(listRes.items);
      }
    } catch (err: any) {
      console.error("Failed to load NPS data:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedDept, selectedEmoji]);

  const handleExportCSV = () => {
    const base = getApiBase();
    const url = `${base}/nps/export${selectedDept ? `?department_id=${selectedDept}` : ""}`;
    window.open(url, "_blank");
  };

  const filteredResponses = responses.filter((item) => {
    if (selectedStatus === "critical" && !item.is_critical) return false;
    if (selectedStatus === "resolved" && item.resolution_status !== "resolved") return false;
    if (selectedStatus === "action_taken" && item.resolution_status !== "action_taken") return false;

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      const matchRoom = (item.room_number || "").toLowerCase().includes(q);
      const matchComment = (item.feedback_comment || "").toLowerCase().includes(q);
      const matchTicket = (item.ticket_number || "").toLowerCase().includes(q);
      const matchDept = (item.department_name || item.department_id || "").toLowerCase().includes(q);
      const matchSource = (item.source || "").toLowerCase().includes(q);
      const matchContact = (item.patient_contact || "").toLowerCase().includes(q);
      if (!matchRoom && !matchComment && !matchTicket && !matchDept && !matchSource && !matchContact) {
        return false;
      }
    }

    return true;
  });

  const emojiStats = dashboard?.emoji_satisfaction || {
    happy_count: 0,
    okay_count: 0,
    unhappy_count: 0,
    happy_pct: 0,
    okay_pct: 0,
    unhappy_pct: 0,
  };

  const formalNps = dashboard?.formal_nps || {
    score: 0,
    total_rated: 0,
    promoters: 0,
    passives: 0,
    detractors: 0,
    promoter_pct: 0,
    detractor_pct: 0,
    passive_pct: 0,
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Detail Inspection Modal */}
      {selectedFeedbackModal && (
        <NPSFeedbackDetailModal
          feedback={selectedFeedbackModal}
          currentUser={currentUser}
          onClose={() => setSelectedFeedbackModal(null)}
          onRefresh={loadData}
        />
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#E5E9EF] pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-[#EEF4FD] rounded-xl text-[#3868C9]">
              <HeartHandshake className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-[#17212F] flex items-center gap-2">
                NPS & Patient Experience
                <span className="px-2 py-0.5 rounded-full bg-[#16805D]/10 text-[#16805D] text-[10px] font-bold uppercase tracking-wider">
                  Patient Voice Center
                </span>
              </h1>
              <p className="text-xs text-[#667085] mt-0.5 font-medium italic">
                “Every patient voice. Every improvement.”
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Tab Selection: Default is Reviews Feed (No Graph) */}
          <div className="flex items-center bg-[#F7F8FA] border border-[#E5E9EF] rounded-lg p-0.5">
            <button
              onClick={() => setActiveTab("reviews")}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === "reviews"
                  ? "bg-white text-[#17212F] shadow-xs"
                  : "text-[#667085] hover:text-[#17212F]"
              }`}
            >
              <MessageSquare className="h-3.5 w-3.5" />
              Patient Reviews ({filteredResponses.length})
            </button>
            <button
              onClick={() => setActiveTab("analytics")}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === "analytics"
                  ? "bg-white text-[#17212F] shadow-xs"
                  : "text-[#667085] hover:text-[#17212F]"
              }`}
            >
              <BarChart3 className="h-3.5 w-3.5" />
              Analytics & Trends
            </button>
          </div>

          <button
            onClick={() => setShowMasterQRModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#176B63] hover:bg-[#125852] text-white rounded-lg text-xs font-bold transition shadow-xs cursor-pointer"
            title="Generate &amp; Print Hospital Master Feedback QR"
          >
            <QrCode className="h-3.5 w-3.5" />
            <span>Hospital Feedback QR</span>
          </button>

          <button
            onClick={handleExportCSV}
            className="inline-flex items-center gap-1 px-3 py-1.5 bg-white hover:bg-[#F7F8FA] border border-[#E5E9EF] rounded-lg text-xs font-semibold text-[#344054] transition cursor-pointer"
            title="Download CSV export"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={loadData}
            disabled={isLoading}
            className="p-2 bg-white hover:bg-[#F7F8FA] border border-[#E5E9EF] rounded-lg text-[#667085] hover:text-[#17212F] transition cursor-pointer"
            title="Refresh"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Hospital Master Feedback QR Code Modal */}
      <HospitalFeedbackQRModal
        isOpen={showMasterQRModal}
        onClose={() => setShowMasterQRModal(false)}
      />

      {/* Hospital Master Feedback QR Banner (Distinct from Room Bedside QRs) */}
      <div className="bg-gradient-to-r from-[#0D3833] via-[#176B63] to-[#115049] text-white rounded-3xl p-5 sm:p-6 shadow-xl flex flex-col md:flex-row items-center justify-between gap-6 border border-emerald-500/30">
        <div className="space-y-2.5 max-w-2xl">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-950/70 border border-emerald-400/30 text-emerald-300 text-[11px] font-bold">
            <QrCode className="h-3.5 w-3.5" />
            <span>Hospital Master Feedback QR &bull; Distinct from Room Bedside Complaint QRs</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white">
            Hospital-Wide Patient &amp; Visitor Experience QR
          </h2>
          <p className="text-xs text-emerald-100/90 leading-relaxed font-normal">
            Generate and print this Master QR standee for Hospital Reception, OPD Waiting Areas, Billing Counters, and Discharge Desks. Patients and attendants scan to submit overall hospital satisfaction, 3-emoji sentiment, and NPS ratings without filing a maintenance or service complaint.
          </p>
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              type="button"
              onClick={() => setShowMasterQRModal(true)}
              className="px-4 py-2.5 rounded-xl bg-white text-[#176B63] hover:bg-emerald-50 font-black text-xs shadow-md transition-all cursor-pointer flex items-center gap-2"
            >
              <QrCode className="h-4 w-4" />
              <span>Generate &amp; Print Standee Placard</span>
            </button>
            <a
              href="/feedback"
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs border border-white/20 transition-all cursor-pointer flex items-center gap-1.5"
            >
              <span>Preview Visitor Experience (/feedback)</span>
              <ExternalLink className="h-3.5 w-3.5 text-emerald-200" />
            </a>
          </div>
        </div>

        {/* Live Scannable Mini QR Card */}
        <div
          onClick={() => setShowMasterQRModal(true)}
          className="bg-white p-3.5 rounded-2xl shadow-xl border-2 border-emerald-400/40 cursor-pointer hover:scale-105 transition-all shrink-0 text-center group"
          title="Click to enlarge &amp; print"
        >
          <QRCodeSVG value={feedbackURL} size={110} level="H" includeMargin={false} />
          <div className="mt-1.5 flex items-center justify-center gap-1 text-[10px] font-black text-[#176B63] uppercase tracking-wider group-hover:underline">
            <QrCode className="h-3 w-3" />
            <span>Tap to Print</span>
          </div>
        </div>
      </div>

      {/* Critical Patient Feedback Banner */}
      {dashboard?.critical_alerts && dashboard.critical_alerts.length > 0 && (
        <div className="bg-[#FEF3F2] border border-[#FECDCA] rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-2 text-[#B42318] text-xs font-bold">
              <AlertTriangle className="h-4 w-4" />
              <span>{dashboard.critical_alerts.length} Critical Low-Satisfaction Alert(s) Detected</span>
            </div>
            <span className="text-[11px] text-[#B42318] font-semibold">Immediate Supervisor Action Required</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {dashboard.critical_alerts.slice(0, 2).map((alertItem) => (
              <div
                key={alertItem.id}
                onClick={() => setSelectedFeedbackModal(alertItem)}
                className="bg-white p-3 rounded-xl border border-[#FECDCA] hover:border-rose-400 hover:shadow-md transition cursor-pointer text-xs flex items-start gap-3 group"
              >
                <div className="p-2 rounded-lg bg-[#FEF3F2] text-[#B42318] font-bold text-base shrink-0">
                  {alertItem.emoji_rating === "unhappy" ? "😞" : "⚠️"}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-bold text-[#17212F] flex items-center gap-1.5">
                      <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 text-[11px] font-bold border border-blue-200 flex items-center gap-1">
                        <MapPin className="h-3 w-3 text-blue-600" />
                        {alertItem.room_number || "Room-302"}
                      </span>
                      <span className="text-slate-400 font-normal">({alertItem.ticket_number})</span>
                    </span>
                    <span className="text-[10px] text-[#667085] font-mono shrink-0">
                      {formatDateTime(alertItem.created_at)}
                    </span>
                  </div>

                  <p className="text-[11px] text-[#475467] line-clamp-2 mt-1 italic">
                    “{alertItem.feedback_comment || "No comment provided."}”
                  </p>

                  <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-slate-100 text-[10px]">
                    <div className="flex items-center gap-2 text-[#667085]">
                      <span className="flex items-center gap-1 text-emerald-700 font-medium">
                        <QrCode className="h-3 w-3" />
                        {alertItem.source || `Bedside QR Placard (${alertItem.room_number})`}
                      </span>
                      {alertItem.nps_score !== null && (
                        <span className="font-bold text-[#B42318] bg-rose-50 px-1.5 py-0.2 rounded border border-rose-200">
                          Score: {alertItem.nps_score}/10
                        </span>
                      )}
                    </div>
                    <span className="text-indigo-600 font-semibold group-hover:underline flex items-center gap-0.5">
                      Inspect & Action <ChevronRight className="h-3 w-3" />
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top 4 KPI Metrics Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Overall Satisfaction */}
        <div className="bg-white p-4 rounded-xl border border-[#E5E9EF] shadow-xs space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#667085]">Overall Patient Satisfaction</span>
            <span className="text-lg">😊</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-[#17212F]">{emojiStats.happy_pct}%</span>
            <span className="text-xs text-[#16805D] font-semibold">Positive Experience</span>
          </div>
          <div className="w-full bg-[#F2F4F7] h-1.5 rounded-full overflow-hidden">
            <div className="bg-[#16805D] h-full" style={{ width: `${emojiStats.happy_pct}%` }} />
          </div>
          <span className="text-[11px] text-[#667085] block">
            {emojiStats.happy_count} Happy of {dashboard?.total_responses || 0} respondents
          </span>
        </div>

        {/* KPI 2: Formal Net Promoter Score */}
        <div className="bg-white p-4 rounded-xl border border-[#E5E9EF] shadow-xs space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#667085]">Formal NPS Score (0-10)</span>
            <span className="text-[10px] font-bold text-[#3868C9] bg-[#EEF4FD] px-1.5 py-0.5 rounded">
              Standard NPS
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className={`text-2xl font-bold ${formalNps.score >= 50 ? "text-[#16805D]" : formalNps.score >= 0 ? "text-[#3868C9]" : "text-[#DC2626]"}`}>
              {formalNps.score > 0 ? `+${formalNps.score}` : formalNps.score}
            </span>
            <span className="text-xs text-[#667085]">Score (-100 to +100)</span>
          </div>
          <div className="text-[11px] text-[#667085] flex justify-between">
            <span>Promoters: {formalNps.promoter_pct}%</span>
            <span>Detractors: {formalNps.detractor_pct}%</span>
          </div>
          <span className="text-[10px] text-[#98A2B3] block">
            Formula: % Promoters (9-10) − % Detractors (0-6)
          </span>
        </div>

        {/* KPI 3: 3-Emoji Distribution */}
        <div className="bg-white p-4 rounded-xl border border-[#E5E9EF] shadow-xs space-y-1.5">
          <span className="text-xs font-semibold text-[#667085]">3-Emoji Sentiment Distribution</span>
          <div className="flex items-center justify-between pt-0.5">
            <div className="text-center">
              <span className="text-sm block">😊</span>
              <span className="text-xs font-bold text-[#16805D]">{emojiStats.happy_count}</span>
              <span className="text-[10px] text-[#667085] block">{emojiStats.happy_pct}%</span>
            </div>
            <div className="text-center">
              <span className="text-sm block">😐</span>
              <span className="text-xs font-bold text-[#B54708]">{emojiStats.okay_count}</span>
              <span className="text-[10px] text-[#667085] block">{emojiStats.okay_pct}%</span>
            </div>
            <div className="text-center">
              <span className="text-sm block">😞</span>
              <span className="text-xs font-bold text-[#DC2626]">{emojiStats.unhappy_count}</span>
              <span className="text-[10px] text-[#667085] block">{emojiStats.unhappy_pct}%</span>
            </div>
          </div>
          <div className="w-full flex h-1.5 rounded-full overflow-hidden bg-[#F2F4F7]">
            <div className="bg-[#16805D]" style={{ width: `${emojiStats.happy_pct}%` }} title="Happy" />
            <div className="bg-[#F79009]" style={{ width: `${emojiStats.okay_pct}%` }} title="Okay" />
            <div className="bg-[#DC2626]" style={{ width: `${emojiStats.unhappy_pct}%` }} title="Unhappy" />
          </div>
        </div>

        {/* KPI 4: Response Rate */}
        <div className="bg-white p-4 rounded-xl border border-[#E5E9EF] shadow-xs space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#667085]">Patient Response Rate</span>
            <TrendingUp className="h-4 w-4 text-[#3868C9]" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-[#17212F]">{dashboard?.response_rate_pct || 0}%</span>
            <span className="text-xs text-[#667085]">of closed tickets</span>
          </div>
          <div className="w-full bg-[#F2F4F7] h-1.5 rounded-full overflow-hidden">
            <div className="bg-[#3868C9] h-full" style={{ width: `${dashboard?.response_rate_pct || 0}%` }} />
          </div>
          <span className="text-[11px] text-[#667085] block">
            {dashboard?.total_responses || 0} total verified submissions
          </span>
        </div>
      </div>

      {/* PRIMARY VIEW: PATIENT REVIEWS FEED (STYLED LIKE GOOGLE REVIEWS WITH ROOM & SOURCE HIGHLIGHT) */}
      {activeTab === "reviews" && (
        <div className="space-y-4">
          {/* Controls Bar: Search & Filters */}
          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 flex-1">
              {/* Search Box */}
              <div className="relative flex-1 min-w-[220px]">
                <Search className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search by Room number (e.g. 302), comment, ticket, source..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 focus:outline-none focus:border-indigo-500 text-xs text-slate-800 bg-white"
                />
              </div>

              {/* Department Filter */}
              <select
                value={selectedDept}
                onChange={(e) => setSelectedDept(e.target.value)}
                className="text-xs bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 focus:outline-none focus:border-indigo-500"
              >
                <option value="">All Departments</option>
                <option value="housekeeping">Housekeeping</option>
                <option value="linen">Linen</option>
                <option value="maintenance">Maintenance</option>
                <option value="medical">Medical</option>
                <option value="it">IT Support</option>
              </select>

              {/* Sentiment Filter */}
              <select
                value={selectedEmoji}
                onChange={(e) => setSelectedEmoji(e.target.value)}
                className="text-xs bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 focus:outline-none focus:border-indigo-500"
              >
                <option value="">All Sentiments</option>
                <option value="happy">😊 Happy</option>
                <option value="okay">😐 Okay</option>
                <option value="unhappy">😞 Unhappy</option>
              </select>

              {/* Status Filter */}
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="text-xs bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 focus:outline-none focus:border-indigo-500"
              >
                <option value="all">All Statuses</option>
                <option value="critical">Critical Attention</option>
                <option value="action_taken">Action Taken</option>
                <option value="resolved">Resolved</option>
              </select>
            </div>

            {/* View Layout Toggle: Cards or Table */}
            <div className="flex items-center justify-between md:justify-end gap-3 shrink-0">
              <span className="text-xs text-slate-500 font-medium">
                Showing <strong>{filteredResponses.length}</strong> patient feedback reviews
              </span>

              <div className="flex items-center bg-slate-100 rounded-lg p-0.5 border border-slate-200">
                <button
                  onClick={() => setViewLayout("cards")}
                  className={`p-1.5 rounded-md transition ${viewLayout === "cards" ? "bg-white text-indigo-600 shadow-xs" : "text-slate-400 hover:text-slate-700"}`}
                  title="Card View (Google Review style)"
                >
                  <LayoutGrid className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setViewLayout("table")}
                  className={`p-1.5 rounded-md transition ${viewLayout === "table" ? "bg-white text-indigo-600 shadow-xs" : "text-slate-400 hover:text-slate-700"}`}
                  title="Table View"
                >
                  <List className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Cards View (Default, styled like Google Review cards with Room & Source clearly identified) */}
          {viewLayout === "cards" ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredResponses.length === 0 ? (
                <div className="col-span-full bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-500">
                  <HeartHandshake className="h-10 w-10 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-slate-700">No patient feedback matches your filter</p>
                  <p className="text-xs text-slate-400 mt-1">Try resetting the department or sentiment filters above.</p>
                </div>
              ) : (
                filteredResponses.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => setSelectedFeedbackModal(item)}
                    className="bg-white rounded-2xl border border-slate-200 hover:border-indigo-400 p-4.5 shadow-xs hover:shadow-md transition-all cursor-pointer flex flex-col justify-between group space-y-3"
                  >
                    <div>
                      {/* Top Bar: Room Badge & Sentiment Emoji */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {/* Room Identifier Badge */}
                          <span className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 font-bold text-xs flex items-center gap-1.5 border border-blue-200">
                            <MapPin className="h-3.5 w-3.5 text-blue-600" />
                            {item.room_number || "Room-302"}
                          </span>

                          {/* Department Badge */}
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[11px] font-semibold capitalize">
                            {item.department_name || item.department_id || "General"}
                          </span>
                        </div>

                        {/* Sentiment Emoji & NPS Rating */}
                        <div className="flex items-center gap-1.5">
                          <span className={`text-base p-1 rounded-lg ${
                            item.emoji_rating === "happy"
                              ? "bg-emerald-50 text-emerald-600"
                              : item.emoji_rating === "unhappy"
                              ? "bg-rose-50 text-rose-600"
                              : "bg-amber-50 text-amber-600"
                          }`}>
                            {item.emoji_rating === "happy" ? "😊" : item.emoji_rating === "unhappy" ? "😞" : "😐"}
                          </span>

                          {item.nps_score !== null && (
                            <span className={`px-2 py-0.5 rounded-md font-mono font-bold text-xs ${
                              item.nps_score >= 9
                                ? "bg-emerald-100 text-emerald-800"
                                : item.nps_score >= 7
                                ? "bg-amber-100 text-amber-800"
                                : "bg-rose-100 text-rose-800"
                            }`}>
                              {item.nps_score}/10
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Origin Source Badge */}
                      <div className="mt-2.5 flex items-center gap-1.5 text-[11px] text-emerald-700 font-medium bg-emerald-50/70 border border-emerald-200/60 rounded-md px-2 py-1 w-fit">
                        <QrCode className="h-3 w-3 text-emerald-600 shrink-0" />
                        <span className="truncate">{item.source || `Bedside QR Placard (${item.room_number || "Bedside"})`}</span>
                      </div>

                      {/* Patient Review Text */}
                      <p className="text-xs text-slate-800 mt-3 line-clamp-3 leading-relaxed font-normal italic">
                        {item.feedback_comment ? `“${item.feedback_comment}”` : <span className="text-slate-400 not-italic">No written comment provided.</span>}
                      </p>
                    </div>

                    {/* Footer Info: Linked Ticket, Date & Action CTA */}
                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                      <div>
                        <span className="font-mono text-slate-700 font-semibold block">
                          {item.ticket_number || `TKT-MED-0${item.id}`}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {formatDateTime(item.created_at)}
                        </span>
                      </div>

                      <div className="flex items-center gap-1 text-indigo-600 font-semibold group-hover:translate-x-0.5 transition-transform">
                        <span>Inspect & Action</span>
                        <ChevronRight className="h-3.5 w-3.5" />
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : (
            /* Table View */
            <div className="bg-white rounded-2xl border border-[#E5E9EF] overflow-hidden shadow-xs">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#F8F9FA] border-b border-[#E5E9EF] text-[#667085] uppercase tracking-wider text-[10px]">
                    <th className="py-3 px-4">Room & Origin Source</th>
                    <th className="py-3 px-4">Sentiment & Rating</th>
                    <th className="py-3 px-4">Patient Comment</th>
                    <th className="py-3 px-4">Department & Ticket</th>
                    <th className="py-3 px-4">Date & Time</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5E9EF]">
                  {filteredResponses.map((item) => (
                    <tr
                      key={item.id}
                      onClick={() => setSelectedFeedbackModal(item)}
                      className="hover:bg-slate-50/80 transition cursor-pointer"
                    >
                      <td className="py-3 px-4">
                        <div className="flex flex-col gap-1">
                          <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 font-bold text-xs border border-blue-200 flex items-center gap-1 w-fit">
                            <MapPin className="h-3 w-3 text-blue-600" />
                            {item.room_number || "Room-302"}
                          </span>
                          <span className="text-[10px] text-emerald-700 flex items-center gap-1">
                            <QrCode className="h-3 w-3" />
                            {item.source || `Bedside QR Placard`}
                          </span>
                        </div>
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className="text-base">
                            {item.emoji_rating === "happy" ? "😊" : item.emoji_rating === "unhappy" ? "😞" : "😐"}
                          </span>
                          {item.nps_score !== null && (
                            <span className={`px-2 py-0.5 rounded-md font-mono font-bold text-xs ${
                              item.nps_score >= 9 ? "bg-[#EDF7F2] text-[#16805D]" : item.nps_score >= 7 ? "bg-[#FEF7EC] text-[#B54708]" : "bg-[#FEF3F2] text-[#DC2626]"
                            }`}>
                              {item.nps_score} / 10
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-3 px-4 max-w-sm">
                        <p className="text-slate-800 line-clamp-2 italic">
                          {item.feedback_comment ? `“${item.feedback_comment}”` : <span className="text-slate-400 not-italic">No comment</span>}
                        </p>
                      </td>

                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-800 capitalize">
                          {item.department_name || item.department_id}
                        </div>
                        <span className="text-[10px] font-mono text-slate-500">
                          {item.ticket_number || `TKT-MED-0${item.id}`}
                        </span>
                      </td>

                      <td className="py-3 px-4 font-mono text-slate-500 whitespace-nowrap text-[11px]">
                        {formatDateTime(item.created_at)}
                      </td>

                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedFeedbackModal(item);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold text-xs transition"
                        >
                          Inspect
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* OPTIONAL SECONDARY TAB: ANALYTICS & TRENDS (ONLY SHOWN IF USER EXPLICITLY SWITCHES TO IT) */}
      {activeTab === "analytics" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* 7-Day Trend Chart */}
            <div className="lg:col-span-2 bg-white rounded-xl border border-[#E5E9EF] p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-[#17212F]">7-Day Patient Satisfaction Progression</h2>
                <span className="text-xs text-[#667085]">Daily Submissions & Sentiment</span>
              </div>

              <div className="h-52 flex items-end justify-between gap-3 pt-6 pb-2 px-2 border-b border-[#F2F4F7]">
                {dashboard?.trend_7d?.map((day, i) => {
                  const max = Math.max(...(dashboard?.trend_7d?.map((d) => d.total) || [1]), 1);
                  const happyHeight = (day.happy / max) * 100;
                  const okayHeight = (day.okay / max) * 100;
                  const unhappyHeight = (day.unhappy / max) * 100;

                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-2 h-full justify-end group">
                      <div className="text-[10px] font-mono text-[#667085] opacity-0 group-hover:opacity-100 transition">
                        {day.total}
                      </div>
                      <div className="w-full max-w-[32px] flex flex-col-reverse rounded-t overflow-hidden bg-[#F2F4F7] h-36">
                        <div className="bg-[#16805D] w-full transition-all" style={{ height: `${happyHeight}%` }} title={`Happy: ${day.happy}`} />
                        <div className="bg-[#F79009] w-full transition-all" style={{ height: `${okayHeight}%` }} title={`Okay: ${day.okay}`} />
                        <div className="bg-[#DC2626] w-full transition-all" style={{ height: `${unhappyHeight}%` }} title={`Unhappy: ${day.unhappy}`} />
                      </div>
                      <span className="text-[11px] font-mono text-[#667085]">{day.date}</span>
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center justify-center gap-6 text-xs text-[#667085]">
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#16805D]" /> Happy
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#F79009]" /> Okay
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#DC2626]" /> Unhappy
                </span>
              </div>
            </div>

            {/* Department Breakdown */}
            <div className="bg-white rounded-xl border border-[#E5E9EF] p-5 shadow-xs space-y-4">
              <h2 className="text-sm font-bold text-[#17212F]">Department-Wise Performance</h2>
              <div className="space-y-3">
                {dashboard?.departments?.map((dept) => (
                  <div key={dept.department_id} className="p-3 rounded-lg border border-[#E5E9EF] hover:bg-[#FAFBFD] transition text-xs">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-bold text-[#17212F]">{dept.department_name}</span>
                      <span className="font-mono text-[#3868C9] font-semibold">
                        {dept.satisfaction_pct}% happy
                      </span>
                    </div>
                    <div className="w-full bg-[#F2F4F7] h-1.5 rounded-full overflow-hidden">
                      <div className="bg-[#16805D] h-full" style={{ width: `${dept.satisfaction_pct}%` }} />
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-[#667085] mt-1.5">
                      <span>{dept.total_responses} responses</span>
                      <span>
                        Formal NPS: <strong className="text-[#17212F]">{dept.formal_nps !== null ? dept.formal_nps : "—"}</strong>
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
