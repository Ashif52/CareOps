import React, { useState, useEffect } from "react";
import {
  Clock,
  AlertTriangle,
  Play,
  CheckCircle2,
  Bell,
  ShieldAlert,
  Flame,
  ArrowRight,
  RefreshCw,
  Mail,
  Phone,
  ShieldCheck,
  Edit3,
  Save,
  Send,
  Database,
  X
} from "lucide-react";
import { SLAPolicy, EscalationLog, api } from "@/lib/api";

interface SLAPoliciesViewProps {
  policies: SLAPolicy[];
  escalations: EscalationLog[];
  onRunSLACheck: () => void;
  isRunningCheck?: boolean;
  onSelectTicket: (ticketId: number) => void;
}

export function SLAPoliciesView({
  policies,
  escalations,
  onRunSLACheck,
  isRunningCheck = false,
  onSelectTicket,
}: SLAPoliciesViewProps) {
  const [showConfigEditor, setShowConfigEditor] = useState(false);
  const [config, setConfig] = useState<any>({
    work_email: "",
    maintenance_email: "maintenance@careops.hospital",
    maintenance_mobile: "+91 98765 00003",
    smtp_host: "",
    smtp_port: 465,
    smtp_user: "",
    smtp_password: "",
    smtp_from: "alerts@careops.hospital",
    smtp_use_ssl: true,
    source: "database"
  });
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [isTestingSMTPS, setIsTestingSMTPS] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [testResultMsg, setTestResultMsg] = useState<string | null>(null);

  useEffect(() => {
    const fetchConf = async () => {
      try {
        const data = await api.getEscalationSettings();
        if (data) {
          setConfig(data);
        }
      } catch (err) {
        console.error("Failed to load escalation settings:", err);
      }
    };
    fetchConf();
  }, []);

  const handleSaveToDatabase = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingConfig(true);
    setSaveSuccessMsg(null);
    setTestResultMsg(null);
    try {
      const res: any = await api.updateEscalationSettings(config);
      setConfig(res.settings || config);
      setSaveSuccessMsg("Successfully written directly to database! Changes are active immediately.");
      setTimeout(() => setSaveSuccessMsg(null), 4000);
    } catch (err: any) {
      alert(`Failed to save to database: ${err.message || err}`);
    } finally {
      setIsSavingConfig(false);
    }
  };

  const handleTestSMTPS = async () => {
    setIsTestingSMTPS(true);
    setTestResultMsg(null);
    try {
      const res: any = await api.testSMTPSConnection({
        target_email: config.work_email || config.maintenance_email
      });
      if (res.success) {
        setTestResultMsg(`SMTPS dispatch verified to ${res.recipient} & mobile ${res.mobile} (${res.delivery_status})!`);
      } else {
        setTestResultMsg(`SMTPS response: ${res.delivery_status}. Error: ${res.error || "Check credentials"}`);
      }
    } catch (err: any) {
      alert(`Test failed: ${err.message || err}`);
    } finally {
      setIsTestingSMTPS(false);
    }
  };

  return (
    <div className="p-8 sm:p-10 space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-[#176B63] text-white shadow-md shadow-[#176B63]/20">
              <Clock className="h-6 w-6" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-[#0F172A] tracking-tight">
              Escalation
            </h1>
          </div>
          <p className="text-sm sm:text-base text-[#475569] mt-1 font-medium">
            Configurable hospital operational response targets & automated supervisor escalation
          </p>
        </div>

        <button
          onClick={onRunSLACheck}
          disabled={isRunningCheck}
          className="px-5 py-2.5 rounded-2xl bg-[#176B63] hover:bg-[#10574F] text-white text-sm font-bold shadow-md shadow-[#176B63]/25 flex items-center gap-2.5 transition-all disabled:opacity-50 cursor-pointer"
        >
          <RefreshCw className={`h-4 w-4 ${isRunningCheck ? "animate-spin" : ""}`} />
          <span>{isRunningCheck ? "Scanning Tickets..." : "Run SLA Scan Cycle Now"}</span>
        </button>
      </div>

      {/* SMTPS Maintenance Escalation Routing Card & Database Editor */}
      <div className="bg-white rounded-3xl border-2 border-[#CBD5E1] shadow-sm p-6 sm:p-7 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-[#DC2626]/10 text-[#DC2626]">
              <ShieldAlert className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-black text-lg text-[#0F172A] flex items-center gap-2">
                <span>Maintenance Department SMTPS & Mobile Escalation Routing</span>
                <span className="px-2 py-0.5 rounded-md bg-[#EDF7F2] text-[#16805D] text-[11px] font-black uppercase border border-[#A6E1CE] flex items-center gap-1">
                  <Database className="h-3 w-3" />
                  Database Persisted
                </span>
              </h3>
              <p className="text-xs text-[#64748B]">
                Automated multi-channel emergency alert routing for SLA target breaches and patient priority escalations
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowConfigEditor(!showConfigEditor)}
              className="px-4 py-2 rounded-xl bg-[#0F172A] hover:bg-[#1E293B] text-white font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Edit3 className="h-3.5 w-3.5" />
              <span>{showConfigEditor ? "Hide Configuration Form" : "Edit Database Routing"}</span>
            </button>
          </div>
        </div>

        {/* Display Status Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t border-[#F1F5F9] text-xs">
          <div className="p-4 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-1">
            <div className="flex items-center gap-2 text-[#64748B] font-bold">
              <Mail className="h-4 w-4 text-[#176B63]" />
              <span>Active Work Email Destination</span>
            </div>
            <strong className="block text-sm text-[#0F172A] font-mono truncate">
              {config.work_email || (
                <span className="text-[#94A3B8] font-sans font-normal italic">
                  Not configured (Defaulting to Maintenance Email)
                </span>
              )}
            </strong>
            <span className="text-[11px] text-[#64748B]">
              Direct work recipient for all patient and SLA escalation dispatches
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-1">
            <div className="flex items-center gap-2 text-[#64748B] font-bold">
              <Mail className="h-4 w-4 text-[#2563EB]" />
              <span>Maintenance Department Email</span>
            </div>
            <strong className="block text-sm text-[#0F172A] font-mono truncate">
              {config.maintenance_email || "maintenance@careops.hospital"}
            </strong>
            <span className="text-[11px] text-[#64748B]">
              Primary department inbox and supervisor routing
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-1">
            <div className="flex items-center gap-2 text-[#64748B] font-bold">
              <Phone className="h-4 w-4 text-[#DC2626]" />
              <span>Supervisor Mobile Number</span>
            </div>
            <strong className="block text-sm text-[#DC2626] font-mono">
              {config.maintenance_mobile || "+91 98765 00003"}
            </strong>
            <span className="text-[11px] text-[#64748B]">
              Direct SMS gateway and phone escalation dispatch
            </span>
          </div>
        </div>

        {/* Feedback Alerts */}
        {saveSuccessMsg && (
          <div className="p-3.5 bg-[#EDF7F2] border border-[#A6E1CE] text-[#16805D] text-xs font-bold rounded-xl flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{saveSuccessMsg}</span>
          </div>
        )}

        {testResultMsg && (
          <div className="p-3.5 bg-[#EFF6FF] border border-[#BFDBFE] text-[#1D4ED8] text-xs font-bold rounded-xl flex items-center gap-2">
            <Send className="h-4 w-4 shrink-0" />
            <span>{testResultMsg}</span>
          </div>
        )}

        {/* Direct Database Configuration Form */}
        {showConfigEditor && (
          <form
            onSubmit={handleSaveToDatabase}
            className="p-5 bg-[#F8FAFC] rounded-2xl border-2 border-[#CBD5E1] space-y-4 text-xs animate-in fade-in duration-200"
          >
            <div className="flex items-center justify-between pb-2 border-b border-[#E2E8F0]">
              <span className="font-bold text-[#0F172A] text-sm flex items-center gap-1.5">
                <Database className="h-4 w-4 text-[#176B63]" />
                <span>Write Escalation & SMTPS Settings Directly into Database</span>
              </span>
              <span className="text-[11px] text-[#64748B]">
                Persisted in table <code>escalation_settings</code>
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="font-bold text-[#0F172A] block mb-1">
                  Work Email (Escalation Recipient)
                </label>
                <input
                  type="email"
                  placeholder="director.operations@hospital.com"
                  value={config.work_email || ""}
                  onChange={(e) => setConfig({ ...config, work_email: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-[#CBD5E1] bg-white text-xs text-[#0F172A] focus:outline-none focus:border-[#176B63]"
                />
                <span className="text-[10px] text-[#64748B] mt-0.5 block">
                  When set, patient escalations route directly to this address.
                </span>
              </div>

              <div>
                <label className="font-bold text-[#0F172A] block mb-1">
                  Maintenance Department Email
                </label>
                <input
                  type="email"
                  placeholder="maintenance@careops.hospital"
                  value={config.maintenance_email || ""}
                  onChange={(e) => setConfig({ ...config, maintenance_email: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-[#CBD5E1] bg-white text-xs text-[#0F172A] focus:outline-none focus:border-[#176B63]"
                />
                <span className="text-[10px] text-[#64748B] mt-0.5 block">
                  Department inbox & supervisor destination.
                </span>
              </div>

              <div>
                <label className="font-bold text-[#0F172A] block mb-1">
                  Supervisor Mobile Number
                </label>
                <input
                  type="text"
                  placeholder="+91 98765 00003"
                  value={config.maintenance_mobile || ""}
                  onChange={(e) => setConfig({ ...config, maintenance_mobile: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-[#CBD5E1] bg-white text-xs text-[#0F172A] focus:outline-none focus:border-[#176B63]"
                />
                <span className="text-[10px] text-[#64748B] mt-0.5 block">
                  Mobile number for instant SMS & phone alerts.
                </span>
              </div>
            </div>

            {/* SMTPS Credentials Grid */}
            <div className="pt-2 border-t border-[#E2E8F0]">
              <span className="font-bold text-[#475569] block mb-2 text-[11px] uppercase tracking-wider">
                SMTPS Server Authentication (Port 465 SSL or Port 587 STARTTLS)
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <label className="font-bold text-[#0F172A] block mb-1">SMTP Host</label>
                  <input
                    type="text"
                    placeholder="smtp.gmail.com"
                    value={config.smtp_host || ""}
                    onChange={(e) => setConfig({ ...config, smtp_host: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-[#CBD5E1] bg-white text-xs text-[#0F172A] focus:outline-none focus:border-[#176B63]"
                  />
                </div>

                <div>
                  <label className="font-bold text-[#0F172A] block mb-1">SMTP Port</label>
                  <input
                    type="number"
                    placeholder="465"
                    value={config.smtp_port || 465}
                    onChange={(e) => setConfig({ ...config, smtp_port: parseInt(e.target.value, 10) || 465 })}
                    className="w-full p-2.5 rounded-xl border border-[#CBD5E1] bg-white text-xs text-[#0F172A] focus:outline-none focus:border-[#176B63]"
                  />
                </div>

                <div>
                  <label className="font-bold text-[#0F172A] block mb-1">SMTP User / Email</label>
                  <input
                    type="text"
                    placeholder="alerts@hospital.com"
                    value={config.smtp_user || ""}
                    onChange={(e) => setConfig({ ...config, smtp_user: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-[#CBD5E1] bg-white text-xs text-[#0F172A] focus:outline-none focus:border-[#176B63]"
                  />
                </div>

                <div>
                  <label className="font-bold text-[#0F172A] block mb-1">SMTP Password</label>
                  <input
                    type="password"
                    placeholder="App password"
                    value={config.smtp_password || ""}
                    onChange={(e) => setConfig({ ...config, smtp_password: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-[#CBD5E1] bg-white text-xs text-[#0F172A] focus:outline-none focus:border-[#176B63]"
                  />
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <label className="flex items-center gap-2 cursor-pointer font-bold text-[#0F172A]">
                  <input
                    type="checkbox"
                    checked={config.smtp_use_ssl ?? true}
                    onChange={(e) => setConfig({ ...config, smtp_use_ssl: e.target.checked })}
                    className="h-4 w-4 rounded text-[#176B63]"
                  />
                  <span>Use Direct SMTPS SSL (Port 465)</span>
                </label>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleTestSMTPS}
                    disabled={isTestingSMTPS}
                    className="px-4 py-2 rounded-xl bg-white hover:bg-[#F1F5F9] border-2 border-[#CBD5E1] text-[#0F172A] font-bold text-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <Send className={`h-3.5 w-3.5 ${isTestingSMTPS ? "animate-pulse" : ""}`} />
                    <span>{isTestingSMTPS ? "Testing..." : "Send Test SMTPS Alert"}</span>
                  </button>

                  <button
                    type="submit"
                    disabled={isSavingConfig}
                    className="px-5 py-2 rounded-xl bg-[#176B63] hover:bg-[#10574F] text-white font-bold text-xs flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
                  >
                    <Save className="h-3.5 w-3.5" />
                    <span>{isSavingConfig ? "Saving to Database..." : "Save Directly to Database"}</span>
                  </button>
                </div>
              </div>
            </div>
          </form>
        )}
      </div>

      {/* SLA Policy Table */}
      <div className="bg-white rounded-3xl border-2 border-[#94A3B8] shadow-lg overflow-hidden space-y-0">
        <div className="p-6 sm:p-7 border-b-2 border-[#CBD5E1] flex items-center justify-between bg-[#F8FAFC]">
          <div>
            <h3 className="font-black text-xl sm:text-2xl text-[#0F172A]">Active SLA Target Matrix</h3>
            <p className="text-sm sm:text-base text-[#334155] font-semibold mt-1">
              Response and resolution deadlines enforced by persistent background worker
            </p>
          </div>
          <span className="text-sm sm:text-base font-black text-[#0D9488] bg-[#E8F3F1] px-4 py-1.5 rounded-full border-2 border-[#99F6E4] shadow-xs">
            {policies.length} Active Policies
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#E2E8F0] border-b-2 border-[#94A3B8] text-sm sm:text-base font-black text-[#0F172A] uppercase tracking-wider">
                <th className="py-4.5 px-6">Department</th>
                <th className="py-4.5 px-6">Priority</th>
                <th className="py-4.5 px-6">Ack Target</th>
                <th className="py-4.5 px-6">Resolution Target</th>
                <th className="py-4.5 px-6">Reminders</th>
                <th className="py-4.5 px-6">Escalation Trigger</th>
                <th className="py-4.5 px-6">Closure Policy</th>
              </tr>
            </thead>
            <tbody className="divide-y-2 divide-[#E2E8F0]">
              {policies.map((p) => {
                const hoursFormatted =
                  p.resolution_target_minutes >= 60
                    ? ` (${
                        p.resolution_target_minutes % 60 === 0
                          ? p.resolution_target_minutes / 60
                          : (p.resolution_target_minutes / 60).toFixed(1)
                      }h)`
                    : "";

                return (
                  <tr key={p.id} className="hover:bg-[#F1F5F9] transition-colors">
                    <td className="py-5 px-6 font-black text-base sm:text-lg text-[#0F172A] capitalize">
                      {p.department_id}
                    </td>
                    <td className="py-5 px-6">
                      <span
                        className={`text-xs sm:text-sm font-black uppercase tracking-wider px-3 py-1.5 rounded-lg border-2 shadow-xs ${
                          p.priority === "critical"
                            ? "bg-[#FEE2E2] text-[#991B1B] border-[#EF4444]"
                            : p.priority === "high"
                            ? "bg-[#FEF3C7] text-[#92400E] border-[#F59E0B]"
                            : "bg-[#E0E7FF] text-[#3730A3] border-[#6366F1]"
                        }`}
                      >
                        {p.priority}
                      </span>
                    </td>
                    <td className="py-5 px-6 font-black tabular-nums text-base sm:text-lg text-[#0F172A]">
                      {p.ack_target_minutes} mins
                    </td>
                    <td className="py-5 px-6 font-black tabular-nums text-base sm:text-lg text-[#0F766E]">
                      {p.resolution_target_minutes} mins{hoursFormatted}
                    </td>
                    <td className="py-5 px-6 text-[#1E293B] font-bold text-sm sm:text-base tabular-nums">
                      T-{p.reminder_1_minutes_before}m & T-{p.reminder_2_minutes_before}m
                    </td>
                    <td className="py-5 px-6 text-[#DC2626] font-extrabold text-sm sm:text-base">
                      At deadline breach (Level {p.priority === "critical" ? "2" : "1"})
                    </td>
                    <td className="py-5 px-6">
                      <span className="text-xs sm:text-sm text-[#0F766E] bg-[#E6FFFA] border-2 border-[#5EEAD4] px-3.5 py-1.5 rounded-xl font-black inline-block whitespace-nowrap shadow-xs">
                        Supervisor Approval Required
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Escalation Breach History */}
      <div className="bg-white rounded-3xl border-2 border-[#94A3B8] shadow-lg overflow-hidden">
        <div className="p-6 sm:p-7 border-b-2 border-[#CBD5E1] flex items-center justify-between bg-[#F8FAFC]">
          <div>
            <h3 className="font-black text-xl sm:text-2xl text-[#0F172A] flex items-center gap-3">
              <ShieldAlert className="h-6 w-6 text-[#DC2626]" />
              <span>Escalation Breach Ledger</span>
            </h3>
            <p className="text-sm sm:text-base text-[#334155] font-semibold mt-1">
              Real-time audit record of tickets that exceeded configured targets
            </p>
          </div>
          <span className="text-sm sm:text-base font-black text-[#B91C1C] bg-[#FEE2E2] px-4 py-1.5 rounded-full border-2 border-[#FCA5A5] shadow-xs">
            {escalations.length} Breach Incidents
          </span>
        </div>

        <div className="divide-y-2 divide-[#E2E8F0]">
          {escalations.length === 0 ? (
            <div className="p-12 text-center text-[#334155]">
              <CheckCircle2 className="h-10 w-10 text-[#16805D] mx-auto mb-3" />
              <span className="text-base font-bold">No active escalation breaches logged. All tickets operating on schedule.</span>
            </div>
          ) : (
            escalations.map((esc) => (
              <div
                key={esc.id}
                onClick={() => onSelectTicket(esc.ticket_id)}
                className="p-6 hover:bg-[#FFF5F5] cursor-pointer transition-colors flex flex-col md:flex-row md:items-center justify-between gap-5"
              >
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="font-black text-base sm:text-lg text-[#DC2626] tabular-nums">
                      {esc.ticket_number}
                    </span>
                    <span className="font-black text-base sm:text-lg text-[#0F172A]">{esc.ticket_title}</span>
                    <span className="text-xs sm:text-sm font-black px-3 py-1 rounded-lg bg-[#FEE2E2] text-[#991B1B] border-2 border-[#FCA5A5]">
                      Level {esc.escalation_level} Breach
                    </span>
                  </div>
                  <p className="text-[#1E293B] text-sm sm:text-base font-bold">{esc.trigger_reason}</p>
                  <div className="text-sm sm:text-base text-[#334155] font-semibold flex flex-wrap items-center gap-3">
                    <span>Location: <strong className="text-[#0F172A] font-black">{esc.room_number}</strong></span>
                    <span>•</span>
                    <span>Supervisor: <strong className="text-[#0F172A] font-black">{esc.notified_supervisor}</strong></span>
                    <span>•</span>
                    <span className="text-[#16805D] font-black">Status: {esc.delivery_status}</span>
                  </div>
                </div>

                <button className="px-5 py-2.5 rounded-2xl border-2 border-[#94A3B8] bg-white hover:bg-[#F8FAFC] hover:border-[#64748B] font-black text-sm sm:text-base text-[#0F172A] shrink-0 flex items-center gap-2 shadow-sm cursor-pointer self-start md:self-auto">
                  <span>Inspect</span>
                  <ArrowRight className="h-5 w-5" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
