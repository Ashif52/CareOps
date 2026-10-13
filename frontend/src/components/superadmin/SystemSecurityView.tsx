"use client";

import React, { useState, useEffect } from "react";
import {
  Shield,
  Lock,
  Smartphone,
  Sparkles,
  Save,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  KeyRound,
  Clock,
  Eye,
  EyeOff
} from "lucide-react";
import { api } from "@/lib/api";

export function SystemSecurityView() {
  const [settings, setSettings] = useState({
    max_failed_logins: 3,
    lockout_duration_minutes: 30,
    session_timeout_minutes: 60,
    require_password_symbols: true,
    require_password_min_length: 8,
    whatsapp_provider: "meta_business_api",
    whatsapp_phone_number_id: "",
    whatsapp_business_account_id: "",
    whatsapp_api_token: "",
    ai_vision_provider: "mock",
    ai_vision_model: "careops-vision-default",
    openai_api_key: "",
    gemini_api_key: "",
    anthropic_api_key: "",
  });

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [showTokens, setShowTokens] = useState(false);

  const loadSettings = async () => {
    setIsLoading(true);
    try {
      const res: any = await api.getSecuritySettings();
      if (res) {
        setSettings({
          max_failed_logins: res.max_failed_logins || 3,
          lockout_duration_minutes: res.lockout_duration_minutes || 30,
          session_timeout_minutes: res.session_timeout_minutes || 60,
          require_password_symbols: res.require_password_symbols ?? true,
          require_password_min_length: res.require_password_min_length || 8,
          whatsapp_provider: res.whatsapp_provider || "meta_business_api",
          whatsapp_phone_number_id: res.whatsapp_phone_number_id || "",
          whatsapp_business_account_id: res.whatsapp_business_account_id || "",
          whatsapp_api_token: res.whatsapp_api_token || "",
          ai_vision_provider: res.ai_vision_provider || "mock",
          ai_vision_model: res.ai_vision_model || "careops-vision-default",
          openai_api_key: res.openai_api_key || "",
          gemini_api_key: res.gemini_api_key || "",
          anthropic_api_key: res.anthropic_api_key || "",
        });
      }
    } catch (err: any) {
      console.error("Failed to load security settings:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await api.updateSecuritySettings(settings);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      alert(`Save error: ${err.message || err}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#E5E9EF] pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-[#FEE2E2] rounded-xl text-[#DC2626]">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-[#17212F] flex items-center gap-2">
                System Security & Provider Integrations
                <span className="px-2 py-0.5 rounded-full bg-[#DC2626]/10 text-[#DC2626] text-[10px] font-bold uppercase tracking-wider">
                  Super Admin Only
                </span>
              </h1>
              <p className="text-xs text-[#667085] mt-0.5">
                Authentication lockout thresholds, WhatsApp Business gateway credentials, and AI vision model configurations.
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={loadSettings}
          disabled={isLoading}
          className="p-2 bg-white hover:bg-[#F7F8FA] border border-[#E5E9EF] rounded-lg text-[#667085] hover:text-[#17212F] transition cursor-pointer"
          title="Reload settings"
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {saveSuccess && (
        <div className="bg-[#EDF7F2] border border-[#A6E1CE] rounded-xl p-4 text-[#16805D] text-xs font-semibold flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>Security settings and provider credentials updated successfully in PostgreSQL.</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* 1. Authentication & Session Policies */}
        <div className="bg-white rounded-xl border border-[#E5E9EF] p-5 shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-[#F2F4F7] pb-3">
            <Lock className="h-4 w-4 text-[#3868C9]" />
            <h2 className="text-sm font-bold text-[#17212F]">Authentication Security & Account Lockout</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="text-[#344054] font-semibold block mb-1">Max Failed Login Attempts</label>
              <input
                type="number"
                min={2}
                max={10}
                value={settings.max_failed_logins}
                onChange={(e) => setSettings({ ...settings, max_failed_logins: parseInt(e.target.value) || 3 })}
                className="w-full px-3 py-2 border border-[#D0D5DD] rounded-lg focus:outline-hidden focus:border-[#3868C9]"
              />
              <span className="text-[11px] text-[#667085] mt-0.5 block">Locks account after consecutive failures</span>
            </div>

            <div>
              <label className="text-[#344054] font-semibold block mb-1">Lockout Duration (Minutes)</label>
              <input
                type="number"
                min={5}
                max={1440}
                value={settings.lockout_duration_minutes}
                onChange={(e) => setSettings({ ...settings, lockout_duration_minutes: parseInt(e.target.value) || 30 })}
                className="w-full px-3 py-2 border border-[#D0D5DD] rounded-lg focus:outline-hidden focus:border-[#3868C9]"
              />
              <span className="text-[11px] text-[#667085] mt-0.5 block">Time before automatic unlock</span>
            </div>

            <div>
              <label className="text-[#344054] font-semibold block mb-1">Session Inactivity Timeout (Minutes)</label>
              <input
                type="number"
                min={15}
                max={480}
                value={settings.session_timeout_minutes}
                onChange={(e) => setSettings({ ...settings, session_timeout_minutes: parseInt(e.target.value) || 60 })}
                className="w-full px-3 py-2 border border-[#D0D5DD] rounded-lg focus:outline-hidden focus:border-[#3868C9]"
              />
              <span className="text-[11px] text-[#667085] mt-0.5 block">Auto-logout on idle browser tabs</span>
            </div>
          </div>
        </div>

        {/* 2. WhatsApp Business Gateway */}
        <div className="bg-white rounded-xl border border-[#E5E9EF] p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-[#F2F4F7] pb-3">
            <div className="flex items-center gap-2">
              <Smartphone className="h-4 w-4 text-[#16805D]" />
              <h2 className="text-sm font-bold text-[#17212F]">WhatsApp Business Platform Integration</h2>
            </div>
            <span className="px-2 py-0.5 bg-[#EDF7F2] text-[#16805D] text-[10px] font-bold rounded-full">
              Carrier Verified Sandbox
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="text-[#344054] font-semibold block mb-1">Provider API Gateway</label>
              <select
                value={settings.whatsapp_provider}
                onChange={(e) => setSettings({ ...settings, whatsapp_provider: e.target.value })}
                className="w-full px-3 py-2 border border-[#D0D5DD] rounded-lg focus:outline-hidden focus:border-[#16805D] bg-white"
              >
                <option value="meta_business_api">Official Meta WhatsApp Business Cloud API</option>
                <option value="twilio_whatsapp">Twilio WhatsApp BSP</option>
                <option value="careops_sandbox">CareOps Sandbox Dispatcher</option>
              </select>
            </div>

            <div>
              <label className="text-[#344054] font-semibold block mb-1">WhatsApp Phone Number ID</label>
              <input
                type="text"
                value={settings.whatsapp_phone_number_id}
                onChange={(e) => setSettings({ ...settings, whatsapp_phone_number_id: e.target.value })}
                placeholder="e.g. 104829104820194"
                className="w-full px-3 py-2 border border-[#D0D5DD] rounded-lg font-mono focus:outline-hidden focus:border-[#16805D]"
              />
            </div>

            <div>
              <label className="text-[#344054] font-semibold block mb-1">Business Account ID (WABA)</label>
              <input
                type="text"
                value={settings.whatsapp_business_account_id}
                onChange={(e) => setSettings({ ...settings, whatsapp_business_account_id: e.target.value })}
                placeholder="e.g. 948201847192039"
                className="w-full px-3 py-2 border border-[#D0D5DD] rounded-lg font-mono focus:outline-hidden focus:border-[#16805D]"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[#344054] font-semibold">System Access Token</label>
                <button
                  type="button"
                  onClick={() => setShowTokens(!showTokens)}
                  className="text-[11px] text-[#3868C9] hover:underline flex items-center gap-1 cursor-pointer"
                >
                  {showTokens ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                  <span>{showTokens ? "Hide" : "Show"}</span>
                </button>
              </div>
              <input
                type={showTokens ? "text" : "password"}
                value={settings.whatsapp_api_token}
                onChange={(e) => setSettings({ ...settings, whatsapp_api_token: e.target.value })}
                placeholder="EAAX... Permanent System User Token"
                className="w-full px-3 py-2 border border-[#D0D5DD] rounded-lg font-mono focus:outline-hidden focus:border-[#16805D]"
              />
            </div>
          </div>
        </div>

        {/* 3. AI Vision Provider Configuration */}
        <div className="bg-white rounded-xl border border-[#E5E9EF] p-5 shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-[#F2F4F7] pb-3">
            <Sparkles className="h-4 w-4 text-[#7C3AED]" />
            <h2 className="text-sm font-bold text-[#17212F]">AI Multimodal Vision Model Engine</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="text-[#344054] font-semibold block mb-1">Active AI Vision Provider</label>
              <select
                value={settings.ai_vision_provider}
                onChange={(e) => {
                  const prov = e.target.value;
                  let defaultModel = "careops-vision-default";
                  if (prov === "openai") defaultModel = "gpt-4o";
                  else if (prov === "gemini") defaultModel = "gemini-1.5-flash";
                  else if (prov === "anthropic") defaultModel = "claude-3-5-sonnet";
                  setSettings({ ...settings, ai_vision_provider: prov, ai_vision_model: defaultModel });
                }}
                className="w-full px-3 py-2 border border-[#D0D5DD] rounded-lg focus:outline-hidden focus:border-[#7C3AED] bg-white font-semibold"
              >
                <option value="mock">CareOps Deterministic Vision Engine (High-Precision Sandbox)</option>
                <option value="openai">OpenAI Vision (GPT-4o / GPT-4o-mini)</option>
                <option value="gemini">Google Gemini Vision (Gemini 1.5 Pro / Flash)</option>
                <option value="anthropic">Anthropic Claude Vision (Claude 3.5 Sonnet)</option>
              </select>
            </div>

            <div>
              <label className="text-[#344054] font-semibold block mb-1">Selected Model Identifier</label>
              <input
                type="text"
                value={settings.ai_vision_model}
                onChange={(e) => setSettings({ ...settings, ai_vision_model: e.target.value })}
                className="w-full px-3 py-2 border border-[#D0D5DD] rounded-lg font-mono focus:outline-hidden focus:border-[#7C3AED]"
              />
            </div>

            {settings.ai_vision_provider === "openai" && (
              <div className="col-span-2">
                <label className="text-[#344054] font-semibold block mb-1">OpenAI API Key</label>
                <input
                  type={showTokens ? "text" : "password"}
                  value={settings.openai_api_key}
                  onChange={(e) => setSettings({ ...settings, openai_api_key: e.target.value })}
                  placeholder="sk-proj-..."
                  className="w-full px-3 py-2 border border-[#D0D5DD] rounded-lg font-mono"
                />
              </div>
            )}

            {settings.ai_vision_provider === "gemini" && (
              <div className="col-span-2">
                <label className="text-[#344054] font-semibold block mb-1">Google Gemini API Key</label>
                <input
                  type={showTokens ? "text" : "password"}
                  value={settings.gemini_api_key}
                  onChange={(e) => setSettings({ ...settings, gemini_api_key: e.target.value })}
                  placeholder="AIzaSy..."
                  className="w-full px-3 py-2 border border-[#D0D5DD] rounded-lg font-mono"
                />
              </div>
            )}

            {settings.ai_vision_provider === "anthropic" && (
              <div className="col-span-2">
                <label className="text-[#344054] font-semibold block mb-1">Anthropic API Key</label>
                <input
                  type={showTokens ? "text" : "password"}
                  value={settings.anthropic_api_key}
                  onChange={(e) => setSettings({ ...settings, anthropic_api_key: e.target.value })}
                  placeholder="sk-ant-api03-..."
                  className="w-full px-3 py-2 border border-[#D0D5DD] rounded-lg font-mono"
                />
              </div>
            )}
          </div>
        </div>

        {/* Save Bar */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="submit"
            disabled={isSaving}
            className="inline-flex items-center gap-1.5 px-6 py-2.5 bg-[#17212F] hover:bg-[#253243] text-white rounded-lg text-xs font-bold transition shadow-xs cursor-pointer disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            <span>{isSaving ? "Saving System Settings..." : "Save System Settings"}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
