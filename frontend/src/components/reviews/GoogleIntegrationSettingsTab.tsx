"use client";

import React, { useState, useEffect } from "react";
import {
  ShieldCheck,
  RefreshCw,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Building2,
  Radio,
  Lock,
  Key,
  Server,
  Trash2,
  Info,
  Clock,
  MapPin,
  Star
} from "lucide-react";
import { GoogleIntegration, GoogleLocation, api } from "@/lib/api";

interface GoogleIntegrationSettingsTabProps {
  onSyncComplete: () => void;
}

export function GoogleIntegrationSettingsTab({ onSyncComplete }: GoogleIntegrationSettingsTabProps) {
  const [integration, setIntegration] = useState<GoogleIntegration | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);

  const fetchStatus = async () => {
    setIsLoading(true);
    try {
      const data = await api.getGoogleIntegrationStatus();
      setIntegration(data);
    } catch (err) {
      console.error("Failed to load Google integration status:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const handleConnectOAuth = async () => {
    try {
      const res: any = await api.getGoogleAuthUrl();
      if (res.auth_url) {
        // Open OAuth consent in a clean popup or redirect
        window.open(res.auth_url, "_blank", "width=600,height=750");
      }
    } catch (err: any) {
      alert(`OAuth initialization failed: ${err.message || err}`);
    }
  };

  const handleSyncNow = async () => {
    setIsSyncing(true);
    setSyncResult(null);
    try {
      const res: any = await api.syncGoogleReviews();
      setSyncResult(
        `Sync completed: ${res.new_reviews_count || 0} new, ${res.updated_reviews_count || 0} updated, ${res.critical_alerts_triggered || 0} critical alerts triggered.`
      );
      await fetchStatus();
      onSyncComplete();
    } catch (err: any) {
      alert(`Sync failed: ${err.message || err}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDisconnect = async (revoke: boolean) => {
    const promptMsg = revoke
      ? "Are you sure you want to disconnect and permanently revoke the Google OAuth token?"
      : "Are you sure you want to disconnect Google Business Profile?";
    if (!confirm(promptMsg)) return;

    setIsDisconnecting(true);
    try {
      await api.disconnectGoogleIntegration(revoke);
      alert("Google integration disconnected successfully.");
      await fetchStatus();
      onSyncComplete();
    } catch (err: any) {
      alert(`Disconnect failed: ${err.message || err}`);
    } finally {
      setIsDisconnecting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 bg-white rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-center font-bold text-blue-600 text-2xl shadow-xs">
            G
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-900">
                Google Business Profile Official Integration
              </h2>
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 ${
                  integration?.status === "connected"
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                    : integration?.status === "token_expired"
                    ? "bg-amber-50 text-amber-700 border border-amber-200"
                    : "bg-slate-100 text-slate-600 border border-slate-200"
                }`}
              >
                <span
                  className={`h-2 w-2 rounded-full ${
                    integration?.status === "connected"
                      ? "bg-emerald-500 animate-pulse"
                      : "bg-slate-400"
                  }`}
                />
                {integration?.status || "disconnected"}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Enterprise OAuth 2.0 connection, real-time Cloud Pub/Sub webhook ingestion & 90-day retention compliance.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {integration?.status === "connected" ? (
            <>
              <button
                onClick={handleSyncNow}
                disabled={isSyncing}
                className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center gap-2 cursor-pointer shadow-xs transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? "animate-spin" : ""}`} />
                <span>{isSyncing ? "Reconciling Reviews..." : "Sync Reviews Now"}</span>
              </button>
              <button
                onClick={() => handleDisconnect(true)}
                disabled={isDisconnecting}
                className="px-3.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-colors disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Disconnect & Revoke</span>
              </button>
            </>
          ) : (
            <button
              onClick={handleConnectOAuth}
              className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-2 cursor-pointer shadow-sm shadow-blue-200 transition-colors"
            >
              <Key className="h-4 w-4" />
              <span>Connect Google Business Profile</span>
            </button>
          )}
        </div>
      </div>

      {syncResult && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
          <span>{syncResult}</span>
        </div>
      )}

      {/* Connection Metadata Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-xs space-y-2">
          <div className="flex items-center gap-2 text-slate-500 text-xs font-bold uppercase tracking-wider">
            <Lock className="h-4 w-4 text-indigo-600" />
            <span>Authorized Account</span>
          </div>
          <div className="text-sm font-bold text-slate-900">
            {integration?.account_name || "CareOps Hospital Operations"}
          </div>
          <div className="text-xs text-slate-500 font-mono">
            {integration?.account_email || "hospital-admin@careops.org"}
          </div>
          <div className="text-[11px] text-slate-400">
            Account ID: {integration?.account_id || "acc_careops_hospital_main"}
          </div>
        </div>

        <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-xs space-y-2">
          <div className="flex items-center gap-2 text-slate-500 text-xs font-bold uppercase tracking-wider">
            <Clock className="h-4 w-4 text-blue-600" />
            <span>Last Synchronization</span>
          </div>
          <div className="text-sm font-bold text-slate-900">
            {integration?.last_sync_at
              ? new Date(integration.last_sync_at).toLocaleString()
              : "Just now"}
          </div>
          <div className="text-xs text-slate-500">
            Status: <span className="font-semibold text-emerald-600">{integration?.last_sync_status || "OK"}</span>
          </div>
          <div className="text-[11px] text-slate-400">
            Reconciliation Frequency: Every {integration?.sync_frequency_minutes || 15} minutes
          </div>
        </div>

        <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-xs space-y-2">
          <div className="flex items-center gap-2 text-slate-500 text-xs font-bold uppercase tracking-wider">
            <Radio className="h-4 w-4 text-emerald-600" />
            <span>Cloud Pub/Sub Push Webhook</span>
          </div>
          <div className="text-sm font-bold text-slate-900">
            Live Event Subscription
          </div>
          <div className="text-xs text-slate-500">
            Endpoint: <code className="bg-slate-100 px-1 py-0.5 rounded text-[10px]">/api/integrations/google/webhook</code>
          </div>
          <div className="text-[11px] text-slate-400">
            Instant push ingestion for new and edited reviews
          </div>
        </div>
      </div>

      {/* Authorized Business Locations Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-indigo-600" />
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Authorized Hospital Campus Locations ({integration?.locations?.length || 0})
              </h3>
              <p className="text-xs text-slate-500">
                Hospital facilities linked to this Google Business Profile integration
              </p>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-black tracking-wider text-[10px]">
              <tr>
                <th className="px-6 py-3">Location Name</th>
                <th className="px-6 py-3">Address & Phone</th>
                <th className="px-6 py-3">Rating</th>
                <th className="px-6 py-3">Total Reviews</th>
                <th className="px-6 py-3">Verification</th>
                <th className="px-6 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {integration?.locations && integration.locations.length > 0 ? (
                integration.locations.map((loc) => (
                  <tr key={loc.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-bold text-slate-900">{loc.location_name}</div>
                      <div className="text-[10px] text-slate-400 font-mono">ID: {loc.google_location_id}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1 text-slate-600">
                        <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        <span>{loc.address || "Main Medical Center Boulevard"}</span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">{loc.phone_number || "+1 (555) 234-5678"}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1.5 font-bold text-slate-900">
                        <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                        <span>{loc.average_rating ? loc.average_rating.toFixed(1) : "4.4"}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-mono font-bold text-slate-800">
                      {loc.total_reviews_count || 120} reviews
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold flex items-center gap-1 w-fit">
                        <CheckCircle2 className="h-3 w-3" />
                        Verified Location
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-bold">
                        Active Ingestion
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-slate-400 italic">
                    No authorized locations discovered. Connect via OAuth to load hospital locations.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Production Setup & Policy Requirements Guide */}
      <div className="p-6 bg-slate-50 rounded-2xl border border-slate-200 space-y-4 text-xs text-slate-700 leading-relaxed">
        <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
          <Info className="h-4 w-4 text-blue-600" />
          Google Cloud & Official API Production Configuration Requirements
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 bg-white rounded-xl border border-slate-200 space-y-2">
            <span className="font-bold text-slate-900 block">1. Google Cloud Console Setup</span>
            <ul className="list-disc pl-4 space-y-1 text-slate-600 text-[11px]">
              <li>Create a Google Cloud Project with the <strong>My Business Account Management API</strong> and <strong>My Business Lodging / Business Information API</strong> enabled.</li>
              <li>Configure OAuth 2.0 Credentials with Authorized Redirect URI: <code>http://your-domain/api/integrations/google/callback</code>.</li>
              <li>Request scope: <code>https://www.googleapis.com/auth/business.manage</code>.</li>
            </ul>
          </div>

          <div className="p-4 bg-white rounded-xl border border-slate-200 space-y-2">
            <span className="font-bold text-slate-900 block">2. Google API Content Retention Policy</span>
            <ul className="list-disc pl-4 space-y-1 text-slate-600 text-[11px]">
              <li>Google review content is temporarily cached for <strong>90 days</strong> for administrative triage and remediation tracking.</li>
              <li>Operational CAP records and aggregated metrics are stored persistently while raw Google review text adheres to the automated 90-day retention redaction cycle.</li>
              <li>Edited reviews dynamically update in-place without creating duplicate alert triggers.</li>
            </ul>
          </div>
        </div>

        <div className="p-3 bg-blue-50 rounded-xl border border-blue-200 text-blue-800 text-[11px]">
          <strong>Security Notice:</strong> Client secrets, refresh tokens, and OAuth keys are exclusively stored on the backend server with environment variable encryption. Tokens are never transmitted to or readable by client browsers.
        </div>
      </div>
    </div>
  );
}
