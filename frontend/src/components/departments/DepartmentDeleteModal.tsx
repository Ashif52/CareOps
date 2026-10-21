"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  AlertTriangle,
  Trash2,
  ArrowRight,
  ShieldAlert,
  CheckCircle2,
  Loader2,
  Users,
  ClipboardList,
  Archive,
} from "lucide-react";
import { Department, api } from "@/lib/api";

interface DepartmentDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  department: Department | null;
  allDepartments: Department[];
}

interface DepartmentDependencies {
  can_safely_delete: boolean;
  reason?: string;
  active_staff_count: number;
  unresolved_ticket_count: number;
  total_historical_tickets: number;
}

export function DepartmentDeleteModal({
  isOpen,
  onClose,
  onSuccess,
  department,
  allDepartments,
}: DepartmentDeleteModalProps) {
  const [dependencies, setDependencies] = useState<DepartmentDependencies | null>(null);
  const [isLoadingDeps, setIsLoadingDeps] = useState(true);
  const [targetDeptId, setTargetDeptId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Filter available candidate target departments (must be different and active)
  const candidateTargetDepts = allDepartments.filter(
    (d) => d.id !== department?.id && d.is_active
  );

  useEffect(() => {
    if (isOpen && department) {
      setIsLoadingDeps(true);
      setErrorMessage(null);
      setDependencies(null);
      // Default target department
      const firstCandidate = candidateTargetDepts[0];
      setTargetDeptId(firstCandidate ? firstCandidate.id : "");

      api
        .getDepartmentDependencies(department.id)
        .then((res: any) => {
          setDependencies(res);
        })
        .catch((err: any) => {
          setErrorMessage(err?.message || "Failed to inspect department dependencies.");
        })
        .finally(() => {
          setIsLoadingDeps(false);
        });
    }
  }, [isOpen, department]);

  if (!isOpen || !department) return null;

  const hasActiveDependencies =
    (dependencies?.active_staff_count || 0) > 0 ||
    (dependencies?.unresolved_ticket_count || 0) > 0;

  const handleExecuteDelete = async () => {
    setErrorMessage(null);

    try {
      setIsSubmitting(true);

      // If active dependencies exist, reassign them first
      if (hasActiveDependencies) {
        if (!targetDeptId) {
          setErrorMessage("Please select a target department to receive the assigned staff and open tickets.");
          setIsSubmitting(false);
          return;
        }

        await api.reassignDepartmentDependencies(department.id, {
          target_department_id: targetDeptId,
          reassign_staff: true,
          reassign_tickets: true,
        });
      }

      // Now execute safe delete
      await api.deleteDepartment(department.id);

      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMessage(err?.message || "Safe department deletion failed.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4">
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/55 backdrop-blur-xs transition-opacity"
      />

      <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border-2 border-[#CBD5E1] p-6 z-10 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#E2E8F0]">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-2xl border ${
              hasActiveDependencies
                ? "bg-amber-50 border-amber-200 text-amber-700"
                : "bg-red-50 border-red-200 text-red-600"
            }`}>
              <Trash2 className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-black text-[#0F172A]">
                Safe Department Removal
              </h3>
              <p className="text-xs text-[#64748B] font-semibold">
                {department.name} ({department.code})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-[#64748B] hover:text-[#0F172A] hover:bg-[#F1F5F9] transition cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Error message */}
        {errorMessage && (
          <div className="mt-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs font-bold flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 text-red-600" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Loading state */}
        {isLoadingDeps ? (
          <div className="py-12 flex flex-col items-center justify-center gap-2 text-[#64748B]">
            <Loader2 className="h-7 w-7 animate-spin text-[#176B63]" />
            <span className="text-xs font-bold">Verifying department dependencies & audit history...</span>
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            {/* Dependency Analysis Card */}
            {hasActiveDependencies ? (
              <div className="p-4 rounded-2xl bg-amber-50 border-2 border-amber-200 space-y-3">
                <div className="flex items-start gap-2.5 text-amber-900">
                  <ShieldAlert className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-black text-amber-900">
                      Department Has Active Operational Dependencies
                    </h4>
                    <p className="text-xs text-amber-800 mt-0.5 leading-relaxed font-medium">
                      Under hospital governance policy, a department cannot be removed while it has active staff or open patient tickets. You must reassign them to proceed safely.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1 text-xs">
                  <div className="p-2.5 rounded-xl bg-white border border-amber-200 flex items-center gap-2 font-bold text-amber-950">
                    <Users className="h-4 w-4 text-amber-700" />
                    <span>{dependencies?.active_staff_count} Active Staff</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white border border-amber-200 flex items-center gap-2 font-bold text-amber-950">
                    <ClipboardList className="h-4 w-4 text-amber-700" />
                    <span>{dependencies?.unresolved_ticket_count} Open Tickets</span>
                  </div>
                </div>

                {/* Reassignment Target Selector */}
                <div className="pt-2">
                  <label className="block text-xs font-black text-amber-950 uppercase tracking-wider mb-1.5">
                    Reassign Staff & Tickets To:
                  </label>
                  <select
                    value={targetDeptId}
                    onChange={(e) => setTargetDeptId(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border-2 border-amber-300 bg-white text-xs font-bold text-[#0F172A] focus:outline-none focus:border-[#176B63]"
                  >
                    {candidateTargetDepts.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.code})
                      </option>
                    ))}
                  </select>
                  <span className="text-[10px] text-amber-800 mt-1 block">
                    All {dependencies?.active_staff_count} personnel and {dependencies?.unresolved_ticket_count} open tickets will be safely transitioned.
                  </span>
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-2xl bg-emerald-50 border-2 border-emerald-200 space-y-2.5">
                <div className="flex items-start gap-2.5 text-emerald-900">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-black text-emerald-950">
                      Safe to Remove
                    </h4>
                    <p className="text-xs text-emerald-800 mt-0.5 leading-relaxed font-medium">
                      This department has no active personnel and zero unresolved tickets. It can be safely removed.
                    </p>
                  </div>
                </div>

                {dependencies && dependencies.total_historical_tickets > 0 && (
                  <div className="p-2.5 rounded-xl bg-white border border-emerald-200 flex items-center gap-2 text-xs font-bold text-emerald-950">
                    <Archive className="h-4 w-4 text-emerald-700 shrink-0" />
                    <span>
                      Historical Integrity: {dependencies.total_historical_tickets} resolved tickets & audit logs are safely preserved in the database.
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Warning summary */}
            <p className="text-xs text-[#64748B] leading-relaxed">
              Safe Deletion Rule: Removing a department deactivates its routing rule. Historical patient submissions, audit logs, and past ticket telemetry will never be wiped out.
            </p>

            {/* Actions */}
            <div className="pt-3 border-t border-[#E2E8F0] flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2.5 rounded-xl border-2 border-[#CBD5E1] bg-white text-xs font-black text-[#475569] hover:bg-[#F1F5F9] transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteDelete}
                disabled={isSubmitting || (hasActiveDependencies && !targetDeptId)}
                className={`px-5 py-2.5 rounded-xl text-white text-xs font-black flex items-center gap-2 shadow-sm transition cursor-pointer disabled:opacity-50 ${
                  hasActiveDependencies
                    ? "bg-amber-600 hover:bg-amber-700"
                    : "bg-red-600 hover:bg-red-700"
                }`}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Processing...</span>
                  </>
                ) : hasActiveDependencies ? (
                  <>
                    <ArrowRight className="h-4 w-4" />
                    <span>Reassign Dependencies & Remove</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4" />
                    <span>Confirm Safe Removal</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
