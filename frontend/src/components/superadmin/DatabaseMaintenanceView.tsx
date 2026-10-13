"use client";

import React, { useState, useEffect } from "react";
import {
  Database,
  Trash2,
  AlertTriangle,
  ShieldCheck,
  CheckCircle2,
  RefreshCw,
  Clock,
  Layers,
  Info,
  Lock
} from "lucide-react";
import { api, formatDateTime } from "@/lib/api";

interface CategoryOption {
  key: string;
  label: string;
  description: string;
  count: number;
}

export interface DatabaseMaintenanceViewProps {
  onPurgeSuccess?: () => void;
}

export function DatabaseMaintenanceView({ onPurgeSuccess }: DatabaseMaintenanceViewProps = {}) {
  const [categories, setCategories] = useState<{ [key: string]: { label: string; count: number } }>({
    demo_patients: { label: "Demo patients & synthetic submissions", count: 0 },
    demo_tickets: { label: "Demo tickets & ticket status history", count: 0 },
    demo_notifications: { label: "Demo WhatsApp & SMS delivery logs", count: 0 },
    demo_nps: { label: "Demo NPS & patient experience responses", count: 0 },
    demo_ai_jobs: { label: "Demo AI multimodal verification analyses", count: 0 },
    demo_reviews: { label: "Demo Google review intelligence & CAPs", count: 0 },
  });

  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [previewData, setPreviewData] = useState<{
    total_records_affected: number;
    affected_counts: { [key: string]: { label: string; count: number } };
    dependencies_explanation: string;
  } | null>(null);

  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [typedPhrase, setTypedPhrase] = useState("");
  const [executionResult, setExecutionResult] = useState<{
    success: boolean;
    message: string;
    affected_counts?: any;
    total_purged?: number;
  } | null>(null);

  const [auditHistory, setAuditHistory] = useState<any[]>([]);
  const [isLoadingAudit, setIsLoadingAudit] = useState(false);

  // Load category counts & audit logs
  const loadCountsAndAudit = async () => {
    setIsLoadingAudit(true);
    try {
      // Preview all categories to fetch current database counts
      const allKeys = Object.keys(categories);
      const res: any = await api.getMaintenancePreview(allKeys);
      if (res && res.affected_counts) {
        setCategories(res.affected_counts);
      }
      const logs: any = await api.getMaintenanceAuditLogs();
      if (Array.isArray(logs)) {
        setAuditHistory(logs);
      }
    } catch (err: any) {
      console.error("Failed to load maintenance data:", err);
    } finally {
      setIsLoadingAudit(false);
    }
  };

  useEffect(() => {
    loadCountsAndAudit();
  }, []);

  const handleToggleCategory = (key: string) => {
    setSelectedKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
    setPreviewData(null);
    setExecutionResult(null);
  };

  const handleSelectAll = () => {
    setSelectedKeys(Object.keys(categories));
    setPreviewData(null);
    setExecutionResult(null);
  };

  const handleDeselectAll = () => {
    setSelectedKeys([]);
    setPreviewData(null);
    setExecutionResult(null);
  };

  const handleCalculateImpact = async () => {
    if (selectedKeys.length === 0) {
      alert("Please select at least one data category to evaluate.");
      return;
    }
    setIsLoadingPreview(true);
    setExecutionResult(null);
    try {
      const res: any = await api.getMaintenancePreview(selectedKeys);
      setPreviewData(res);
    } catch (err: any) {
      alert(`Impact calculation error: ${err.message || err}`);
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const handleExecutePurge = async () => {
    if (typedPhrase !== "CONFIRM_CLEAR") {
      alert("Type 'CONFIRM_CLEAR' exactly to proceed with the purge.");
      return;
    }
    setIsExecuting(true);
    try {
      const res: any = await api.executeMaintenancePurge(selectedKeys, typedPhrase);
      setExecutionResult({
        success: true,
        message: res.message,
        affected_counts: res.affected_counts,
        total_purged: res.total_records_purged,
      });
      setShowConfirmModal(false);
      setTypedPhrase("");
      setPreviewData(null);
      setSelectedKeys([]);
      await loadCountsAndAudit();
      onPurgeSuccess?.();
    } catch (err: any) {
      alert(`Purge execution error: ${err.message || err}`);
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#E5E9EF] pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-[#FEE2E2] rounded-xl text-[#DC2626]">
              <Database className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-[#17212F] flex items-center gap-2">
                Database Maintenance & Selective Clearing
                <span className="px-2 py-0.5 rounded-full bg-[#DC2626]/10 text-[#DC2626] text-[10px] font-bold uppercase tracking-wider">
                  Super Admin Only
                </span>
              </h1>
              <p className="text-xs text-[#667085] mt-0.5">
                Targeted sandbox cleanup with dependency checks, pre-clear audit verification, and durable logging.
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={loadCountsAndAudit}
          disabled={isLoadingAudit}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#F7F8FA] hover:bg-[#EEF0F4] border border-[#E5E9EF] rounded-lg text-xs font-semibold text-[#344054] transition cursor-pointer"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isLoadingAudit ? "animate-spin" : ""}`} />
          <span>Refresh Database Counts</span>
        </button>
      </div>

      {/* Safety Notice Banner */}
      <div className="bg-[#EEF4FD] border border-[#BFDBFE] rounded-xl p-4 flex items-start gap-3 text-xs text-[#1E3A8A]">
        <Info className="h-5 w-5 text-[#3868C9] shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-semibold text-[#1E3A8A]">Safety Isolation Guarantee</p>
          <p className="text-[#3868C9] leading-relaxed">
            This privileged utility targets only flagged synthetic demo records. Hospital rooms, permanent staff accounts,
            legal retention records, security configs, and historical administrative audit logs are strictly protected from deletion.
          </p>
        </div>
      </div>

      {/* Success / Result alert */}
      {executionResult && (
        <div className="bg-[#EDF7F2] border border-[#A6E1CE] rounded-xl p-4 text-[#16805D] text-xs font-medium flex items-start gap-3">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-[#16805D]" />
          <div>
            <p className="font-bold">{executionResult.message}</p>
            <p className="mt-1 text-[#16805D]/90">
              Total records securely cleared: {executionResult.total_purged}. Audit event recorded with cryptographic actor linkage.
            </p>
          </div>
        </div>
      )}

      {/* Category Selection Grid */}
      <div className="bg-white rounded-xl border border-[#E5E9EF] p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-[#17212F]">Select Eligible Data Categories</h2>
            <p className="text-xs text-[#667085]">
              Choose individual categories to clear. Unchecked categories remain entirely untouched.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSelectAll}
              className="px-2.5 py-1 text-xs font-semibold text-[#3868C9] hover:bg-[#EEF4FD] rounded-md transition cursor-pointer"
            >
              Select All
            </button>
            <span className="text-[#D0D5DD]">|</span>
            <button
              onClick={handleDeselectAll}
              className="px-2.5 py-1 text-xs font-semibold text-[#667085] hover:bg-[#F7F8FA] rounded-md transition cursor-pointer"
            >
              Clear Selection
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {Object.entries(categories).map(([key, data]) => {
            const isChecked = selectedKeys.includes(key);
            return (
              <label
                key={key}
                className={`flex items-start gap-3 p-3.5 rounded-xl border transition cursor-pointer ${
                  isChecked
                    ? "bg-[#FEF2F2] border-[#FCA5A5]"
                    : "bg-[#FAFAFA] border-[#E5E9EF] hover:border-[#D0D5DD]"
                }`}
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => handleToggleCategory(key)}
                  className="mt-0.5 h-4 w-4 rounded border-[#D0D5DD] text-[#DC2626] focus:ring-[#DC2626]"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-[#17212F]">{data.label}</span>
                    <span className="px-2 py-0.5 rounded-full bg-white border border-[#E5E9EF] text-[11px] font-mono font-bold text-[#475467]">
                      {data.count} records
                    </span>
                  </div>
                  <p className="text-[11px] text-[#667085] mt-0.5">
                    {key === "demo_tickets" && "Tickets, evidence media references, and resolution notes"}
                    {key === "demo_patients" && "Patient QR submissions and tracking access tokens"}
                    {key === "demo_notifications" && "WhatsApp message tracking and webhook dispatch history"}
                    {key === "demo_nps" && "Patient experience ratings (emojis & formal 0-10 NPS)"}
                    {key === "demo_ai_jobs" && "Computer vision analyses and model prediction logs"}
                    {key === "demo_reviews" && "Simulated Google Business Profile reviews and CAP tasks"}
                  </p>
                </div>
              </label>
            );
          })}
        </div>

        {/* Calculate Impact Button */}
        <div className="pt-3 flex items-center justify-between border-t border-[#E5E9EF]">
          <div className="text-xs text-[#667085]">
            {selectedKeys.length} categories selected
          </div>
          <button
            onClick={handleCalculateImpact}
            disabled={selectedKeys.length === 0 || isLoadingPreview}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#17212F] hover:bg-[#253243] text-white rounded-lg text-xs font-semibold transition cursor-pointer disabled:opacity-50"
          >
            <Layers className="h-3.5 w-3.5" />
            <span>{isLoadingPreview ? "Calculating Impact..." : "Preview Affected Records & Dependencies"}</span>
          </button>
        </div>
      </div>

      {/* Dependency & Impact Review Box */}
      {previewData && (
        <div className="bg-white rounded-xl border-2 border-[#DC2626]/40 p-5 shadow-sm space-y-4 animate-in fade-in duration-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-[#DC2626]">
              <AlertTriangle className="h-5 w-5" />
              <h3 className="text-sm font-bold">Maintenance Impact Assessment</h3>
            </div>
            <div className="px-3 py-1 bg-[#FEE2E2] rounded-full text-xs font-mono font-bold text-[#DC2626]">
              {previewData.total_records_affected} Records Targeted
            </div>
          </div>

          <div className="bg-[#FFF5F5] rounded-lg p-3.5 border border-[#FED7D7] text-xs text-[#7F1D1D] space-y-2">
            <p className="font-semibold">Dependency Cascades & Retained Data:</p>
            <p className="text-[11px] leading-relaxed">
              {previewData.dependencies_explanation}
            </p>
          </div>

          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-[#17212F]">Breakdown of Records to be Cleared:</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {Object.entries(previewData.affected_counts).map(([catKey, catVal]) => (
                <div key={catKey} className="p-2.5 bg-[#F7F8FA] border border-[#E5E9EF] rounded-lg text-xs">
                  <span className="text-[#667085] block truncate">{catVal.label}</span>
                  <span className="font-mono font-bold text-[#17212F] text-sm">{catVal.count} records</span>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-3 flex items-center justify-end border-t border-[#E5E9EF]">
            <button
              onClick={() => {
                setTypedPhrase("");
                setShowConfirmModal(true);
              }}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#DC2626] hover:bg-[#B91C1C] text-white rounded-lg text-xs font-bold transition shadow-xs cursor-pointer"
            >
              <Trash2 className="h-4 w-4" />
              <span>Proceed to Confirmation</span>
            </button>
          </div>
        </div>
      )}

      {/* Audit History of Past Database Maintenance Operations */}
      <div className="bg-white rounded-xl border border-[#E5E9EF] p-5 shadow-xs space-y-4">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-[#3868C9]" />
          <h2 className="text-sm font-bold text-[#17212F]">Privileged Maintenance Audit History</h2>
        </div>

        {auditHistory.length === 0 ? (
          <div className="py-8 text-center text-xs text-[#667085] bg-[#F7F8FA] rounded-xl border border-dashed border-[#E5E9EF]">
            No previous database maintenance clearing operations recorded in audit log.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#E5E9EF] text-[#667085] uppercase tracking-wider text-[10px]">
                  <th className="py-2.5 px-3">Timestamp (UTC)</th>
                  <th className="py-2.5 px-3">Executing Administrator</th>
                  <th className="py-2.5 px-3">Selected Categories</th>
                  <th className="py-2.5 px-3">Records Cleared</th>
                  <th className="py-2.5 px-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E9EF]">
                {auditHistory.map((item) => {
                  let categoriesList: string[] = [];
                  try {
                    categoriesList = typeof item.selected_categories === "string"
                      ? JSON.parse(item.selected_categories)
                      : item.selected_categories || [];
                  } catch (e) {
                    categoriesList = [String(item.selected_categories)];
                  }

                  let countsObj: any = {};
                  try {
                    countsObj = typeof item.affected_counts === "string"
                      ? JSON.parse(item.affected_counts)
                      : item.affected_counts || {};
                  } catch (e) {}

                  const totalCount = Object.values(countsObj).reduce((acc: number, val: any) => acc + (typeof val === "number" ? val : val?.count || 0), 0);

                  return (
                    <tr key={item.id} className="hover:bg-[#F9FAFB] transition">
                      <td className="py-2.5 px-3 font-mono text-[#475467]">
                        {formatDateTime(item.created_at)}
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-[#17212F]">
                        {item.actor_name}
                      </td>
                      <td className="py-2.5 px-3 text-[#475467]">
                        <div className="flex flex-wrap gap-1">
                          {categoriesList.map((c, i) => (
                            <span key={i} className="px-1.5 py-0.5 bg-[#F0F2F5] rounded text-[10px] font-mono">
                              {c}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 font-mono font-bold text-[#17212F]">
                        {totalCount}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#EDF7F2] text-[#16805D]">
                          <ShieldCheck className="h-3 w-3" />
                          <span>{item.status}</span>
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Typed Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 border border-[#E5E9EF] shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-[#DC2626]">
              <div className="p-3 bg-[#FEE2E2] rounded-xl">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-bold text-base text-[#17212F]">Confirm Database Operation</h3>
                <p className="text-xs text-[#667085]">Deliberate Two-Factor Typed Authorization</p>
              </div>
            </div>

            <div className="p-3 bg-[#FFF5F5] rounded-xl border border-[#FED7D7] text-xs text-[#7F1D1D] space-y-1">
              <p className="font-semibold">Target: {previewData?.total_records_affected || 0} Records across {selectedKeys.length} categories.</p>
              <p className="text-[11px]">
                This operation will permanently purge the selected demo datasets in a safe database transaction.
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-[#17212F] block">
                Type <span className="font-mono text-[#DC2626] font-bold bg-[#FEE2E2] px-1.5 py-0.5 rounded">CONFIRM_CLEAR</span> below to execute:
              </label>
              <input
                type="text"
                value={typedPhrase}
                onChange={(e) => setTypedPhrase(e.target.value)}
                placeholder="CONFIRM_CLEAR"
                className="w-full px-3 py-2 text-xs font-mono border border-[#D0D5DD] rounded-lg focus:outline-hidden focus:border-[#DC2626] focus:ring-1 focus:ring-[#DC2626]"
                autoFocus
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E5E9EF]">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2 border border-[#E5E9EF] hover:bg-[#F7F8FA] rounded-lg text-xs font-semibold text-[#344054] transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecutePurge}
                disabled={typedPhrase !== "CONFIRM_CLEAR" || isExecuting}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#DC2626] hover:bg-[#B91C1C] text-white rounded-lg text-xs font-bold transition cursor-pointer disabled:opacity-40"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>{isExecuting ? "Executing Purge..." : "Execute Destructive Purge"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
