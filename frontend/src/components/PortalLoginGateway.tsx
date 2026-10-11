"use client";

import React, { useState } from "react";
import {
  ShieldCheck,
  User,
  Lock,
  ArrowRight,
  AlertCircle,
  KeyRound,
  Eye,
  EyeOff,
  Sparkles,
  ShieldAlert,
  Building2,
  CheckCircle2
} from "lucide-react";
import { api, setStoredToken, User as UserType } from "@/lib/api";

interface PortalLoginGatewayProps {
  onLoginSuccess: (user: UserType, initialTab?: string) => void;
  onEnterPatientPortal?: (roomToken?: string) => void;
}

export function PortalLoginGateway({
  onLoginSuccess,
}: PortalLoginGatewayProps) {
  const [email, setEmail] = useState("admin@careops.hospital");
  const [password, setPassword] = useState("password123");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [activePersona, setActivePersona] = useState<string>("admin");

  const demoPersonas = [
    {
      id: "admin",
      label: "Hospital Administrator",
      name: "Dr. Alistair Vance",
      email: "admin@careops.hospital",
      role: "admin",
      badge: "Admin Access",
      badgeColor: "bg-[#E8F3F1] text-[#176B63] border-[#A7D7D1]",
      desc: "Full Command Center, SLA Policies & QR Code Generation clearance",
    },
    {
      id: "supervisor",
      label: "Operations Supervisor",
      name: "Vikramaditya Rao",
      email: "supervisor.mnt@careops.hospital",
      role: "supervisor",
      badge: "Supervisor",
      badgeColor: "bg-[#FEF7EC] text-[#B7791F] border-[#FAD7A0]",
      desc: "AI verification sign-off, SLA breaches & department oversight",
    },
    {
      id: "staff",
      label: "Maintenance Lead (Staff)",
      name: "Rajesh Sharma",
      email: "technician.rajesh@careops.hospital",
      role: "staff",
      badge: "Staff Only",
      badgeColor: "bg-[#EEF4FD] text-[#3868C9] border-[#BFDBFE]",
      desc: "Assigned tickets, SLA timers, evidence upload & repairs",
    },
    {
      id: "nurse",
      label: "Senior Staff Nurse (Staff)",
      name: "Nurse Priya Nair",
      email: "nurse.priya@careops.hospital",
      role: "staff",
      badge: "Staff Only",
      badgeColor: "bg-[#FDF2F2] text-[#C43D4B] border-[#F8D7DA]",
      desc: "Clinical ward triage, IV pump alerts & bedside requests",
    },
  ];

  const handleSelectPersona = (persona: typeof demoPersonas[0]) => {
    setEmail(persona.email);
    setPassword("password123");
    setActivePersona(persona.id);
    setErrorMsg(null);
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorMsg("Please enter both email address and password");
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);

    try {
      const res = await api.login({
        email: email.trim().toLowerCase(),
        password: password,
      });

      setStoredToken(res.access_token);
      const landingTab = res.user.role === "staff" ? "my-department" : "overview";
      onLoginSuccess(res.user, landingTab);
    } catch (err: any) {
      setErrorMsg(err.message || "Invalid credentials. Please verify your email and password.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F1F5F9] flex flex-col justify-between p-6 sm:p-10 lg:p-12 relative selection:bg-[#176B63] selection:text-white">
      {/* Decorative top header bar */}
      <header className="max-w-6xl w-full mx-auto flex items-center justify-between pb-8 border-b border-[#CBD5E1]">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-[#176B63] flex items-center justify-center text-white shadow-lg shadow-[#176B63]/25">
            <ShieldCheck className="h-7 w-7" />
          </div>
          <div>
            <div className="font-extrabold text-2xl text-[#0F172A] tracking-tight flex items-center gap-2.5">
              <span>CareOps <strong className="text-[#176B63]">AI</strong></span>
              <span className="text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-[#E8F3F1] text-[#176B63] border border-[#A7D7D1]">
                Hospital OS
              </span>
            </div>
            <p className="text-sm text-[#64748B] mt-0.5 font-medium">
              “Every hospital issue. Accountable ownership. Verified resolution.”
            </p>
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-2.5 text-sm font-semibold text-[#0F766E] bg-[#E8F3F1] px-4 py-2 rounded-full border border-[#99F6E4] shadow-xs">
          <span className="h-2.5 w-2.5 rounded-full bg-[#0D9488] animate-pulse" />
          <span>NABH / HIPAA Protected Portal</span>
        </div>
      </header>

      {/* Main Login Card Section */}
      <main className="max-w-6xl w-full mx-auto my-auto py-10 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center">
        {/* Left Column: Brand & Security Overview */}
        <div className="lg:col-span-6 space-y-7">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#176B63]/10 text-[#176B63] text-sm font-bold border border-[#176B63]/25">
            <KeyRound className="h-4 w-4" />
            <span>Personnel Authentication System</span>
          </div>

          <div className="space-y-4">
            <h1 className="text-4xl sm:text-5xl font-black text-[#0F172A] tracking-tight leading-tight">
              Sign in to <span className="text-[#176B63]">CareOps</span> Operations Portal
            </h1>
            <p className="text-base sm:text-lg text-[#475569] leading-relaxed">
              Unified hospital service management, AI visual maintenance verification, patient bedside triage, and strict role-based governance.
            </p>
          </div>

          {/* Feature Highlights */}
          <div className="space-y-4 pt-2">
            <div className="flex items-start gap-4 p-4 rounded-2xl bg-white/80 border border-[#CBD5E1] shadow-xs">
              <div className="p-2.5 rounded-xl bg-[#E8F3F1] text-[#176B63] shrink-0 mt-0.5">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <strong className="text-[#0F172A] block text-base font-bold">Strict Role-Based Access Control (RBAC)</strong>
                <span className="text-sm text-[#64748B] leading-normal block">
                  Only authorized Administrators can create bedside QR codes, configure SLA policies, and manage facility departments.
                </span>
              </div>
            </div>

            <div className="flex items-start gap-4 p-4 rounded-2xl bg-white/80 border border-[#CBD5E1] shadow-xs">
              <div className="p-2.5 rounded-xl bg-[#EEF4FD] text-[#3868C9] shrink-0 mt-0.5">
                <Sparkles className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <strong className="text-[#0F172A] block text-base font-bold">AI Multimodal Verification</strong>
                <span className="text-sm text-[#64748B] leading-normal block">
                  Computer vision motion heuristics verify repair evidence before supervisor sign-off.
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Clean, Generously Sized Login Form */}
        <div className="lg:col-span-6">
          <div className="bg-white rounded-3xl border border-[#CBD5E1] p-8 sm:p-10 shadow-2xl shadow-[#0F172A]/8 space-y-7">
            <div className="space-y-1.5">
              <h2 className="text-2xl sm:text-3xl font-extrabold text-[#0F172A] tracking-tight">
                Staff & Administrator Sign In
              </h2>
              <p className="text-sm text-[#64748B]">
                Enter your hospital email and password to access your assigned queue.
              </p>
            </div>

            {errorMsg && (
              <div
                className={`p-4.5 rounded-2xl border-2 text-sm flex items-start gap-3 font-bold animate-in fade-in duration-200 ${
                  errorMsg.toLowerCase().includes("locked")
                    ? "bg-[#FEF2F2] border-[#FCA5A5] text-[#991B1B]"
                    : "bg-[#FEF2F2] border-[#FECACA] text-[#B91C1C]"
                }`}
              >
                {errorMsg.toLowerCase().includes("locked") ? (
                  <Lock className="h-5 w-5 shrink-0 text-[#DC2626] mt-0.5" />
                ) : (
                  <AlertCircle className="h-5 w-5 shrink-0 text-[#B91C1C] mt-0.5" />
                )}
                <div>
                  <div className="font-black text-sm">
                    {errorMsg.toLowerCase().includes("locked")
                      ? "Security Lockout Triggered (3 Consecutive Failures)"
                      : "Authentication Failed"}
                  </div>
                  <div className="mt-0.5 text-xs font-semibold leading-relaxed">{errorMsg}</div>
                </div>
              </div>
            )}

            <form onSubmit={handleLoginSubmit} className="space-y-5">
              {/* Email Input */}
              <div className="space-y-2">
                <label className="font-bold text-sm text-[#1E293B] block">Hospital Email Address</label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-[#94A3B8]" />
                  <input
                    type="email"
                    required
                    placeholder="e.g. admin@careops.hospital"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setErrorMsg(null);
                    }}
                    className="w-full pl-12 pr-4 py-3.5 rounded-2xl border-2 border-[#CBD5E1] text-base bg-[#F8FAFC] focus:bg-white focus:outline-none focus:border-[#176B63] focus:ring-4 focus:ring-[#176B63]/15 transition-all font-medium text-[#0F172A]"
                  />
                </div>
              </div>

              {/* Password Input */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-sm text-[#1E293B]">Password</label>
                  <span className="text-xs text-[#64748B]">Default Seed: <code className="text-[#176B63] font-mono font-bold">password123</code></span>
                </div>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-[#94A3B8]" />
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setErrorMsg(null);
                    }}
                    className="w-full pl-12 pr-12 py-3.5 rounded-2xl border-2 border-[#CBD5E1] text-base bg-[#F8FAFC] focus:bg-white focus:outline-none focus:border-[#176B63] focus:ring-4 focus:ring-[#176B63]/15 transition-all font-medium text-[#0F172A]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#475569] p-1.5 rounded-lg transition-colors cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-4 rounded-2xl bg-[#176B63] hover:bg-[#125852] active:bg-[#0e4641] text-white font-extrabold text-base shadow-lg shadow-[#176B63]/25 transition-all flex items-center justify-center gap-2.5 disabled:opacity-50 cursor-pointer"
              >
                <span>{isLoading ? "Verifying Credentials..." : "Sign In to Workspace"}</span>
                <ArrowRight className="h-5 w-5" />
              </button>
            </form>

            {/* Quick Demo Pre-Fill Selector */}
            <div className="pt-6 border-t border-[#E2E8F0] space-y-3.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-[#475569] uppercase tracking-wider">
                  Test Credentials (Click to Pre-fill):
                </span>
                <span className="text-xs font-semibold text-[#176B63]">1-Click Autofill</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {demoPersonas.map((p) => {
                  const isSelected = email.toLowerCase() === p.email.toLowerCase();
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleSelectPersona(p)}
                      className={`text-left p-3.5 rounded-2xl border-2 transition-all flex flex-col justify-between gap-1.5 cursor-pointer ${
                        isSelected
                          ? "border-[#176B63] bg-[#E8F3F1] ring-2 ring-[#176B63]/30"
                          : "border-[#E2E8F0] hover:border-[#94A3B8] hover:bg-[#F8FAFC]"
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <strong className="text-[#0F172A] font-bold text-sm truncate">
                          {p.name}
                        </strong>
                        <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md border ${p.badgeColor}`}>
                          {p.badge}
                        </span>
                      </div>
                      <span className="text-xs text-[#64748B] font-mono truncate">
                        {p.email}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="p-3.5 rounded-2xl bg-[#F8FAFC] border border-[#CBD5E1] text-xs text-[#475569] flex items-center gap-2.5">
                <ShieldAlert className="h-5 w-5 text-[#0D9488] shrink-0" />
                <span>
                  <strong>Admin Clearance Notice:</strong> Only <code>Dr. Alistair Vance (Admin)</code> has authority to register rooms and generate bedside QR codes.
                </span>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-6xl w-full mx-auto pt-8 border-t border-[#CBD5E1] flex flex-col sm:flex-row items-center justify-between text-sm text-[#64748B] gap-3">
        <span>CareOps AI • Enterprise Hospital Facility & Service Governance Platform</span>
        <span className="text-xs text-[#94A3B8]">Immutable Audit Trail Enabled • All Sign-ins Logged</span>
      </footer>
    </div>
  );
}
