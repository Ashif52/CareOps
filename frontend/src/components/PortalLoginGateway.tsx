"use client";

import React, { useState, useEffect } from "react";
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
  CheckCircle2,
  UserPlus,
  Loader2,
  QrCode
} from "lucide-react";
import { api, setStoredToken, User as UserType } from "@/lib/api";

interface PortalLoginGatewayProps {
  onLoginSuccess: (user: UserType, initialTab?: string) => void;
  onEnterPatientPortal?: (roomToken?: string) => void;
}

export function PortalLoginGateway({
  onLoginSuccess,
  onEnterPatientPortal,
}: PortalLoginGatewayProps) {
  const [authMode, setAuthMode] = useState<"signin" | "register">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingText, setLoadingText] = useState("Sign In to Workspace");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [activePersona, setActivePersona] = useState<string>("");

  // Pre-warm the backend as soon as the user opens the login screen
  useEffect(() => {
    api.warmup();
  }, []);

  // Progressive feedback while backend is waking up from sleep
  useEffect(() => {
    let t1: any, t2: any;
    if (isLoading) {
      setLoadingText("Verifying Credentials...");
      t1 = setTimeout(() => {
        setLoadingText("Connecting to Cloud Backend (waking up)...");
      }, 3500);
      t2 = setTimeout(() => {
        setLoadingText("Booting Service... almost ready...");
      }, 15000);
    } else {
      setLoadingText("Sign In to Workspace");
    }
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [isLoading]);

  // Registration state
  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regRole, setRegRole] = useState("staff");
  const [regDepartment, setRegDepartment] = useState("maintenance");
  const [regDesignation, setRegDesignation] = useState("Hospital Operations Specialist");
  const [showRegPassword, setShowRegPassword] = useState(false);

  const demoPersonas = [
    {
      id: "superadmin",
      label: "System Superadmin (Root)",
      name: "System Superadmin",
      email: "superadmin@careops.hospital",
      role: "superadmin",
      badge: "Superadmin Only",
      badgeColor: "bg-[#FDF2F2] text-[#DC2626] border-[#FCA5A5]",
      desc: "Exclusive root authority to wipe/purge database & manage system policies",
    },
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

  const handleDirectPersonaLogin = async (persona: typeof demoPersonas[0]) => {
    setEmail(persona.email);
    setPassword("password123");
    setActivePersona(persona.id);
    setErrorMsg(null);
    setIsLoading(true);
    setLoadingText(`Signing in as ${persona.name}...`);

    try {
      const res = await api.login({
        email: persona.email.trim().toLowerCase(),
        password: "password123",
      });

      setStoredToken(res.access_token);
      const landingTab = res.user.role === "superadmin" ? "superadmin-admins" : res.user.role === "staff" ? "my-department" : "overview";
      onLoginSuccess(res.user, landingTab);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to sign in. Please verify credentials.");
    } finally {
      setIsLoading(false);
    }
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
      const landingTab = res.user.role === "superadmin" ? "superadmin-admins" : res.user.role === "staff" ? "my-department" : "overview";
      onLoginSuccess(res.user, landingTab);
    } catch (err: any) {
      setErrorMsg(err.message || "Invalid credentials. Please verify your email and password.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regName.trim() || !regEmail.trim() || !regPassword.trim()) {
      setErrorMsg("Please provide your Name, Email address, and Password.");
      return;
    }

    if (!regEmail.includes("@")) {
      setErrorMsg("Please enter a valid work or hospital email address.");
      return;
    }

    if (regPassword.length < 4) {
      setErrorMsg("Password must be at least 4 characters long.");
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);

    try {
      const res = await api.register({
        name: regName.trim(),
        email: regEmail.trim().toLowerCase(),
        password: regPassword,
        role: regRole,
        department_id: regDepartment,
        designation: regDesignation.trim() || "Operations Personnel",
      });

      setStoredToken(res.access_token);
      const landingTab = res.user.role === "superadmin" ? "superadmin-admins" : res.user.role === "staff" ? "my-department" : "overview";
      onLoginSuccess(res.user, landingTab);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to create account. Email may already be registered.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F1F5F9] flex flex-col justify-between p-4 sm:p-6 lg:p-8 relative selection:bg-[#176B63] selection:text-white">
      {/* Decorative top header bar */}
      <header className="max-w-6xl w-full mx-auto flex items-center justify-between pb-5 border-b border-[#CBD5E1]">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-[#176B63] flex items-center justify-center text-white shadow-md shadow-[#176B63]/25">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <div className="font-extrabold text-xl text-[#0F172A] tracking-tight flex items-center gap-2">
              <span>CareOps <strong className="text-[#176B63]">AI</strong></span>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#E8F3F1] text-[#176B63] border border-[#A7D7D1]">
                Hospital OS
              </span>
            </div>
            <p className="text-xs text-[#64748B] mt-0.5 font-medium">
              “Every hospital issue. Accountable ownership. Verified resolution.”
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onEnterPatientPortal && (
            <button
              type="button"
              onClick={() => onEnterPatientPortal()}
              className="px-3.5 py-1.5 rounded-full bg-[#176B63] hover:bg-[#125852] text-white text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
            >
              <QrCode className="h-3.5 w-3.5" />
              <span>Bedside Patient Portal</span>
            </button>
          )}
          <div className="hidden sm:flex items-center gap-2 text-xs font-semibold text-[#0F766E] bg-[#E8F3F1] px-3 py-1.5 rounded-full border border-[#99F6E4] shadow-2xs">
            <span className="h-2 w-2 rounded-full bg-[#0D9488] animate-pulse" />
            <span>NABH / HIPAA Protected</span>
          </div>
        </div>
      </header>

      {/* Main Login Card Section */}
      <main className="max-w-6xl w-full mx-auto my-auto py-6 grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-center">
        {/* Left Column: Brand & Security Overview */}
        <div className="lg:col-span-6 space-y-4">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#176B63]/10 text-[#176B63] text-xs font-bold border border-[#176B63]/25">
            <KeyRound className="h-3.5 w-3.5" />
            <span>Personnel Authentication System</span>
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl sm:text-3xl font-black text-[#0F172A] tracking-tight leading-tight">
              Sign in to <span className="text-[#176B63]">CareOps</span> Operations Portal
            </h1>
            <p className="text-xs sm:text-sm text-[#475569] leading-relaxed">
              Unified hospital service management, AI visual maintenance verification, patient bedside triage, and strict role-based governance.
            </p>
          </div>

          {/* Feature Highlights */}
          <div className="space-y-2.5 pt-1">
            {onEnterPatientPortal && (
              <div
                onClick={() => onEnterPatientPortal()}
                className="p-3.5 rounded-xl bg-gradient-to-br from-[#E8F3F1] to-[#D1ECE7] border-2 border-[#176B63]/40 hover:border-[#176B63] transition-all cursor-pointer group shadow-2xs"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-[#176B63] font-black text-xs uppercase tracking-wide">
                    <QrCode className="h-4 w-4" />
                    <span>Bedside Patient Portal (QR Mode)</span>
                  </div>
                  <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-white text-[#176B63] border border-[#176B63]/20 shadow-2xs">
                    No Sign-In Required
                  </span>
                </div>
                <p className="text-xs text-[#334155] font-medium mt-1 leading-relaxed">
                  Looking to lodge a room request or test QR bedside complaint triage? Click here to test the live patient experience.
                </p>
                <div className="mt-2 text-xs font-black text-[#176B63] flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                  <span>Enter Bedside Patient Portal →</span>
                </div>
              </div>
            )}

            <div className="flex items-start gap-3 p-3 rounded-xl bg-white/80 border border-[#CBD5E1] shadow-2xs">
              <div className="p-2 rounded-lg bg-[#E8F3F1] text-[#176B63] shrink-0 mt-0.5">
                <ShieldCheck className="h-4 w-4" />
              </div>
              <div className="space-y-0.5">
                <strong className="text-[#0F172A] block text-xs font-bold">Strict Role-Based Access Control (RBAC)</strong>
                <span className="text-[11px] text-[#64748B] leading-normal block">
                  Only authorized Administrators can create bedside QR codes, configure SLA policies, and manage facility departments.
                </span>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-xl bg-white/80 border border-[#CBD5E1] shadow-2xs">
              <div className="p-2 rounded-lg bg-[#EEF4FD] text-[#3868C9] shrink-0 mt-0.5">
                <Sparkles className="h-4 w-4" />
              </div>
              <div className="space-y-0.5">
                <strong className="text-[#0F172A] block text-xs font-bold">AI Multimodal Verification</strong>
                <span className="text-[11px] text-[#64748B] leading-normal block">
                  Computer vision motion heuristics verify repair evidence before supervisor sign-off.
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Clean, Generously Sized Login Form */}
        <div className="lg:col-span-6">
          <div className="bg-white rounded-2xl border border-[#CBD5E1] p-5 sm:p-6 shadow-xl shadow-[#0F172A]/5 space-y-4">
            {/* Mode Switcher Tabs */}
            <div className="flex items-center p-1 bg-[#F1F5F9] rounded-2xl border border-[#CBD5E1]">
              <button
                type="button"
                onClick={() => {
                  setAuthMode("signin");
                  setErrorMsg(null);
                }}
                className={`flex-1 py-2.5 rounded-xl font-extrabold text-sm transition-all cursor-pointer ${
                  authMode === "signin"
                    ? "bg-white text-[#0F172A] shadow-sm border border-[#CBD5E1]"
                    : "text-[#64748B] hover:text-[#0F172A]"
                }`}
              >
                Staff Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthMode("register");
                  setErrorMsg(null);
                  if (email && email !== "admin@careops.hospital") setRegEmail(email);
                  if (password && password !== "password123") setRegPassword(password);
                }}
                className={`flex-1 py-2.5 rounded-xl font-extrabold text-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  authMode === "register"
                    ? "bg-white text-[#176B63] shadow-sm border border-[#CBD5E1]"
                    : "text-[#64748B] hover:text-[#0F172A]"
                }`}
              >
                <UserPlus className="h-4 w-4" />
                <span>Create Account</span>
              </button>
            </div>

            {authMode === "signin" && (
              <button
                type="button"
                disabled={isLoading}
                onClick={() => handleDirectPersonaLogin(demoPersonas[1])}
                className="w-full p-3 rounded-xl bg-gradient-to-r from-[#176B63] to-[#0D9488] hover:from-[#125852] hover:to-[#0B7A70] text-white font-extrabold text-xs sm:text-sm shadow-md shadow-[#176B63]/25 transition-all flex items-center justify-between cursor-pointer group disabled:opacity-50"
              >
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 rounded-lg bg-white/20 text-white">
                    <Sparkles className="h-4 w-4" />
                  </div>
                  <div className="text-left">
                    <div className="text-[10px] uppercase tracking-wider text-[#99F6E4] font-black">🚀 1-Click Instant Access</div>
                    <div className="text-xs sm:text-sm font-bold">Sign In as Admin (Dr. Alistair Vance)</div>
                  </div>
                </div>
                <div className="flex items-center gap-1 text-xs font-bold text-[#99F6E4] group-hover:translate-x-1 transition-transform">
                  <span>Enter Dashboard →</span>
                </div>
              </button>
            )}

            <div className="space-y-1">
              <h2 className="text-2xl sm:text-3xl font-extrabold text-[#0F172A] tracking-tight">
                {authMode === "signin" ? "Staff & Administrator Sign In" : "Create Hospital Account"}
              </h2>
              <p className="text-sm text-[#64748B]">
                {authMode === "signin"
                  ? "Enter your hospital email and password to access your assigned queue."
                  : "Register your personnel credentials to access your CareOps workspace immediately."}
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
                <div className="flex-1">
                  <div className="font-black text-sm">
                    {errorMsg.toLowerCase().includes("locked")
                      ? "Security Lockout Triggered (3 Consecutive Failures)"
                      : "Authentication Notice"}
                  </div>
                  <div className="mt-0.5 text-xs font-semibold leading-relaxed">{errorMsg}</div>
                  {authMode === "signin" && errorMsg.includes("Invalid email or password") && (
                    <div className="mt-2 pt-2 border-t border-[#FCA5A5]/60 text-xs">
                      Don't have an account registered yet?{" "}
                      <button
                        type="button"
                        onClick={() => {
                          setAuthMode("register");
                          setRegEmail(email);
                          setRegPassword(password);
                          setErrorMsg(null);
                        }}
                        className="underline font-black text-[#991B1B] hover:text-[#7F1D1D] cursor-pointer"
                      >
                        Click here to create account with this email →
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {authMode === "signin" ? (
              /* Sign In Form */
              <form onSubmit={handleLoginSubmit} className="space-y-3.5">
                {/* Email Input */}
                <div className="space-y-1">
                  <label className="font-bold text-xs text-[#1E293B] block">Hospital Email Address</label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#94A3B8]" />
                    <input
                      type="email"
                      required
                      placeholder="e.g. admin@careops.hospital"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        setErrorMsg(null);
                      }}
                      className="w-full pl-10 pr-3.5 py-2 rounded-xl border border-[#CBD5E1] text-xs bg-[#F8FAFC] focus:bg-white focus:outline-none focus:border-[#176B63] focus:ring-2 focus:ring-[#176B63]/15 transition-all font-medium text-[#0F172A]"
                    />
                  </div>
                </div>

                {/* Password Input */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-xs text-[#1E293B]">Password</label>
                    <span className="text-[11px] text-[#64748B]">Default: <code className="text-[#176B63] font-mono font-bold">password123</code></span>
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#94A3B8]" />
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        setErrorMsg(null);
                      }}
                      className="w-full pl-10 pr-10 py-2 rounded-xl border border-[#CBD5E1] text-xs bg-[#F8FAFC] focus:bg-white focus:outline-none focus:border-[#176B63] focus:ring-2 focus:ring-[#176B63]/15 transition-all font-medium text-[#0F172A]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#475569] p-1 rounded transition-colors cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-2.5 rounded-xl bg-[#176B63] hover:bg-[#125852] active:bg-[#0e4641] text-white font-bold text-xs sm:text-sm shadow-md shadow-[#176B63]/25 transition-all flex items-center justify-center gap-2 disabled:opacity-75 cursor-pointer"
                >
                  {isLoading && <Loader2 className="h-4 w-4 animate-spin shrink-0" />}
                  <span>{isLoading ? loadingText : "Sign In to Workspace"}</span>
                  {!isLoading && <ArrowRight className="h-4 w-4 shrink-0" />}
                </button>
              </form>
            ) : (
              /* Register Form */
              <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
                <div className="space-y-1">
                  <label className="font-bold text-xs text-[#1E293B] block">Full Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Ashif Basha"
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-[#CBD5E1] text-xs bg-[#F8FAFC] focus:bg-white focus:outline-none focus:border-[#176B63] focus:ring-2 focus:ring-[#176B63]/15 transition-all font-medium text-[#0F172A]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-xs text-[#1E293B] block">Hospital Email Address</label>
                  <input
                    type="email"
                    required
                    placeholder="e.g. bashajafer36@gmail.com"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-[#CBD5E1] text-xs bg-[#F8FAFC] focus:bg-white focus:outline-none focus:border-[#176B63] focus:ring-2 focus:ring-[#176B63]/15 transition-all font-medium text-[#0F172A]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-xs text-[#1E293B] block">Create Password</label>
                  <div className="relative">
                    <input
                      type={showRegPassword ? "text" : "password"}
                      required
                      placeholder="••••••••"
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      className="w-full px-3.5 pr-10 py-2 rounded-xl border border-[#CBD5E1] text-xs bg-[#F8FAFC] focus:bg-white focus:outline-none focus:border-[#176B63] focus:ring-2 focus:ring-[#176B63]/15 transition-all font-medium text-[#0F172A]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowRegPassword(!showRegPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#475569] p-1 rounded transition-colors cursor-pointer"
                    >
                      {showRegPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="font-bold text-[11px] text-[#334155] block mb-1">Access Role</label>
                    <select
                      value={regRole}
                      onChange={(e) => setRegRole(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-[#CBD5E1] bg-[#F8FAFC] text-xs font-semibold text-[#0F172A] focus:outline-none focus:border-[#176B63] cursor-pointer"
                    >
                      <option value="admin">Administrator (Full Access)</option>
                      <option value="supervisor">Operations Supervisor</option>
                      <option value="staff">Maintenance / Staff Lead</option>
                      <option value="doctor">Duty Doctor / Physician</option>
                      <option value="nurse">Clinical Nursing Staff</option>
                    </select>
                  </div>

                  <div>
                    <label className="font-bold text-[11px] text-[#334155] block mb-1">Department</label>
                    <select
                      value={regDepartment}
                      onChange={(e) => setRegDepartment(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-[#CBD5E1] bg-[#F8FAFC] text-xs font-semibold text-[#0F172A] focus:outline-none focus:border-[#176B63] cursor-pointer"
                    >
                      <option value="maintenance">Facilities & Maintenance</option>
                      <option value="nursing">Nursing & Clinical Inpatient</option>
                      <option value="housekeeping">Housekeeping & Sanitation</option>
                      <option value="billing">Patient Billing & Accounts</option>
                      <option value="pharmacy">Clinical Pharmacy</option>
                    </select>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-2.5 rounded-xl bg-[#176B63] hover:bg-[#125852] active:bg-[#0e4641] text-white font-bold text-xs sm:text-sm shadow-md shadow-[#176B63]/25 transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                >
                  <UserPlus className="h-4 w-4" />
                  <span>{isLoading ? "Creating Account..." : "Create Account & Sign In"}</span>
                </button>
              </form>
            )}

            {/* Quick Demo Pre-Fill Selector */}
            <div className="pt-4 border-t border-[#E2E8F0] space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-extrabold text-[#475569] uppercase tracking-wider">
                  1-Click Role Logins (Tap to Sign In):
                </span>
                <span className="text-[11px] font-bold text-[#176B63] bg-[#E8F3F1] px-2 py-0.5 rounded-full border border-[#A7D7D1]">
                  Instant Access
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {demoPersonas.map((p) => {
                  const isSelected = email.toLowerCase() === p.email.toLowerCase() && authMode === "signin";
                  return (
                    <button
                      key={p.id}
                      type="button"
                      disabled={isLoading}
                      onClick={() => {
                        setAuthMode("signin");
                        handleDirectPersonaLogin(p);
                      }}
                      className={`text-left p-2.5 rounded-xl border transition-all flex flex-col justify-between gap-1 cursor-pointer disabled:opacity-50 ${
                        isSelected
                          ? "border-[#176B63] bg-[#E8F3F1] ring-2 ring-[#176B63]/30"
                          : "border-[#E2E8F0] hover:border-[#176B63] hover:bg-[#F0FDF4] hover:shadow-2xs"
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <strong className="text-[#0F172A] font-bold text-xs truncate">
                          {p.name}
                        </strong>
                        <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded border ${p.badgeColor}`}>
                          {p.badge}
                        </span>
                      </div>
                      <div className="flex items-center justify-between w-full text-[11px]">
                        <span className="text-[#64748B] font-mono truncate">
                          {p.email}
                        </span>
                        <span className="text-[10px] font-bold text-[#176B63] shrink-0">
                          Sign In →
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="p-2.5 rounded-xl bg-[#F8FAFC] border border-[#CBD5E1] text-[11px] text-[#475569] flex items-center gap-2">
                <ShieldAlert className="h-3.5 w-3.5 text-[#0D9488] shrink-0" />
                <span>
                  <strong>Admin Clearance Notice:</strong> Only <code>Dr. Alistair Vance (Admin)</code> or accounts created with <code>Administrator</code> role can register rooms and generate bedside QR codes.
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
