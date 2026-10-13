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
  ChevronRight
} from "lucide-react";
import { api, formatDateTime, getApiBase } from "@/lib/api";

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
  critical_alerts: Array<{
    id: number;
    ticket_id: number | null;
    ticket_number: string;
    department_id: string;
    room_number: string;
    emoji_rating: string;
    nps_score: number | null;
    feedback_comment: string | null;
    created_at: string;
  }>;
}

export function NPSModuleView({ currentUser }: { currentUser: any }) {
  const [dashboard, setDashboard] = useState<NPSDashboardData | null>(null);
  const [responses, setResponses] = useState<any[]>([]);
  const [selectedDept, setSelectedDept] = useState<string>("");
  const [selectedEmoji, setSelectedEmoji] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "responses">("overview");

  const loadData = async () => {
    setIsLoading(true);
    try {
      const dashRes: any = await api.getNPSDashboard(selectedDept || undefined);
      setDashboard(dashRes);

      const listRes: any = await api.getNPSResponses({
        department_id: selectedDept || undefined,
        emoji_rating: selectedEmoji || undefined,
        limit: 50,
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
    const token = typeof window !== "undefined" ? localStorage.getItem("careops_auth_token") : "";
    const base = getApiBase();
    const url = `${base}/nps/export${selectedDept ? `?department_id=${selectedDept}` : ""}`;
    window.open(url, "_blank");
  };

  if (!dashboard && isLoading) {
    return (
      <div className="p-12 text-center text-xs text-[#667085]">
        Loading patient experience intelligence...
      </div>
    );
  }

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
          <div className="flex items-center bg-[#F7F8FA] border border-[#E5E9EF] rounded-lg p-0.5">
            <button
              onClick={() => setActiveTab("overview")}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition cursor-pointer ${
                activeTab === "overview"
                  ? "bg-white text-[#17212F] shadow-xs"
                  : "text-[#667085] hover:text-[#17212F]"
              }`}
            >
              Analytics Dashboard
            </button>
            <button
              onClick={() => setActiveTab("responses")}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition cursor-pointer ${
                activeTab === "responses"
                  ? "bg-white text-[#17212F] shadow-xs"
                  : "text-[#667085] hover:text-[#17212F]"
              }`}
            >
              Response Ledger ({responses.length})
            </button>
          </div>

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

      {/* Critical Patient Feedback Banner */}
      {dashboard?.critical_alerts && dashboard.critical_alerts.length > 0 && (
        <div className="bg-[#FEF3F2] border border-[#FECDCA] rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-[#B42318] text-xs font-bold">
              <AlertTriangle className="h-4 w-4" />
              <span>{dashboard.critical_alerts.length} Critical Low-Satisfaction Alert(s) Detected</span>
            </div>
            <span className="text-[11px] text-[#B42318] font-semibold">Immediate Supervisor Action Required</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
            {dashboard.critical_alerts.slice(0, 2).map((alertItem) => (
              <div
                key={alertItem.id}
                className="bg-white p-2.5 rounded-lg border border-[#FECDCA] text-xs flex items-start gap-2.5"
              >
                <div className="p-1 rounded bg-[#FEF3F2] text-[#B42318] font-bold text-sm">
                  {alertItem.emoji_rating === "unhappy" ? "😞" : "⚠️"}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[#17212F]">{alertItem.ticket_number}</span>
                    <span className="text-[10px] text-[#667085] font-mono">
                      {formatDateTime(alertItem.created_at)}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#475467] truncate mt-0.5">
                    {alertItem.feedback_comment || "No comment provided."}
                  </p>
                  <div className="flex items-center gap-2 mt-1 text-[10px] text-[#667085]">
                    <span>Dept: {alertItem.department_id}</span>
                    <span>·</span>
                    <span>Room: {alertItem.room_number || "Bedside"}</span>
                    {alertItem.nps_score !== null && (
                      <>
                        <span>·</span>
                        <span className="font-bold text-[#B42318]">Score: {alertItem.nps_score}/10</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top 4 KPI Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Overall Satisfaction */}
        <div className="bg-white p-4.5 rounded-xl border border-[#E5E9EF] shadow-xs space-y-2">
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
        <div className="bg-white p-4.5 rounded-xl border border-[#E5E9EF] shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#667085]">Formal NPS Score (0-10)</span>
            <span className="text-xs font-bold text-[#3868C9] bg-[#EEF4FD] px-2 py-0.5 rounded">
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
        <div className="bg-white p-4.5 rounded-xl border border-[#E5E9EF] shadow-xs space-y-2">
          <span className="text-xs font-semibold text-[#667085]">3-Emoji Sentiment Distribution</span>
          <div className="flex items-center justify-between pt-1">
            <div className="text-center">
              <span className="text-base block">😊</span>
              <span className="text-xs font-bold text-[#16805D]">{emojiStats.happy_count}</span>
              <span className="text-[10px] text-[#667085] block">{emojiStats.happy_pct}%</span>
            </div>
            <div className="text-center">
              <span className="text-base block">😐</span>
              <span className="text-xs font-bold text-[#B54708]">{emojiStats.okay_count}</span>
              <span className="text-[10px] text-[#667085] block">{emojiStats.okay_pct}%</span>
            </div>
            <div className="text-center">
              <span className="text-base block">😞</span>
              <span className="text-xs font-bold text-[#DC2626]">{emojiStats.unhappy_count}</span>
              <span className="text-[10px] text-[#667085] block">{emojiStats.unhappy_pct}%</span>
            </div>
          </div>
          <div className="w-full flex h-2 rounded-full overflow-hidden bg-[#F2F4F7]">
            <div className="bg-[#16805D]" style={{ width: `${emojiStats.happy_pct}%` }} title="Happy" />
            <div className="bg-[#F79009]" style={{ width: `${emojiStats.okay_pct}%` }} title="Okay" />
            <div className="bg-[#DC2626]" style={{ width: `${emojiStats.unhappy_pct}%` }} title="Unhappy" />
          </div>
        </div>

        {/* KPI 4: Response Rate */}
        <div className="bg-white p-4.5 rounded-xl border border-[#E5E9EF] shadow-xs space-y-2">
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

      {activeTab === "overview" && (
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
      )}

      {/* Responses Table Tab */}
      {activeTab === "responses" && (
        <div className="bg-white rounded-xl border border-[#E5E9EF] overflow-hidden shadow-xs space-y-0">
          <div className="p-3.5 border-b border-[#E5E9EF] flex items-center justify-between gap-3 bg-[#FAFBFD]">
            <div className="flex items-center gap-3">
              <select
                value={selectedDept}
                onChange={(e) => setSelectedDept(e.target.value)}
                className="text-xs bg-white border border-[#D0D5DD] rounded-lg px-2.5 py-1.5 text-[#344054] focus:outline-hidden focus:border-[#3868C9]"
              >
                <option value="">All Departments</option>
                <option value="maintenance">Maintenance</option>
                <option value="housekeeping">Housekeeping</option>
                <option value="linen">Linen</option>
                <option value="medical">Medical</option>
                <option value="it">IT</option>
              </select>

              <select
                value={selectedEmoji}
                onChange={(e) => setSelectedEmoji(e.target.value)}
                className="text-xs bg-white border border-[#D0D5DD] rounded-lg px-2.5 py-1.5 text-[#344054] focus:outline-hidden focus:border-[#3868C9]"
              >
                <option value="">All Emoji Sentiments</option>
                <option value="happy">😊 Happy Only</option>
                <option value="okay">😐 Okay Only</option>
                <option value="unhappy">😞 Unhappy Only</option>
              </select>
            </div>

            <span className="text-xs text-[#667085]">
              Showing {responses.length} verified submissions
            </span>
          </div>

          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[#F8F9FA] border-b border-[#E5E9EF] text-[#667085] uppercase tracking-wider text-[10px]">
                <th className="py-2.5 px-4">Date & Time</th>
                <th className="py-2.5 px-4">Emoji Sentiment</th>
                <th className="py-2.5 px-4">Formal NPS (0-10)</th>
                <th className="py-2.5 px-4">Department & Room</th>
                <th className="py-2.5 px-4">Patient Comment</th>
                <th className="py-2.5 px-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E9EF]">
              {responses.map((item) => (
                <tr key={item.id} className="hover:bg-[#F9FAFB] transition">
                  <td className="py-2.5 px-4 font-mono text-[#475467] whitespace-nowrap">
                    {formatDateTime(item.created_at)}
                  </td>
                  <td className="py-2.5 px-4 whitespace-nowrap">
                    <span className="inline-flex items-center gap-1.5 text-sm">
                      {item.emoji_rating === "happy" && <span>😊 <strong className="text-xs text-[#16805D]">Happy</strong></span>}
                      {item.emoji_rating === "okay" && <span>😐 <strong className="text-xs text-[#B54708]">Okay</strong></span>}
                      {item.emoji_rating === "unhappy" && <span>😞 <strong className="text-xs text-[#DC2626]">Unhappy</strong></span>}
                    </span>
                  </td>
                  <td className="py-2.5 px-4 whitespace-nowrap">
                    {item.nps_score !== null ? (
                      <span className={`px-2 py-0.5 rounded-md font-mono font-bold text-xs ${item.nps_score >= 9 ? "bg-[#EDF7F2] text-[#16805D]" : item.nps_score >= 7 ? "bg-[#FEF7EC] text-[#B54708]" : "bg-[#FEF3F2] text-[#DC2626]"}`}>
                        {item.nps_score} / 10
                      </span>
                    ) : (
                      <span className="text-[#98A2B3]">—</span>
                    )}
                  </td>
                  <td className="py-2.5 px-4 text-[#475467]">
                    <div className="font-semibold text-[#17212F] capitalize">{item.department_name || item.department_id}</div>
                    <span className="text-[10px] text-[#667085]">{item.room_number || "Direct"}</span>
                  </td>
                  <td className="py-2.5 px-4 text-[#344054] max-w-sm">
                    {item.feedback_comment || <span className="text-[#98A2B3] italic">No comment</span>}
                  </td>
                  <td className="py-2.5 px-4 whitespace-nowrap">
                    {item.is_critical ? (
                      <span className="px-2 py-0.5 rounded-full bg-[#FEF3F2] text-[#B42318] text-[10px] font-bold">
                        Critical Alert
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full bg-[#EDF7F2] text-[#16805D] text-[10px] font-bold">
                        Normal
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
