"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Mail,
  Send,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Clock,
  RotateCcw,
  Search,
  Server,
  ShieldCheck,
  ChevronRight,
  Filter,
  Eye,
  EyeOff,
  X,
  AlertTriangle,
  Settings,
  Lock,
  Sparkles
} from "lucide-react";
import { api, EmailLog, EmailStats, formatDateTime } from "@/lib/api";

export function EmailDeliveryManager() {
  const [stats, setStats] = useState<EmailStats | null>(null);
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // SMTP Test State
  const [testEmail, setTestEmail] = useState("");
  const [isTestingSmtp, setIsTestingSmtp] = useState(false);
  const [isSendingNotice, setIsSendingNotice] = useState(false);
  const [smtpTestResult, setSmtpTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  // Retrying State
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryResult, setRetryResult] = useState<string | null>(null);

  // Detail Modal State
  const [selectedLog, setSelectedLog] = useState<EmailLog | null>(null);

  // SMTP Configuration Modal State
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [isLoadingConfig, setIsLoadingConfig] = useState(false);
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [configSuccessMsg, setConfigSuccessMsg] = useState<string | null>(null);
  const [configErrorMsg, setConfigErrorMsg] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [smtpConfig, setSmtpConfig] = useState({
    smtp_host: "",
    smtp_port: 465,
    smtp_user: "",
    smtp_password: "",
    smtp_from: "alerts@careops.hospital",
    smtp_use_ssl: true,
  });

  const handleOpenConfigModal = async () => {
    setShowConfigModal(true);
    setIsLoadingConfig(true);
    setConfigSuccessMsg(null);
    setConfigErrorMsg(null);
    try {
      const data: any = await api.getEmailConfig();
      if (data) {
        setSmtpConfig({
          smtp_host: data.smtp_host || "",
          smtp_port: data.smtp_port || 465,
          smtp_user: data.smtp_user || "",
          smtp_password: "",
          smtp_from: data.smtp_from || "alerts@careops.hospital",
          smtp_use_ssl: data.smtp_use_ssl ?? true,
        });
      }
    } catch (err: any) {
      console.error("Failed to load SMTP config:", err);
    } finally {
      setIsLoadingConfig(false);
    }
  };

  const handleApplyPreset = (preset: "gmail_ssl" | "gmail_tls" | "outlook") => {
    if (preset === "gmail_ssl") {
      setSmtpConfig((prev) => ({
        ...prev,
        smtp_host: "smtp.gmail.com",
        smtp_port: 465,
        smtp_use_ssl: true,
      }));
    } else if (preset === "gmail_tls") {
      setSmtpConfig((prev) => ({
        ...prev,
        smtp_host: "smtp.gmail.com",
        smtp_port: 587,
        smtp_use_ssl: false,
      }));
    } else if (preset === "outlook") {
      setSmtpConfig((prev) => ({
        ...prev,
        smtp_host: "smtp.office365.com",
        smtp_port: 587,
        smtp_use_ssl: false,
      }));
    }
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!smtpConfig.smtp_host.trim()) {
      setConfigErrorMsg("SMTP Host is required (e.g. smtp.gmail.com).");
      return;
    }
    setIsSavingConfig(true);
    setConfigSuccessMsg(null);
    setConfigErrorMsg(null);
    try {
      await api.updateEmailConfig(smtpConfig);
      setConfigSuccessMsg("SMTP settings saved directly to database!");
      fetchEmailData();
      setTimeout(() => {
        setShowConfigModal(false);
      }, 1200);
    } catch (err: any) {
      setConfigErrorMsg(err.message || "Failed to save SMTP configuration.");
    } finally {
      setIsSavingConfig(false);
    }
  };

  const fetchEmailData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [statsRes, logsRes] = await Promise.allSettled([
        api.getEmailStats(),
        api.getEmailLogs({
          status: statusFilter === "all" ? undefined : statusFilter,
          search: searchQuery.trim() || undefined,
          limit: 100,
        }),
      ]);

      if (statsRes.status === "fulfilled") {
        setStats(statsRes.value);
      }
      if (logsRes.status === "fulfilled") {
        const val: any = logsRes.value;
        if (Array.isArray(val)) {
          setLogs(val);
        } else if (val && Array.isArray(val.items)) {
          setLogs(val.items);
        } else {
          setLogs([]);
        }
      } else {
        setLogs([]);
      }
    } catch (err) {
      console.error("Error loading email data:", err);
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, searchQuery]);

  useEffect(() => {
    fetchEmailData();
  }, [fetchEmailData]);

  const handleTestSmtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testEmail || !testEmail.includes("@")) {
      setSmtpTestResult({
        success: false,
        message: "Please enter a valid recipient email address.",
      });
      return;
    }

    setIsTestingSmtp(true);
    setSmtpTestResult(null);

    try {
      const res: any = await api.testEmailSMTP(testEmail.trim());
      setSmtpTestResult({
        success: res.success,
        message: res.message || "Test email dispatched successfully.",
      });
      fetchEmailData();
    } catch (err: any) {
      setSmtpTestResult({
        success: false,
        message: err.message || "SMTP connection test failed. Check server logs.",
      });
    } finally {
      setIsTestingSmtp(false);
    }
  };

  const handleSendMaintenanceNotice = async () => {
    if (!testEmail || !testEmail.includes("@")) {
      setSmtpTestResult({
        success: false,
        message: "Please enter a valid recipient email address to send the maintenance notice.",
      });
      return;
    }

    setIsSendingNotice(true);
    setSmtpTestResult(null);

    try {
      const res: any = await api.sendMaintenanceNotice({ recipient_email: testEmail.trim() });
      setSmtpTestResult({
        success: true,
        message: `Official Maintenance Notice with 5-Step Timeline and WhatsApp Sync delivered to ${res.recipient_email} (Ref: ${res.ticket_number}).`,
      });
      fetchEmailData();
    } catch (err: any) {
      setSmtpTestResult({
        success: false,
        message: err.message || "Failed to dispatch maintenance notice email.",
      });
    } finally {
      setIsSendingNotice(false);
    }
  };

  const handleRetryFailed = async () => {
    setIsRetrying(true);
    setRetryResult(null);
    try {
      const res: any = await api.retryFailedEmails();
      setRetryResult(res.message || "Retrying queued emails.");
      fetchEmailData();
    } catch (err: any) {
      setRetryResult(`Retry error: ${err.message || err}`);
    } finally {
      setIsRetrying(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "sent":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="h-3 w-3" />
            Sent
          </span>
        );
      case "queued":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <Clock className="h-3 w-3 animate-spin" />
            Queued
          </span>
        );
      case "retrying":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            <RotateCcw className="h-3 w-3 animate-spin" />
            Retrying
          </span>
        );
      case "failed":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            <AlertCircle className="h-3 w-3" />
            Failed
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-xl bg-[#176B63] flex items-center justify-center text-white shadow-sm">
              <Mail className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                Hospital Email & SMTP Delivery System
              </h1>
              <p className="text-xs sm:text-sm text-slate-500">
                Audited transactional email delivery, SMTP server diagnostics, and automated patient/staff notifications.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchEmailData}
            disabled={isLoading}
            className="px-3.5 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>
          <button
            onClick={handleRetryFailed}
            disabled={isRetrying || (stats?.failed === 0 && stats?.retrying === 0)}
            className="px-3.5 py-2 rounded-xl bg-[#176B63] hover:bg-[#125852] disabled:opacity-50 text-white text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
          >
            <RotateCcw className={`h-3.5 w-3.5 ${isRetrying ? "animate-spin" : ""}`} />
            <span>Retry Failed Delivery</span>
          </button>
        </div>
      </div>

      {/* Live Server Connection Banner & Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Metric 1: Total */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-1">
          <div className="text-xs font-medium text-slate-500">Total Notifications Enqueued</div>
          <div className="text-2xl font-extrabold text-slate-900 font-mono">
            {stats?.total ?? 0}
          </div>
          <div className="text-[11px] text-slate-400">All patient, staff, & admin emails</div>
        </div>

        {/* Metric 2: Delivered */}
        <div className="p-4 rounded-2xl bg-white border border-emerald-100 shadow-2xs space-y-1">
          <div className="text-xs font-medium text-emerald-700 flex items-center justify-between">
            <span>Successfully Delivered</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-extrabold text-emerald-800 font-mono">
            {stats?.sent ?? 0}
          </div>
          <div className="text-[11px] text-emerald-600">
            {stats?.success_rate ?? 0}% overall delivery rate
          </div>
        </div>

        {/* Metric 3: Queued / Retrying */}
        <div className="p-4 rounded-2xl bg-white border border-amber-100 shadow-2xs space-y-1">
          <div className="text-xs font-medium text-amber-700 flex items-center justify-between">
            <span>In Background Queue</span>
            <Clock className="h-4 w-4 text-amber-500" />
          </div>
          <div className="text-2xl font-extrabold text-amber-800 font-mono">
            {(stats?.queued ?? 0) + (stats?.retrying ?? 0)}
          </div>
          <div className="text-[11px] text-amber-600">
            {stats?.queued ?? 0} initial, {stats?.retrying ?? 0} retry stage
          </div>
        </div>

        {/* Metric 4: Failed */}
        <div className="p-4 rounded-2xl bg-white border border-rose-100 shadow-2xs space-y-1">
          <div className="text-xs font-medium text-rose-700 flex items-center justify-between">
            <span>Delivery Failures</span>
            <AlertCircle className="h-4 w-4 text-rose-500" />
          </div>
          <div className="text-2xl font-extrabold text-rose-800 font-mono">
            {stats?.failed ?? 0}
          </div>
          <div className="text-[11px] text-rose-600">Exhausted retry threshold</div>
        </div>
      </div>

      {/* SMTP Connection & Live Diagnostic Tool */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-slate-100 text-slate-700">
              <Server className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Active SMTP Server Configuration</h2>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="font-mono text-xs text-slate-600">
                  {stats?.smtp_host || "127.0.0.1"}:{stats?.smtp_port || 587}
                </span>
                <span className="text-slate-300">•</span>
                <span className="text-xs text-slate-500">
                  Sender: <strong className="font-mono text-slate-700">{stats?.sender_email || "hospital-alerts@careops.ai"}</strong>
                </span>
                <span className="text-slate-300">•</span>
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.2 rounded-full text-[10px] font-bold ${
                    stats?.smtp_configured
                      ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                      : "bg-amber-50 text-amber-700 border border-amber-200"
                  }`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${stats?.smtp_configured ? "bg-emerald-500" : "bg-amber-500"}`} />
                  {stats?.smtp_configured ? "Production SMTP Configured" : "Default Local Fallback"}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={handleOpenConfigModal}
              className={`px-3.5 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all cursor-pointer ${
                stats?.smtp_configured
                  ? "bg-slate-900 hover:bg-slate-800 text-white"
                  : "bg-[#176B63] hover:bg-[#125852] text-white ring-2 ring-[#176B63]/40"
              }`}
            >
              <Settings className="h-3.5 w-3.5" />
              <span>{stats?.smtp_configured ? "Configure SMTP Server" : "Configure SMTP Credentials"}</span>
            </button>
            <div className="text-xs text-slate-400 hidden lg:block">
              Protected under HIPAA & NABH Compliance
            </div>
          </div>
        </div>

        {/* Live Test Form */}
        <form onSubmit={handleTestSmtp} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="flex-1 relative">
            <input
              type="email"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              placeholder="Enter recipient email to verify live SMTP delivery (e.g. admin@careops.hospital)"
              className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#176B63]/20 focus:border-[#176B63] transition-all font-mono"
            />
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="submit"
              disabled={isTestingSmtp || isSendingNotice}
              className="px-3.5 py-2.5 rounded-xl bg-[#176B63] hover:bg-[#125852] disabled:opacity-50 text-white text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-2xs"
              title="Send basic SMTP connection handshake test email"
            >
              <Send className={`h-3.5 w-3.5 ${isTestingSmtp ? "animate-spin" : ""}`} />
              <span>{isTestingSmtp ? "Testing..." : "Send Test Email"}</span>
            </button>
            <button
              type="button"
              onClick={handleSendMaintenanceNotice}
              disabled={isTestingSmtp || isSendingNotice}
              className="px-3.5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-2xs border border-slate-700"
              title="Dispatches official Happy Care complaint notice with 5-step milestone timeline and WhatsApp link"
            >
              <Sparkles className={`h-3.5 w-3.5 ${isSendingNotice ? "animate-spin text-teal-400" : "text-teal-400"}`} />
              <span>{isSendingNotice ? "Dispatching..." : "Send Maintenance Timeline Email"}</span>
            </button>
          </div>
        </form>

        {smtpTestResult && (
          <div
            className={`p-3 rounded-xl text-xs flex items-start gap-2.5 border ${
              smtpTestResult.success
                ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                : "bg-rose-50 text-rose-800 border-rose-200"
            }`}
          >
            {smtpTestResult.success ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
            )}
            <div>
              <strong className="block font-semibold">
                {smtpTestResult.success ? "SMTP Delivery Verified" : "SMTP Delivery Error"}
              </strong>
              <span>{smtpTestResult.message}</span>
              {!smtpTestResult.success && (
                <button
                  type="button"
                  onClick={handleOpenConfigModal}
                  className="mt-2 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-[11px] flex items-center gap-1.5 cursor-pointer transition-all shadow-xs"
                >
                  <Settings className="h-3 w-3" />
                  <span>Configure SMTP Server Credentials Now →</span>
                </button>
              )}
            </div>
          </div>
        )}

        {retryResult && (
          <div className="p-3 rounded-xl bg-blue-50 text-blue-800 border border-blue-200 text-xs flex items-center gap-2">
            <RotateCcw className="h-4 w-4 text-blue-600 shrink-0" />
            <span>{retryResult}</span>
          </div>
        )}
      </div>

      {/* Audit Log Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        {/* Table Controls */}
        <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-slate-900">Email Notification Log</h2>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 font-semibold">
              {logs.length} Records
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Filter by status */}
            <div className="flex items-center bg-white rounded-xl border border-slate-200 p-0.5 text-xs">
              {["all", "sent", "queued", "retrying", "failed"].map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`px-2.5 py-1 rounded-lg font-medium capitalize cursor-pointer transition-all ${
                    statusFilter === st
                      ? "bg-[#176B63] text-white shadow-2xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="h-3.5 w-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search recipient or subject..."
                className="pl-8 pr-3 py-1.5 text-xs rounded-xl bg-white border border-slate-200 focus:outline-none focus:ring-1 focus:ring-[#176B63]"
              />
            </div>
          </div>
        </div>

        {/* Table View */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Recipient</th>
                <th className="py-3 px-4">Role / Category</th>
                <th className="py-3 px-4">Subject</th>
                <th className="py-3 px-4">Attempts</th>
                <th className="py-3 px-4">Sent / Queued At</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(!Array.isArray(logs) || logs.length === 0) ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <Mail className="h-8 w-8 mx-auto mb-2 text-slate-300" />
                    <p className="font-medium">No email notification records found</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Emails generated by ticket creation, status changes, or test tool appear here.
                    </p>
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 whitespace-nowrap">
                      {getStatusBadge(log.status)}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-800">
                      <div className="font-semibold text-slate-900">{log.recipient_email}</div>
                      {log.recipient_name && (
                        <div className="text-[11px] text-slate-500 font-sans">{log.recipient_name}</div>
                      )}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="capitalize px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-medium text-[11px]">
                        {log.recipient_role || "general"}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-700 max-w-xs truncate font-medium">
                      {log.subject}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap text-slate-600">
                      <span className="font-mono">
                        {log.attempts} / {log.max_attempts}
                      </span>
                      {log.error_message && (
                        <div className="text-[10px] text-rose-600 font-sans max-w-xs truncate" title={log.error_message}>
                          {log.error_message}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap text-slate-500">
                      {formatDateTime(log.sent_at || log.created_at)}
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <button
                        onClick={() => setSelectedLog(log)}
                        className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium transition-colors cursor-pointer text-[11px] inline-flex items-center gap-1"
                      >
                        <Eye className="h-3 w-3" />
                        <span>Inspect</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Inspect Email Details */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-[#176B63]/10 text-[#176B63]">
                  <Mail className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Email Delivery Audit Inspection</h3>
                  <p className="text-xs text-slate-500">Reference ID #{selectedLog.id}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200">
                <div>
                  <span className="text-slate-400 block mb-0.5">Recipient</span>
                  <strong className="text-slate-800 font-mono text-[11px]">{selectedLog.recipient_email}</strong>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">Delivery Status</span>
                  {getStatusBadge(selectedLog.status)}
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">Role / Recipient Type</span>
                  <span className="font-medium text-slate-700 capitalize">{selectedLog.recipient_role || "general"}</span>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">Delivery Attempts</span>
                  <span className="font-mono text-slate-700">{selectedLog.attempts} of {selectedLog.max_attempts}</span>
                </div>
              </div>

              {selectedLog.error_message && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 space-y-1">
                  <div className="font-semibold flex items-center gap-1.5">
                    <AlertTriangle className="h-4 w-4 text-rose-600" />
                    <span>SMTP Delivery Error Diagnostic</span>
                  </div>
                  <pre className="text-[11px] font-mono whitespace-pre-wrap">{selectedLog.error_message}</pre>
                </div>
              )}

              <div>
                <span className="text-slate-500 font-semibold block mb-1">Subject Header</span>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 font-medium">
                  {selectedLog.subject}
                </div>
              </div>

              <div>
                <span className="text-slate-500 font-semibold block mb-1">Delivered Message Body</span>
                <div className="p-4 rounded-xl bg-white border border-slate-200 text-slate-800 leading-relaxed font-mono text-[11px] max-h-60 overflow-y-auto whitespace-pre-wrap">
                  {selectedLog.body_text || "No plain text content available"}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-200 flex justify-end bg-slate-50">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-semibold transition-all cursor-pointer text-xs"
              >
                Close Audit Record
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SMTP CONFIGURATION MODAL */}
      {showConfigModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/60">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-[#176B63] text-white">
                  <Server className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Configure SMTP Mail Server</h3>
                  <p className="text-xs text-slate-500">Live outbound healthcare email dispatch</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowConfigModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSaveConfig} className="p-6 space-y-4 text-xs">
              {configSuccessMsg && (
                <div className="p-3 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-2 font-medium">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                  <span>{configSuccessMsg}</span>
                </div>
              )}

              {configErrorMsg && (
                <div className="p-3 rounded-xl bg-rose-50 text-rose-800 border border-rose-200 flex items-center gap-2 font-medium">
                  <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
                  <span>{configErrorMsg}</span>
                </div>
              )}

              {/* Quick Presets */}
              <div>
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
                  Quick Provider Presets
                </span>
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => handleApplyPreset("gmail_ssl")}
                    className="px-2.5 py-1.5 rounded-lg border border-slate-200 hover:border-[#176B63] bg-slate-50 hover:bg-[#EDF7F2] text-slate-700 hover:text-[#176B63] font-bold text-[11px] transition-all cursor-pointer flex items-center gap-1"
                  >
                    <Sparkles className="h-3 w-3 text-amber-500" />
                    <span>Gmail (Port 465 SSL)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyPreset("gmail_tls")}
                    className="px-2.5 py-1.5 rounded-lg border border-slate-200 hover:border-[#176B63] bg-slate-50 hover:bg-[#EDF7F2] text-slate-700 hover:text-[#176B63] font-bold text-[11px] transition-all cursor-pointer"
                  >
                    Gmail (Port 587 TLS)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyPreset("outlook")}
                    className="px-2.5 py-1.5 rounded-lg border border-slate-200 hover:border-[#176B63] bg-slate-50 hover:bg-[#EDF7F2] text-slate-700 hover:text-[#176B63] font-bold text-[11px] transition-all cursor-pointer"
                  >
                    Office 365
                  </button>
                </div>
              </div>

              {/* Grid: Host & Port */}
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="font-bold text-slate-700 block mb-1">
                    SMTP Server Host *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="smtp.gmail.com"
                    value={smtpConfig.smtp_host}
                    onChange={(e) => setSmtpConfig({ ...smtpConfig, smtp_host: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:border-[#176B63] font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Port *
                  </label>
                  <input
                    type="number"
                    required
                    placeholder="465"
                    value={smtpConfig.smtp_port}
                    onChange={(e) => setSmtpConfig({ ...smtpConfig, smtp_port: parseInt(e.target.value, 10) || 465 })}
                    className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:border-[#176B63] font-mono text-xs"
                  />
                </div>
              </div>

              {/* Sender / From Address */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Sender From Address
                </label>
                <input
                  type="email"
                  placeholder="alerts@careops.hospital or your.email@gmail.com"
                  value={smtpConfig.smtp_from}
                  onChange={(e) => setSmtpConfig({ ...smtpConfig, smtp_from: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:border-[#176B63] font-mono text-xs"
                />
              </div>

              {/* SMTP Username */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  SMTP Username / Email Account *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. td4384407@gmail.com"
                  value={smtpConfig.smtp_user}
                  onChange={(e) => setSmtpConfig({ ...smtpConfig, smtp_user: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:border-[#176B63] font-mono text-xs"
                />
              </div>

              {/* SMTP Password */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-bold text-slate-700">
                    SMTP Password / Google App Password *
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-[11px] text-[#176B63] font-bold hover:underline cursor-pointer flex items-center gap-1"
                  >
                    {showPassword ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                    <span>{showPassword ? "Hide" : "Show"}</span>
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    placeholder="Enter 16-character App Password (e.g. abcd efgh ijkl mnop)"
                    value={smtpConfig.smtp_password}
                    onChange={(e) => setSmtpConfig({ ...smtpConfig, smtp_password: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:border-[#176B63] font-mono text-xs pl-8"
                  />
                  <Lock className="h-3.5 w-3.5 text-slate-400 absolute left-2.5 top-3" />
                </div>
              </div>

              {/* SSL Checkbox */}
              <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-700 p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                <input
                  type="checkbox"
                  checked={smtpConfig.smtp_use_ssl}
                  onChange={(e) => setSmtpConfig({ ...smtpConfig, smtp_use_ssl: e.target.checked })}
                  className="h-4 w-4 rounded text-[#176B63]"
                />
                <span>Use Direct SMTPS SSL (Recommended for Port 465)</span>
              </label>

              {/* Google App Password Helpful Instructions */}
              <div className="p-3 rounded-xl bg-[#EDF7F2] border border-[#A6E1CE] text-[#0F5147] text-[11px] space-y-1">
                <strong className="block font-bold">💡 How to create a Google App Password (Gmail):</strong>
                <ol className="list-decimal list-inside space-y-0.5 text-[#136C5F]">
                  <li>Go to your Google Account: <strong>Security → 2-Step Verification</strong>.</li>
                  <li>Scroll to <strong>App passwords</strong> (or search &quot;App passwords&quot;).</li>
                  <li>Name it <em>CareOps Hospital</em> and click <strong>Create</strong>.</li>
                  <li>Copy the 16 letters and paste into the Password field above.</li>
                </ol>
              </div>

              {/* Actions */}
              <div className="pt-2 border-t border-slate-200 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowConfigModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingConfig}
                  className="px-5 py-2 rounded-xl bg-[#176B63] hover:bg-[#125852] text-white font-bold text-xs flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  <span>{isSavingConfig ? "Saving & Testing..." : "Save SMTP Credentials"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
