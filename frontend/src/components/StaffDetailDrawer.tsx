"use client";

import React, { useState } from "react";
import {
  X,
  User,
  Shield,
  ShieldCheck,
  ShieldAlert,
  Lock,
  Unlock,
  KeyRound,
  UserX,
  UserCheck,
  Building,
  Mail,
  Phone,
  Clock,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  History,
  Copy,
  Check,
  Trash2
} from "lucide-react";
import { StaffMember, api, formatDateTime } from "@/lib/api";

interface StaffDetailDrawerProps {
  staff: StaffMember | null;
  onClose: () => void;
  onRefresh: () => void;
  currentUserRole?: string;
  onOpenUnlockModal: (staff: StaffMember) => void;
  onOpenDeactivateModal: (staff: StaffMember) => void;
  onOpenResetPasswordModal: (staff: StaffMember) => void;
  onActivateAccount: (staff: StaffMember) => void;
  onOpenDeleteModal?: (staff: StaffMember) => void;
}

export function StaffDetailDrawer({
  staff,
  onClose,
  onRefresh,
  currentUserRole,
  onOpenUnlockModal,
  onOpenDeactivateModal,
  onOpenResetPasswordModal,
  onActivateAccount,
  onOpenDeleteModal,
}: StaffDetailDrawerProps) {
  const [activeTab, setActiveTab] = useState<"overview" | "access" | "security" | "audit">("overview");
  const [copiedText, setCopiedText] = useState<string | null>(null);

  if (!staff) return null;

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(label);
    setTimeout(() => setCopiedText(null), 2000);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-[#EDF7F2] text-[#16805D] border-2 border-[#A6E1CE]">
            <span className="h-2 w-2 rounded-full bg-[#16805D]" />
            Active
          </span>
        );
      case "locked":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-[#FEE2E2] text-[#991B1B] border-2 border-[#FCA5A5] animate-pulse">
            <Lock className="h-3.5 w-3.5 text-[#991B1B]" />
            Locked
          </span>
        );
      case "inactive":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-[#F1F5F9] text-[#475569] border-2 border-[#CBD5E1]">
            <UserX className="h-3.5 w-3.5 text-[#475569]" />
            Inactive
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-[#FEF3C7] text-[#92400E] border-2 border-[#FCD34D]">
            Pending Activation
          </span>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/45 backdrop-blur-xs transition-opacity animate-in fade-in"
      />

      {/* Drawer Surface */}
      <div className="relative w-full max-w-2xl bg-white h-full shadow-2xl flex flex-col z-10 border-l-2 border-[#CBD5E1] animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="p-6 border-b-2 border-[#E2E8F0] bg-[#F8FAFC] flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="relative">
              <img
                src={staff.avatar_url || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150"}
                alt={staff.name}
                className="h-14 w-14 rounded-2xl object-cover border-2 border-[#94A3B8] shadow-sm"
              />
              <span
                className={`absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-2 border-white ${
                  staff.account_status === "active"
                    ? "bg-[#16805D]"
                    : staff.account_status === "locked"
                    ? "bg-[#DC2626]"
                    : "bg-[#64748B]"
                }`}
              />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-xl font-black text-[#0F172A]">{staff.name}</h2>
                {getStatusBadge(staff.account_status)}
              </div>
              <div className="flex items-center gap-2 text-xs font-bold text-[#475569] mt-0.5">
                <span className="font-mono bg-[#E2E8F0] px-2 py-0.5 rounded text-[#0F172A]">
                  {staff.employee_id}
                </span>
                <span>•</span>
                <span>{staff.designation}</span>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2.5 rounded-xl text-[#475569] hover:text-[#0F172A] hover:bg-[#E2E8F0] transition-colors cursor-pointer"
            title="Close Drawer"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b-2 border-[#E2E8F0] bg-white px-6">
          <button
            onClick={() => setActiveTab("overview")}
            className={`py-3.5 px-4 font-black text-sm border-b-2 transition-all cursor-pointer ${
              activeTab === "overview"
                ? "border-[#176B63] text-[#176B63]"
                : "border-transparent text-[#475569] hover:text-[#0F172A]"
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab("access")}
            className={`py-3.5 px-4 font-black text-sm border-b-2 transition-all cursor-pointer ${
              activeTab === "access"
                ? "border-[#176B63] text-[#176B63]"
                : "border-transparent text-[#475569] hover:text-[#0F172A]"
            }`}
          >
            Access & Roles
          </button>
          <button
            onClick={() => setActiveTab("security")}
            className={`py-3.5 px-4 font-black text-sm border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === "security"
                ? "border-[#176B63] text-[#176B63]"
                : "border-transparent text-[#475569] hover:text-[#0F172A]"
            }`}
          >
            <span>Security & Auth</span>
            {staff.account_status === "locked" && (
              <span className="h-2 w-2 rounded-full bg-[#DC2626] animate-ping" />
            )}
          </button>
          <button
            onClick={() => setActiveTab("audit")}
            className={`py-3.5 px-4 font-black text-sm border-b-2 transition-all cursor-pointer ${
              activeTab === "audit"
                ? "border-[#176B63] text-[#176B63]"
                : "border-transparent text-[#475569] hover:text-[#0F172A]"
            }`}
          >
            Activity & Audit
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* TAB 1: OVERVIEW */}
          {activeTab === "overview" && (
            <div className="space-y-6">
              {/* Identity & Contact Card */}
              <div className="bg-[#F8FAFC] rounded-2xl border-2 border-[#CBD5E1] p-5 space-y-4">
                <h3 className="text-base font-black text-[#0F172A] flex items-center gap-2">
                  <User className="h-5 w-5 text-[#176B63]" />
                  <span>Personal & Employment Identity</span>
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  <div>
                    <label className="text-xs font-bold text-[#475569] uppercase block mb-1">
                      Full Name
                    </label>
                    <div className="font-extrabold text-[#0F172A]">{staff.name}</div>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-[#475569] uppercase block mb-1">
                      Hospital Employee ID
                    </label>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-black text-[#176B63] bg-white px-2.5 py-1 rounded-lg border border-[#CBD5E1]">
                        {staff.employee_id}
                      </span>
                      <button
                        onClick={() => handleCopy(staff.employee_id, "emp_id")}
                        className="p-1 text-[#64748B] hover:text-[#0F172A] cursor-pointer"
                        title="Copy ID"
                      >
                        {copiedText === "emp_id" ? (
                          <Check className="h-4 w-4 text-[#16805D]" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-[#475569] uppercase block mb-1">
                      Official Work Email
                    </label>
                    <div className="flex items-center gap-2 font-bold text-[#0F172A]">
                      <Mail className="h-4 w-4 text-[#64748B]" />
                      <span>{staff.email}</span>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-[#475569] uppercase block mb-1">
                      Contact Phone
                    </label>
                    <div className="flex items-center gap-2 font-bold text-[#0F172A]">
                      <Phone className="h-4 w-4 text-[#64748B]" />
                      <span>{staff.phone || "Not recorded"}</span>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-[#475569] uppercase block mb-1">
                      Assigned Department
                    </label>
                    <div className="flex items-center gap-2 font-extrabold text-[#0F172A]">
                      <Building className="h-4 w-4 text-[#176B63]" />
                      <span>{staff.department_name || staff.department_id || "Hospital Global"}</span>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-[#475569] uppercase block mb-1">
                      Hospital Designation
                    </label>
                    <div className="font-extrabold text-[#0F172A]">{staff.designation}</div>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-[#475569] uppercase block mb-1">
                      Account Provisioned
                    </label>
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-[#475569]">
                      <Calendar className="h-4 w-4 text-[#94A3B8]" />
                      <span>{formatDateTime(staff.created_at)}</span>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-[#475569] uppercase block mb-1">
                      Last Successful Authentication
                    </label>
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-[#475569]">
                      <Clock className="h-4 w-4 text-[#94A3B8]" />
                      <span>
                        {staff.last_login_at
                          ? formatDateTime(staff.last_login_at)
                          : "Never authenticated"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Status Banner */}
              {staff.account_status === "locked" && (
                <div className="bg-[#FEF2F2] border-2 border-[#FCA5A5] rounded-2xl p-4.5 flex items-start gap-3">
                  <ShieldAlert className="h-6 w-6 text-[#DC2626] shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-black text-[#991B1B] text-base">Account Locked Out</h4>
                    <p className="text-sm font-semibold text-[#7F1D1D] mt-0.5">
                      {staff.locked_reason || "Account locked after 3 consecutive failed login attempts."}
                    </p>
                    {staff.locked_at && (
                      <div className="text-xs font-bold text-[#991B1B] mt-1">
                        Locked timestamp: {formatDateTime(staff.locked_at)}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: ACCESS & ROLES */}
          {activeTab === "access" && (
            <div className="space-y-6">
              <div className="bg-[#F8FAFC] rounded-2xl border-2 border-[#CBD5E1] p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-black text-[#0F172A] flex items-center gap-2">
                    <Shield className="h-5 w-5 text-[#176B63]" />
                    <span>Assigned Healthcare Role</span>
                  </h3>
                  <span className="text-xs font-black uppercase px-3 py-1 rounded-lg bg-[#E8F3F1] text-[#176B63] border border-[#99F6E4]">
                    {staff.role}
                  </span>
                </div>

                <div className="text-sm text-[#334155] font-semibold bg-white p-3.5 rounded-xl border border-[#CBD5E1]">
                  Role ID: <strong className="text-[#0F172A] font-black capitalize">{staff.role}</strong>
                  <p className="text-xs text-[#64748B] mt-1">
                    Department Scope: <strong>{staff.department_name || staff.department_id || "Hospital Global"}</strong>
                  </p>
                </div>
              </div>

              {/* Effective Granular Permissions */}
              <div className="bg-white rounded-2xl border-2 border-[#CBD5E1] p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-black text-[#0F172A] flex items-center gap-2">
                    <ShieldCheck className="h-5 w-5 text-[#16805D]" />
                    <span>Effective Granular Permissions ({staff.permissions?.length || 0})</span>
                  </h3>
                  <span className="text-xs font-bold text-[#64748B]">Enforced by Backend</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
                  {staff.permissions && staff.permissions.length > 0 ? (
                    staff.permissions.map((perm) => (
                      <div
                        key={perm}
                        className="p-2.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] flex items-center gap-2 text-xs"
                      >
                        <CheckCircle2 className="h-4 w-4 text-[#16805D] shrink-0" />
                        <span className="font-mono font-bold text-[#0F172A]">{perm}</span>
                      </div>
                    ))
                  ) : (
                    <div className="col-span-2 text-xs font-semibold text-[#64748B] italic">
                      No specific granular permissions assigned.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: SECURITY & AUTH */}
          {activeTab === "security" && (
            <div className="space-y-6">
              {/* Authentication Security State */}
              <div className="bg-[#F8FAFC] rounded-2xl border-2 border-[#CBD5E1] p-5 space-y-4">
                <h3 className="text-base font-black text-[#0F172A] flex items-center gap-2">
                  <Lock className="h-5 w-5 text-[#176B63]" />
                  <span>Authentication Security State</span>
                </h3>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="p-3.5 bg-white rounded-xl border border-[#CBD5E1]">
                    <label className="text-xs font-bold text-[#475569] block mb-1">
                      Consecutive Failed Logins
                    </label>
                    <div className="flex items-center gap-2">
                      <span
                        className={`font-black text-lg ${
                          staff.failed_login_attempts >= 3
                            ? "text-[#DC2626]"
                            : staff.failed_login_attempts > 0
                            ? "text-[#D97706]"
                            : "text-[#16805D]"
                        }`}
                      >
                        {staff.failed_login_attempts} / 3
                      </span>
                      {staff.failed_login_attempts >= 3 && (
                        <span className="text-xs font-black text-[#DC2626] bg-[#FEE2E2] px-2 py-0.5 rounded">
                          Threshold Exceeded
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="p-3.5 bg-white rounded-xl border border-[#CBD5E1]">
                    <label className="text-xs font-bold text-[#475569] block mb-1">
                      Account Lock Status
                    </label>
                    <div className="font-black text-sm">
                      {staff.account_status === "locked" ? (
                        <span className="text-[#DC2626] flex items-center gap-1.5">
                          <Lock className="h-4 w-4" /> Locked Out
                        </span>
                      ) : (
                        <span className="text-[#16805D] flex items-center gap-1.5">
                          <CheckCircle2 className="h-4 w-4" /> Unlocked / Eligible
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Primary Security Actions */}
                <div className="pt-2 flex flex-wrap gap-3">
                  {staff.account_status === "locked" ? (
                    <button
                      onClick={() => onOpenUnlockModal(staff)}
                      className="px-4.5 py-2.5 rounded-xl bg-[#16805D] hover:bg-[#11664A] text-white text-sm font-black flex items-center gap-2 shadow-sm cursor-pointer transition-all"
                    >
                      <Unlock className="h-4.5 w-4.5" />
                      <span>Unlock Account</span>
                    </button>
                  ) : null}

                  <button
                    onClick={() => onOpenResetPasswordModal(staff)}
                    className="px-4.5 py-2.5 rounded-xl bg-[#0F172A] hover:bg-[#1E293B] text-white text-sm font-black flex items-center gap-2 shadow-sm cursor-pointer transition-all"
                  >
                    <KeyRound className="h-4.5 w-4.5" />
                    <span>Reset Credentials</span>
                  </button>

                  {staff.is_active ? (
                    <button
                      onClick={() => onOpenDeactivateModal(staff)}
                      className="px-4.5 py-2.5 rounded-xl bg-[#FEE2E2] hover:bg-[#FCD3D3] text-[#991B1B] border-2 border-[#FCA5A5] text-sm font-black flex items-center gap-2 cursor-pointer transition-all"
                    >
                      <UserX className="h-4.5 w-4.5" />
                      <span>Inactivate Account</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => onActivateAccount(staff)}
                      className="px-4.5 py-2.5 rounded-xl bg-[#EDF7F2] hover:bg-[#D7EFE4] text-[#16805D] border-2 border-[#A6E1CE] text-sm font-black flex items-center gap-2 cursor-pointer transition-all"
                    >
                      <UserCheck className="h-4.5 w-4.5" />
                      <span>Activate Account</span>
                    </button>
                  )}

                  {currentUserRole === "superadmin" && onOpenDeleteModal && (
                    <button
                      onClick={() => onOpenDeleteModal(staff)}
                      className="px-4.5 py-2.5 rounded-xl bg-[#FFF1F2] hover:bg-[#FFE4E6] text-[#E11D48] border-2 border-[#FDA4AF] text-sm font-black flex items-center gap-2 cursor-pointer transition-all"
                      title="Permanently Delete Staff Member (SuperAdmin Only)"
                    >
                      <Trash2 className="h-4.5 w-4.5 text-[#E11D48]" />
                      <span>Delete Account (SuperAdmin)</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: ACTIVITY & AUDIT */}
          {activeTab === "audit" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-black text-[#0F172A] flex items-center gap-2">
                  <History className="h-5 w-5 text-[#176B63]" />
                  <span>Personnel Security Event History</span>
                </h3>
              </div>

              <div className="bg-[#F8FAFC] rounded-2xl border-2 border-[#CBD5E1] p-4 text-xs space-y-3">
                <div className="p-3 bg-white rounded-xl border border-[#E2E8F0]">
                  <div className="flex items-center justify-between font-bold text-[#0F172A]">
                    <span className="font-mono text-[#176B63]">STAFF_ACCOUNT_PROVISIONED</span>
                    <span className="text-[#64748B]">{formatDateTime(staff.created_at)}</span>
                  </div>
                  <p className="text-[#475569] mt-1 font-medium">
                    Account provisioned with Employee ID {staff.employee_id} and role {staff.role}.
                  </p>
                </div>

                {staff.locked_at && (
                  <div className="p-3 bg-[#FEF2F2] rounded-xl border border-[#FCA5A5]">
                    <div className="flex items-center justify-between font-bold text-[#991B1B]">
                      <span className="font-mono">ACCOUNT_LOCKED_AUTO</span>
                      <span>{formatDateTime(staff.locked_at)}</span>
                    </div>
                    <p className="text-[#7F1D1D] mt-1 font-semibold">
                      Account locked out after 3 consecutive failed password attempts.
                    </p>
                  </div>
                )}

                {staff.last_login_at && (
                  <div className="p-3 bg-white rounded-xl border border-[#E2E8F0]">
                    <div className="flex items-center justify-between font-bold text-[#0F172A]">
                      <span className="font-mono text-[#16805D]">LOGIN_SUCCESS</span>
                      <span className="text-[#64748B]">{formatDateTime(staff.last_login_at)}</span>
                    </div>
                    <p className="text-[#475569] mt-1 font-medium">
                      Authentication session issued. Consecutive failure counter reset to 0.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
