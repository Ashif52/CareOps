"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Users,
  UserPlus,
  Search,
  RefreshCw,
  KeyRound,
  ShieldCheck,
  ShieldAlert,
  CheckCircle2,
  AlertCircle,
  X,
  Phone,
  Mail,
  Building,
  Bed,
  Lock,
  Eye,
  EyeOff
} from "lucide-react";
import { api, PatientAccount, formatDateTime } from "@/lib/api";

export function PatientAccountsView() {
  const [patients, setPatients] = useState<PatientAccount[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showResetModal, setShowResetModal] = useState<PatientAccount | null>(null);

  // Form states: Create Patient
  const [createName, setCreateName] = useState("");
  const [createPhone, setCreatePhone] = useState("");
  const [createEmail, setCreateEmail] = useState("");
  const [createRoom, setCreateRoom] = useState("");
  const [createBed, setCreateBed] = useState("");
  const [createPassword, setCreatePassword] = useState("");
  const [showCreatePassword, setShowCreatePassword] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [isSubmittingCreate, setIsSubmittingCreate] = useState(false);
  const [createdPatientResult, setCreatedPatientResult] = useState<{
    patient_id: string;
    temporary_password?: string;
  } | null>(null);

  // Form states: Reset Password
  const [newTempPassword, setNewTempPassword] = useState("");
  const [showTempPassword, setShowTempPassword] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetSuccessMsg, setResetSuccessMsg] = useState<string | null>(null);
  const [isSubmittingReset, setIsSubmittingReset] = useState(false);

  const fetchPatients = useCallback(async () => {
    setIsLoading(true);
    try {
      const res: any = await api.getPatientsList({
        search: searchQuery.trim() || undefined,
        limit: 100,
      });
      const patientItems = Array.isArray(res) ? res : (res?.items || []);
      setPatients(patientItems);
    } catch (err) {
      console.error("Failed to fetch patient accounts:", err);
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery]);

  useEffect(() => {
    fetchPatients();
  }, [fetchPatients]);

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createName.trim() || !createPhone.trim()) {
      setCreateError("Patient Name and Contact Phone are required.");
      return;
    }

    setIsSubmittingCreate(true);
    setCreateError(null);
    setCreatedPatientResult(null);

    try {
      const res: any = await api.createPatientAccount({
        name: createName.trim(),
        phone: createPhone.trim(),
        email: createEmail.trim() || undefined,
        room_number: createRoom.trim() || undefined,
        bed_number: createBed.trim() || undefined,
        password: createPassword.trim() || undefined,
      });

      setCreatedPatientResult({
        patient_id: res.patient_id,
        temporary_password: res.temporary_password,
      });
      fetchPatients();
    } catch (err: any) {
      setCreateError(err.message || "Failed to create patient account.");
    } finally {
      setIsSubmittingCreate(false);
    }
  };

  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showResetModal) return;

    setIsSubmittingReset(true);
    setResetError(null);
    setResetSuccessMsg(null);

    try {
      const res: any = await api.resetPatientPassword(showResetModal.id, {
        temporary_password: newTempPassword.trim() || undefined,
      });
      setResetSuccessMsg(`Password reset successfully. New password: ${res.temporary_password}`);
      fetchPatients();
    } catch (err: any) {
      setResetError(err.message || "Failed to reset password.");
    } finally {
      setIsSubmittingReset(false);
    }
  };

  const handleToggleActive = async (patient: PatientAccount) => {
    const action = patient.is_active ? "deactivate" : "activate";
    if (!confirm(`Are you sure you want to ${action} account for ${patient.name} (${patient.patient_id})?`)) {
      return;
    }

    try {
      if (patient.is_active) {
        await api.deactivatePatient(patient.id);
      } else {
        await api.activatePatient(patient.id);
      }
      fetchPatients();
    } catch (err: any) {
      alert(`Operation failed: ${err.message || err}`);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-xl bg-[#176B63] flex items-center justify-center text-white shadow-sm">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              Patient Account Administration
            </h1>
            <p className="text-xs sm:text-sm text-slate-500">
              Centralized patient identity registry, portal credentials, and bedside access management.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchPatients}
            disabled={isLoading}
            className="px-3.5 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>
          <button
            onClick={() => {
              setShowCreateModal(true);
              setCreatedPatientResult(null);
              setCreateError(null);
            }}
            className="px-3.5 py-2 rounded-xl bg-[#176B63] hover:bg-[#125852] text-white text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
          >
            <UserPlus className="h-3.5 w-3.5" />
            <span>Create Patient Account</span>
          </button>
        </div>
      </div>

      {/* Directory Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        {/* Table Top Controls */}
        <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-slate-900">Registered Patients</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 font-semibold font-mono">
              {patients.length} Accounts
            </span>
          </div>

          <div className="relative">
            <Search className="h-3.5 w-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by Patient ID, Name, Phone, or Room..."
              className="pl-8 pr-3 py-1.5 text-xs rounded-xl bg-white border border-slate-200 focus:outline-none focus:ring-1 focus:ring-[#176B63] w-64"
            />
          </div>
        </div>

        {/* Table Rows */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                <th className="py-3 px-4">Patient ID</th>
                <th className="py-3 px-4">Full Name</th>
                <th className="py-3 px-4">Contact Phone</th>
                <th className="py-3 px-4">Email</th>
                <th className="py-3 px-4">Location (Room / Bed)</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Last Activity</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {patients.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <Users className="h-8 w-8 mx-auto mb-2 text-slate-300" />
                    <p className="font-medium">No patient accounts found</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Create patient accounts or register bedside patients to view them here.
                    </p>
                  </td>
                </tr>
              ) : (
                patients.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-[#176B63]">
                      {p.patient_id}
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-900">
                      {p.name}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-600">
                      {p.phone || "—"}
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      {p.email || "—"}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap text-slate-600">
                      {p.room_number ? (
                        <span className="font-medium">
                          Room {p.room_number} {p.bed_number ? `(Bed ${p.bed_number})` : ""}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      {p.is_active ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="h-3 w-3" />
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                          <ShieldAlert className="h-3 w-3" />
                          Deactivated
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap text-slate-500 text-[11px]">
                      {p.last_login_at ? formatDateTime(p.last_login_at) : formatDateTime(p.created_at)}
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => {
                            setShowResetModal(p);
                            setNewTempPassword("");
                            setResetError(null);
                            setResetSuccessMsg(null);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium transition-colors cursor-pointer text-[11px] inline-flex items-center gap-1"
                          title="Reset Password"
                        >
                          <KeyRound className="h-3 w-3 text-slate-600" />
                          <span>Reset</span>
                        </button>
                        <button
                          onClick={() => handleToggleActive(p)}
                          className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer text-[11px] inline-flex items-center gap-1 ${
                            p.is_active
                              ? "bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200"
                              : "bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200"
                          }`}
                        >
                          <span>{p.is_active ? "Deactivate" : "Activate"}</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Create Patient Account */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-[#176B63]/10 text-[#176B63]">
                  <UserPlus className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Provision Patient Account</h3>
                  <p className="text-xs text-slate-500">Creates authoritative credentials in central hospital IAM</p>
                </div>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {createdPatientResult ? (
              <div className="p-6 space-y-4">
                <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 space-y-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                    <h4 className="font-bold text-sm">Patient Account Created</h4>
                  </div>
                  <p className="text-xs text-emerald-800">
                    The patient can now log in at the Patient Portal using their unique Patient ID or phone number.
                  </p>
                  <div className="p-3 bg-white rounded-xl border border-emerald-200 font-mono text-xs space-y-1">
                    <div>
                      <span className="text-slate-500">Patient ID: </span>
                      <strong className="text-[#176B63] text-sm">{createdPatientResult.patient_id}</strong>
                    </div>
                    {createdPatientResult.temporary_password && (
                      <div>
                        <span className="text-slate-500">Temporary Password: </span>
                        <strong className="text-slate-900">{createdPatientResult.temporary_password}</strong>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    onClick={() => setShowCreateModal(false)}
                    className="px-4 py-2 rounded-xl bg-[#176B63] text-white text-xs font-semibold cursor-pointer"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleCreateSubmit} className="p-6 space-y-4 text-xs">
                {createError && (
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
                    <span>{createError}</span>
                  </div>
                )}

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Patient Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={createName}
                    onChange={(e) => setCreateName(e.target.value)}
                    placeholder="e.g. Eleanor Vance"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#176B63]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">
                      Contact Phone *
                    </label>
                    <input
                      type="tel"
                      required
                      value={createPhone}
                      onChange={(e) => setCreatePhone(e.target.value)}
                      placeholder="+1-555-0192"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#176B63] font-mono"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">
                      Email Address (Optional)
                    </label>
                    <input
                      type="email"
                      value={createEmail}
                      onChange={(e) => setCreateEmail(e.target.value)}
                      placeholder="patient@gmail.com"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#176B63]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">
                      Assigned Room
                    </label>
                    <input
                      type="text"
                      value={createRoom}
                      onChange={(e) => setCreateRoom(e.target.value)}
                      placeholder="e.g. 204"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#176B63]"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">
                      Bed Number
                    </label>
                    <input
                      type="text"
                      value={createBed}
                      onChange={(e) => setCreateBed(e.target.value)}
                      placeholder="e.g. A"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#176B63]"
                    />
                  </div>
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Initial Password (Optional — auto-generated if left blank)
                  </label>
                  <div className="relative">
                    <input
                      type={showCreatePassword ? "text" : "password"}
                      value={createPassword}
                      onChange={(e) => setCreatePassword(e.target.value)}
                      placeholder="Leave blank to generate secure temporary password"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#176B63]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCreatePassword(!showCreatePassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      {showCreatePassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 font-medium hover:bg-slate-50 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingCreate}
                    className="px-4 py-2 rounded-xl bg-[#176B63] hover:bg-[#125852] disabled:opacity-50 text-white font-semibold cursor-pointer shadow-2xs"
                  >
                    {isSubmittingCreate ? "Creating Account..." : "Create Patient"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Modal: Reset Patient Password */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full overflow-hidden shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-slate-100 text-slate-700">
                  <KeyRound className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Reset Patient Password</h3>
                  <p className="text-xs text-slate-500">
                    {showResetModal.name} ({showResetModal.patient_id})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowResetModal(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleResetSubmit} className="p-6 space-y-4 text-xs">
              {resetError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
                  <span>{resetError}</span>
                </div>
              )}

              {resetSuccessMsg ? (
                <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 space-y-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                    <span className="font-bold">Password Reset Confirmed</span>
                  </div>
                  <p className="text-xs font-mono bg-white p-2.5 rounded-lg border border-emerald-200">
                    {resetSuccessMsg}
                  </p>
                  <p className="text-[11px] text-emerald-700">
                    Any existing active sessions for this patient have been revoked immediately.
                  </p>
                </div>
              ) : (
                <>
                  <p className="text-slate-600">
                    Resetting credentials revokes all current sessions immediately. You can enter a specific temporary password or leave it blank to auto-generate one.
                  </p>

                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">
                      New Temporary Password (Optional)
                    </label>
                    <div className="relative">
                      <input
                        type={showTempPassword ? "text" : "password"}
                        value={newTempPassword}
                        onChange={(e) => setNewTempPassword(e.target.value)}
                        placeholder="Leave blank to auto-generate"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#176B63]"
                      />
                      <button
                        type="button"
                        onClick={() => setShowTempPassword(!showTempPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        {showTempPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                </>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowResetModal(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 font-medium hover:bg-slate-50 cursor-pointer"
                >
                  {resetSuccessMsg ? "Close" : "Cancel"}
                </button>
                {!resetSuccessMsg && (
                  <button
                    type="submit"
                    disabled={isSubmittingReset}
                    className="px-4 py-2 rounded-xl bg-[#176B63] hover:bg-[#125852] disabled:opacity-50 text-white font-semibold cursor-pointer shadow-2xs"
                  >
                    {isSubmittingReset ? "Resetting..." : "Confirm Password Reset"}
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
