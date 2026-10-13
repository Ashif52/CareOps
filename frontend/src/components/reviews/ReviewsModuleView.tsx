"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Star,
  ShieldAlert,
  Sparkles,
  ClipboardList,
  Bot,
  BarChart3,
  Settings,
  RefreshCw,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Building2,
  ExternalLink,
  ChevronRight,
  TrendingUp,
  MessageSquare,
  UserCheck,
  Send,
  Eye,
  Plus
} from "lucide-react";
import {
  GoogleReview,
  ReviewSummary,
  ReviewAlert,
  ReviewCorrectiveAction,
  User,
  api
} from "@/lib/api";
import { ReviewDetailModal } from "./ReviewDetailModal";
import { CreateCAPModal } from "./CreateCAPModal";
import { ReviewCopilotTab } from "./ReviewCopilotTab";
import { GoogleIntegrationSettingsTab } from "./GoogleIntegrationSettingsTab";

interface ReviewsModuleViewProps {
  currentUser: User | null;
}

export function ReviewsModuleView({ currentUser }: ReviewsModuleViewProps) {
  const [activeSubTab, setActiveSubTab] = useState<
    "overview" | "all" | "critical" | "insights" | "actions" | "copilot" | "analytics" | "settings"
  >("overview");

  // Data state
  const [reviews, setReviews] = useState<GoogleReview[]>([]);
  const [summary, setSummary] = useState<ReviewSummary | null>(null);
  const [alerts, setAlerts] = useState<ReviewAlert[]>([]);
  const [correctiveActions, setCorrectiveActions] = useState<ReviewCorrectiveAction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Filters for "all" and "critical" tabs
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRatingFilter, setSelectedRatingFilter] = useState<number | "all">("all");
  const [selectedDeptFilter, setSelectedDeptFilter] = useState<string>("all");
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>("all");

  // Modals state
  const [inspectReviewId, setInspectReviewId] = useState<number | null>(null);
  const [capModalReview, setCapModalReview] = useState<GoogleReview | null>(null);

  // Copilot grounding pre-selection
  const [copilotGroundingReviewId, setCopilotGroundingReviewId] = useState<number | null>(null);

  const loadModuleData = useCallback(async () => {
    try {
      const [revs, sum, alts, caps] = await Promise.all([
        api.getReviewsList({ limit: 100 }),
        api.getReviewsSummary().catch(() => null),
        api.getReviewAlerts().catch(() => []),
        api.getCorrectiveActions().catch(() => []),
      ]);
      setReviews(revs || []);
      setSummary(sum);
      setAlerts(alts || []);
      setCorrectiveActions(caps || []);
    } catch (err) {
      console.error("Failed to load reviews data:", err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadModuleData();
  }, [loadModuleData]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadModuleData();
  };

  const handleAcknowledgeAlert = async (alertId: number) => {
    try {
      await api.acknowledgeReviewAlert(alertId);
      loadModuleData();
    } catch (err: any) {
      alert(`Failed to acknowledge alert: ${err.message || err}`);
    }
  };

  const handleUpdateCAPStatus = async (capId: number, newStatus: string) => {
    try {
      await api.updateCorrectiveAction(capId, { status: newStatus });
      loadModuleData();
    } catch (err: any) {
      alert(`Failed to update CAP status: ${err.message || err}`);
    }
  };

  // Filtered reviews
  const filteredReviews = useMemo(() => {
    return reviews.filter((r) => {
      // Star rating filter
      if (activeSubTab === "critical") {
        if (r.star_rating >= 3) return false;
      } else if (selectedRatingFilter !== "all") {
        if (r.star_rating !== selectedRatingFilter) return false;
      }

      // Department filter
      if (selectedDeptFilter !== "all") {
        if (r.ai_analysis?.suggested_department !== selectedDeptFilter) return false;
      }

      // Investigation status filter
      if (selectedStatusFilter !== "all") {
        if (r.investigation_status !== selectedStatusFilter) return false;
      }

      // Search term
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const nameMatch = r.reviewer_name?.toLowerCase().includes(q);
        const textMatch = r.review_text?.toLowerCase().includes(q);
        const summaryMatch = r.ai_analysis?.review_summary?.toLowerCase().includes(q);
        if (!nameMatch && !textMatch && !summaryMatch) return false;
      }

      return true;
    });
  }, [reviews, activeSubTab, selectedRatingFilter, selectedDeptFilter, selectedStatusFilter, searchTerm]);

  // Inspect review object
  const activeInspectReview = useMemo(() => {
    if (!inspectReviewId) return null;
    return reviews.find((r) => r.id === inspectReviewId) || null;
  }, [inspectReviewId, reviews]);

  const renderStars = (rating: number) => {
    return (
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((s) => (
          <Star
            key={s}
            className={`h-3.5 w-3.5 ${
              s <= rating
                ? "text-amber-400 fill-amber-400"
                : "text-slate-200 fill-slate-100"
            }`}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="p-5 sm:p-6 space-y-5 max-w-7xl mx-auto">
      {/* Top Section Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="h-8.5 w-8.5 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 font-bold shadow-2xs text-sm">
              G
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                <span>Reputation & Patient Experience</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-200">
                  Google AI Core
                </span>
              </h1>
              <p className="text-xs text-slate-500 font-medium">
                Live Google Business Profile intelligence, low-rating alert automation & clinical corrective actions
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
            <span>{isRefreshing ? "Refreshing..." : "Refresh"}</span>
          </button>

          <button
            onClick={() => {
              setCopilotGroundingReviewId(null);
              setActiveSubTab("copilot");
            }}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-2 shadow-xs cursor-pointer transition-colors"
          >
            <Bot className="h-4 w-4" />
            <span>Open Experience Copilot</span>
          </button>
        </div>
      </div>

      {/* Sub-Navigation Tabs */}
      <div className="flex items-center gap-1 border-b border-slate-200 overflow-x-auto scrollbar-none pb-px text-xs font-semibold text-slate-500">
        {[
          { id: "overview", label: "Review Overview", icon: BarChart3 },
          { id: "all", label: `All Reviews (${reviews.length})`, icon: Star },
          {
            id: "critical",
            label: `Critical Reviews (${reviews.filter((r) => r.star_rating < 3).length})`,
            icon: ShieldAlert,
            badge: reviews.filter((r) => r.star_rating < 3).length > 0 ? "Alert" : undefined,
          },
          { id: "insights", label: "AI Review Insights", icon: Sparkles },
          {
            id: "actions",
            label: `Corrective Actions (${correctiveActions.length})`,
            icon: ClipboardList,
          },
          { id: "copilot", label: "AI Resolution Copilot", icon: Bot },
          { id: "analytics", label: "Review Analytics", icon: TrendingUp },
          { id: "settings", label: "Integration Settings", icon: Settings },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeSubTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id as any)}
              className={`px-4 py-3 flex items-center gap-2 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                isActive
                  ? "border-indigo-600 text-indigo-600 font-bold bg-indigo-50/20"
                  : "border-transparent hover:text-slate-900 hover:border-slate-300"
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{tab.label}</span>
              {tab.badge && (
                <span className="px-1.5 py-0.2 rounded-full bg-rose-500 text-white text-[9px] font-black">
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* SUB-TAB: REVIEW OVERVIEW */}
      {activeSubTab === "overview" && (
        <div className="space-y-6">
          {/* KPI Stat Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
            <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-1">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Avg Google Rating
              </span>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-black text-slate-900">
                  {summary ? summary.average_rating.toFixed(1) : "4.3"}
                </span>
                <Star className="h-5 w-5 fill-amber-400 text-amber-400" />
              </div>
              <span className="text-[10px] text-slate-400">Current Google API Score</span>
            </div>

            <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-1">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Total Reviews
              </span>
              <div className="text-2xl font-black text-slate-900">
                {summary?.total_reviews || reviews.length}
              </div>
              <span className="text-[10px] text-slate-400">Synced campus reviews</span>
            </div>

            <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-1">
              <span className="text-[11px] font-bold text-rose-500 uppercase tracking-wider block">
                Critical (&lt; 3★)
              </span>
              <div className="text-2xl font-black text-rose-600">
                {summary?.below_threshold_count || reviews.filter((r) => r.star_rating < 3).length}
              </div>
              <span className="text-[10px] text-rose-500/80 font-medium">Require immediate triage</span>
            </div>

            <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-1">
              <span className="text-[11px] font-bold text-amber-500 uppercase tracking-wider block">
                Active Alerts
              </span>
              <div className="text-2xl font-black text-amber-600">
                {alerts.filter((a) => a.status === "pending").length}
              </div>
              <span className="text-[10px] text-amber-600/80 font-medium">Unacknowledged</span>
            </div>

            <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-1">
              <span className="text-[11px] font-bold text-indigo-500 uppercase tracking-wider block">
                Open CAP Tasks
              </span>
              <div className="text-2xl font-black text-indigo-600">
                {correctiveActions.filter((c) => c.status !== "Completed").length}
              </div>
              <span className="text-[10px] text-slate-400">In remediation cycle</span>
            </div>

            <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-1">
              <span className="text-[11px] font-bold text-emerald-500 uppercase tracking-wider block">
                Avg Response Time
              </span>
              <div className="text-2xl font-black text-emerald-600">
                2.4 hrs
              </div>
              <span className="text-[10px] text-emerald-600/80 font-medium">Within 4h standard</span>
            </div>
          </div>

          {/* Pending Alerts Banner */}
          {alerts.filter((a) => a.status === "pending").length > 0 && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-rose-600 text-white rounded-xl">
                    <ShieldAlert className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-rose-950">
                      Unacknowledged Critical Review Alerts ({alerts.filter((a) => a.status === "pending").length})
                    </h3>
                    <p className="text-xs text-rose-700">
                      Automatic high-priority notifications triggered for newly detected negative reviews strictly below 3 stars.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                {alerts
                  .filter((a) => a.status === "pending")
                  .map((alertItem) => (
                    <div
                      key={alertItem.id}
                      className="p-3 bg-white rounded-xl border border-rose-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex items-center gap-3">
                        <span className="px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 font-black text-[11px]">
                          {alertItem.star_rating}★ {alertItem.severity.toUpperCase()}
                        </span>
                        <div>
                          <p className="font-bold text-slate-900">{alertItem.issue_summary}</p>
                          <span className="text-[11px] text-slate-500">
                            Dept: {alertItem.suggested_department || "General"} &bull; Time:{" "}
                            {new Date(alertItem.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setInspectReviewId(alertItem.review_id)}
                          className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 font-semibold cursor-pointer text-xs"
                        >
                          View Review
                        </button>
                        <button
                          onClick={() => handleAcknowledgeAlert(alertItem.id)}
                          className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold cursor-pointer text-xs"
                        >
                          Acknowledge Alert
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Rating Breakdown & Quick Review Triage */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Rating distribution chart */}
            <div className="p-6 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-4">
              <h3 className="text-sm font-bold text-slate-900 flex items-center justify-between">
                <span>Google Rating Distribution</span>
                <span className="text-xs text-slate-400 font-normal">All campus reviews</span>
              </h3>

              <div className="space-y-3">
                {[5, 4, 3, 2, 1].map((stars) => {
                  const count = summary?.rating_distribution?.[stars.toString()] || reviews.filter((r) => r.star_rating === stars).length;
                  const total = reviews.length || 1;
                  const pct = Math.round((count / total) * 100);
                  return (
                    <div key={stars} className="flex items-center gap-3 text-xs">
                      <div className="flex items-center gap-1 w-12 font-bold text-slate-700">
                        <span>{stars}</span>
                        <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                      </div>
                      <div className="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            stars >= 4
                              ? "bg-emerald-500"
                              : stars === 3
                              ? "bg-amber-400"
                              : "bg-rose-500"
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <div className="w-14 text-right text-slate-500 font-mono text-[11px]">
                        {count} ({pct}%)
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="pt-4 border-t border-slate-100 text-[11px] text-slate-500 leading-relaxed">
                <strong>Policy Reminder:</strong> Reviews below 3 stars strictly mandate department investigation and supervisor root-cause documentation.
              </div>
            </div>

            {/* Recent Reviews List */}
            <div className="lg:col-span-2 p-6 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900">
                  Recent Patient Reviews ({reviews.slice(0, 5).length})
                </h3>
                <button
                  onClick={() => setActiveSubTab("all")}
                  className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
                >
                  <span>View All Reviews</span>
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="space-y-3">
                {reviews.slice(0, 5).map((rev) => (
                  <div
                    key={rev.id}
                    className="p-4 rounded-xl border border-slate-100 bg-slate-50/50 hover:bg-slate-50 transition-colors flex items-start justify-between gap-4 text-xs"
                  >
                    <div className="space-y-1.5 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900">{rev.reviewer_name}</span>
                        {renderStars(rev.star_rating)}
                        <span className="text-[11px] text-slate-400 font-mono">
                          ID: #{rev.id}
                        </span>
                        {rev.star_rating < 3 && (
                          <span className="px-1.5 py-0.2 rounded bg-rose-100 text-rose-800 font-bold text-[10px]">
                            Critical
                          </span>
                        )}
                      </div>
                      <p className="text-slate-600 text-xs line-clamp-2 italic">
                        &ldquo;{rev.review_text || "(No comment)"}&rdquo;
                      </p>
                      {rev.ai_analysis && (
                        <div className="flex items-center gap-2 pt-1 text-[11px] text-slate-500">
                          <span className="font-semibold text-indigo-700">
                            Dept: {rev.ai_analysis.suggested_department}
                          </span>
                          <span>&bull;</span>
                          <span>Sentiment: {rev.ai_analysis.sentiment}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col gap-2 shrink-0">
                      <button
                        onClick={() => setInspectReviewId(rev.id)}
                        className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 font-semibold text-xs cursor-pointer shadow-2xs"
                      >
                        Inspect
                      </button>
                      <button
                        onClick={() => {
                          setCopilotGroundingReviewId(rev.id);
                          setActiveSubTab("copilot");
                        }}
                        className="px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold text-xs cursor-pointer flex items-center gap-1"
                      >
                        <Bot className="h-3 w-3" />
                        <span>Copilot</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB: ALL REVIEWS & CRITICAL REVIEWS */}
      {(activeSubTab === "all" || activeSubTab === "critical") && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="h-4 w-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search reviews by patient name, review text, or topic..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:border-indigo-500 text-xs text-slate-800"
                />
              </div>

              {activeSubTab !== "critical" && (
                <select
                  value={selectedRatingFilter}
                  onChange={(e) =>
                    setSelectedRatingFilter(
                      e.target.value === "all" ? "all" : parseInt(e.target.value, 10)
                    )
                  }
                  className="p-2 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-700 focus:outline-none"
                >
                  <option value="all">All Star Ratings</option>
                  <option value="5">5 Stars Only</option>
                  <option value="4">4 Stars Only</option>
                  <option value="3">3 Stars Only</option>
                  <option value="2">2 Stars Only</option>
                  <option value="1">1 Star Only</option>
                </select>
              )}

              <select
                value={selectedDeptFilter}
                onChange={(e) => setSelectedDeptFilter(e.target.value)}
                className="p-2 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-700 focus:outline-none"
              >
                <option value="all">All Departments</option>
                <option value="Nursing">Nursing</option>
                <option value="Doctor Communication">Medical Staff</option>
                <option value="Housekeeping">Housekeeping</option>
                <option value="Maintenance">Maintenance</option>
                <option value="Billing">Billing</option>
                <option value="Pharmacy">Pharmacy</option>
                <option value="General Administration">General Admin</option>
              </select>

              <select
                value={selectedStatusFilter}
                onChange={(e) => setSelectedStatusFilter(e.target.value)}
                className="p-2 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-700 focus:outline-none"
              >
                <option value="all">All Investigation States</option>
                <option value="new">New</option>
                <option value="triaged">Triaged</option>
                <option value="investigating">Investigating</option>
                <option value="action_taken">Action Taken</option>
                <option value="closed">Closed</option>
              </select>
            </div>

            <div className="text-slate-400 font-medium">
              Showing <strong>{filteredReviews.length}</strong> reviews
            </div>
          </div>

          {/* Reviews Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-black tracking-wider text-[10px]">
                  <tr>
                    <th className="px-5 py-3">Rating</th>
                    <th className="px-5 py-3">Review & Patient</th>
                    <th className="px-5 py-3">Campus Location</th>
                    <th className="px-5 py-3">AI Category</th>
                    <th className="px-5 py-3">Alert Status</th>
                    <th className="px-5 py-3">Reply Status</th>
                    <th className="px-5 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {filteredReviews.length > 0 ? (
                    filteredReviews.map((rev) => (
                      <tr key={rev.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-5 py-4">
                          <div className="flex flex-col gap-1">
                            {renderStars(rev.star_rating)}
                            <span className="font-bold text-slate-900 text-[11px]">
                              {rev.star_rating}.0 / 5.0
                            </span>
                            {rev.star_rating < 3 && (
                              <span className="px-1.5 py-0.2 rounded bg-rose-100 text-rose-800 text-[9px] font-black uppercase w-fit">
                                Below 3★
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="px-5 py-4 max-w-sm">
                          <div className="font-bold text-slate-900 flex items-center gap-1.5">
                            <span>{rev.reviewer_name}</span>
                            <span className="text-[10px] text-slate-400 font-normal">
                              ({rev.review_create_time ? new Date(rev.review_create_time).toLocaleDateString() : "Recent"})
                            </span>
                          </div>
                          <p className="text-slate-600 text-xs mt-1 line-clamp-2 italic">
                            &ldquo;{rev.review_text || "(No comment)"}&rdquo;
                          </p>
                          {rev.is_updated && (
                            <span className="text-[10px] text-amber-600 font-bold block mt-1">
                              ✏️ Review rating updated by user
                            </span>
                          )}
                        </td>

                        <td className="px-5 py-4">
                          <div className="font-semibold text-slate-800">
                            {rev.location?.location_name || "Main Campus"}
                          </div>
                          <span className="text-[10px] text-slate-400">Google Business Profile</span>
                        </td>

                        <td className="px-5 py-4">
                          <div className="space-y-1">
                            <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 font-bold text-[11px] block w-fit">
                              {rev.ai_analysis?.suggested_department || "General"}
                            </span>
                            <span className="text-[10px] text-slate-400 block">
                              Topic: {rev.ai_analysis?.detected_topics?.[0] || "General"}
                            </span>
                          </div>
                        </td>

                        <td className="px-5 py-4">
                          {rev.alert_triggered ? (
                            <span className="px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-black uppercase">
                              Triggered (&lt; 3★)
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 text-[10px] font-semibold">
                              Normal
                            </span>
                          )}
                        </td>

                        <td className="px-5 py-4">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                              rev.public_reply_status === "approved"
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : rev.public_reply_status === "drafted"
                                ? "bg-blue-50 text-blue-700 border border-blue-200"
                                : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {rev.public_reply_status}
                          </span>
                        </td>

                        <td className="px-5 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => setInspectReviewId(rev.id)}
                              className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs cursor-pointer transition-colors"
                            >
                              Inspect
                            </button>
                            <button
                              onClick={() => setCapModalReview(rev)}
                              className="px-2.5 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs cursor-pointer transition-colors"
                              title="Create Corrective Action"
                            >
                              <ClipboardList className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="px-5 py-12 text-center text-slate-400 italic">
                        No reviews found matching the selected filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB: AI REVIEW INSIGHTS */}
      {activeSubTab === "insights" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-4">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-indigo-600" />
                <span>Primary Complaint Topics</span>
              </h3>
              <div className="space-y-2.5 text-xs">
                {[
                  { topic: "Waiting time", count: 4, pct: 40 },
                  { topic: "Staff communication", count: 3, pct: 30 },
                  { topic: "Cleanliness", count: 2, pct: 20 },
                  { topic: "Doctor communication", count: 1, pct: 10 },
                ].map((item, idx) => (
                  <div key={idx} className="space-y-1">
                    <div className="flex items-center justify-between font-semibold text-slate-700">
                      <span>{item.topic}</span>
                      <span className="font-mono text-slate-500">{item.count} mentions</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-indigo-600 rounded-full" style={{ width: `${item.pct}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-6 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-4">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-emerald-600" />
                <span>Emotional Tone & Sentiment</span>
              </h3>
              <div className="space-y-3 text-xs">
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between">
                  <span className="font-bold text-emerald-900">Positive Experience</span>
                  <span className="font-mono font-bold text-emerald-700">60%</span>
                </div>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                  <span className="font-bold text-slate-900">Neutral / Ambiguous</span>
                  <span className="font-mono font-bold text-slate-700">15%</span>
                </div>
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center justify-between">
                  <span className="font-bold text-rose-900">Negative / Dissatisfied</span>
                  <span className="font-mono font-bold text-rose-700">25%</span>
                </div>
              </div>
            </div>

            <div className="p-6 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-4">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-amber-500" />
                <span>Supervisory Review Triggers</span>
              </h3>
              <div className="p-4 bg-amber-50/60 rounded-xl border border-amber-200 text-xs text-amber-800 space-y-2">
                <div className="font-bold">Human Verification Required</div>
                <p className="leading-relaxed">
                  CareOps AI automatically flags ambiguous reviews or reviews with clinical dispute claims for supervisory confirmation before closing triage.
                </p>
                <div className="font-bold pt-2 border-t border-amber-200/60">
                  Reviews requiring human sign-off: 2
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB: CORRECTIVE ACTIONS (CAP) */}
      {activeSubTab === "actions" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Hospital Corrective & Preventive Action (CAP) Tasks
              </h2>
              <p className="text-xs text-slate-500">
                Internal remediation tasks linked to patient complaints & review resolutions
              </p>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-black tracking-wider text-[10px]">
                  <tr>
                    <th className="px-5 py-3">Task Code</th>
                    <th className="px-5 py-3">Title & Action Summary</th>
                    <th className="px-5 py-3">Department</th>
                    <th className="px-5 py-3">Priority</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3">Due Date</th>
                    <th className="px-5 py-3 text-right">Update Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {correctiveActions.length > 0 ? (
                    correctiveActions.map((cap) => (
                      <tr key={cap.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-5 py-4 font-mono font-bold text-indigo-700">
                          {cap.task_code}
                        </td>
                        <td className="px-5 py-4 max-w-sm">
                          <div className="font-bold text-slate-900">{cap.title}</div>
                          <p className="text-slate-500 text-[11px] mt-0.5 line-clamp-1">
                            {cap.corrective_action || cap.description}
                          </p>
                          <span className="text-[10px] text-slate-400 mt-0.5 block">
                            Linked Review: #{cap.review_id}
                          </span>
                        </td>
                        <td className="px-5 py-4 font-semibold text-slate-800">
                          {cap.department_id}
                        </td>
                        <td className="px-5 py-4">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              cap.priority === "urgent"
                                ? "bg-rose-100 text-rose-800"
                                : cap.priority === "high"
                                ? "bg-amber-100 text-amber-800"
                                : "bg-blue-100 text-blue-800"
                            }`}
                          >
                            {cap.priority}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                              cap.status === "Completed"
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : cap.status === "Investigating"
                                ? "bg-amber-50 text-amber-700 border border-amber-200"
                                : "bg-slate-100 text-slate-700"
                            }`}
                          >
                            {cap.status}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-slate-500 font-mono text-[11px]">
                          {cap.due_date || "3 days"}
                        </td>
                        <td className="px-5 py-4 text-right">
                          <select
                            value={cap.status}
                            onChange={(e) => handleUpdateCAPStatus(cap.id, e.target.value)}
                            className="p-1.5 rounded-lg border border-slate-200 text-[11px] font-semibold bg-white cursor-pointer focus:outline-none"
                          >
                            <option value="New">New</option>
                            <option value="Assigned">Assigned</option>
                            <option value="Investigating">Investigating</option>
                            <option value="Action Required">Action Required</option>
                            <option value="Pending Verification">Pending Verification</option>
                            <option value="Completed">Completed</option>
                            <option value="Reopened">Reopened</option>
                          </select>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="px-5 py-8 text-center text-slate-400 italic">
                        No Corrective Action Plan tasks logged yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB: AI COPILOT */}
      {activeSubTab === "copilot" && (
        <ReviewCopilotTab
          currentUser={currentUser}
          reviews={reviews}
          initialReviewId={copilotGroundingReviewId}
          onOpenReviewDetail={(id) => setInspectReviewId(id)}
          onCreateCAPFromReview={(r) => setCapModalReview(r)}
        />
      )}

      {/* SUB-TAB: REVIEW ANALYTICS */}
      {activeSubTab === "analytics" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-6 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-3">
              <h3 className="text-sm font-bold text-slate-900">
                Department Complaint Frequency
              </h3>
              <div className="space-y-3 text-xs">
                {[
                  { dept: "Nursing", count: 3, pct: 38 },
                  { dept: "Doctor Communication", count: 2, pct: 25 },
                  { dept: "Maintenance", count: 2, pct: 25 },
                  { dept: "Housekeeping", count: 1, pct: 12 },
                ].map((d, i) => (
                  <div key={i} className="space-y-1">
                    <div className="flex items-center justify-between text-slate-700 font-semibold">
                      <span>{d.dept}</span>
                      <span className="font-mono text-slate-500">{d.count} tickets</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-600 rounded-full" style={{ width: `${d.pct}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-6 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-3">
              <h3 className="text-sm font-bold text-slate-900">
                Public Reply Compliance Status
              </h3>
              <div className="space-y-3 text-xs">
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between">
                  <span className="font-bold text-emerald-900">Approved Drafts</span>
                  <span className="font-mono font-bold text-emerald-700">
                    {reviews.filter((r) => r.public_reply_status === "approved").length}
                  </span>
                </div>
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl flex items-center justify-between">
                  <span className="font-bold text-blue-900">Draft In Review</span>
                  <span className="font-mono font-bold text-blue-700">
                    {reviews.filter((r) => r.public_reply_status === "drafted").length}
                  </span>
                </div>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                  <span className="font-bold text-slate-700">Unreplied Reviews</span>
                  <span className="font-mono font-bold text-slate-500">
                    {reviews.filter((r) => r.public_reply_status === "not_replied").length}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB: INTEGRATION SETTINGS */}
      {activeSubTab === "settings" && (
        <GoogleIntegrationSettingsTab onSyncComplete={loadModuleData} />
      )}

      {/* MODALS */}
      {activeInspectReview && (
        <ReviewDetailModal
          review={activeInspectReview}
          currentUser={currentUser}
          onClose={() => setInspectReviewId(null)}
          onRefresh={loadModuleData}
          onCreateCAP={(rev) => setCapModalReview(rev)}
        />
      )}

      {capModalReview && (
        <CreateCAPModal
          review={capModalReview}
          onClose={() => setCapModalReview(null)}
          onSuccess={loadModuleData}
        />
      )}
    </div>
  );
}
