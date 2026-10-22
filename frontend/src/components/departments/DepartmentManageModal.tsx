"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  Building2,
  HeartPulse,
  Wrench,
  Sparkles,
  Stethoscope,
  Pill,
  Receipt,
  Shield,
  AlertCircle,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import { Department, api } from "@/lib/api";

interface DepartmentManageModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  department?: Department | null;
}

const AVAILABLE_ICONS = [
  { id: "heart-pulse", label: "Clinical / Cardiology", icon: HeartPulse },
  { id: "wrench", label: "Maintenance", icon: Wrench },
  { id: "sparkles", label: "Housekeeping / Sanitation", icon: Sparkles },
  { id: "stethoscope", label: "Medical / Nursing", icon: Stethoscope },
  { id: "pill", label: "Pharmacy", icon: Pill },
  { id: "receipt", label: "Billing & Accounts", icon: Receipt },
  { id: "building-2", label: "Operations / IT", icon: Building2 },
  { id: "shield", label: "Security & Safety", icon: Shield },
];

export function DepartmentManageModal({
  isOpen,
  onClose,
  onSuccess,
  department,
}: DepartmentManageModalProps) {
  const isEditMode = !!department;

  const [id, setId] = useState("");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState("building-2");
  const [availableSupervisors, setAvailableSupervisors] = useState<any[]>([]);
  const [selectedSupervisorIds, setSelectedSupervisorIds] = useState<number[]>([]);
  const [categoriesText, setCategoriesText] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const loadSupervisors = async () => {
      try {
        const sups: any = await api.getSupervisorsList();
        if (isMounted) setAvailableSupervisors(sups || []);
      } catch (_) {}
    };
    if (isOpen) {
      loadSupervisors();
    }
    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  useEffect(() => {
    if (department) {
      setId(department.id);
      setName(department.name);
      setCode(department.code);
      setDescription(department.description || "");
      setIcon(department.icon || "building-2");
      setSelectedSupervisorIds(
        department.supervisor_ids ||
          (department.supervisor_id ? [department.supervisor_id] : [])
      );
      setCategoriesText(department.categories?.join(", ") || "");
    } else {
      setId("");
      setName("");
      setCode("");
      setDescription("");
      setIcon("building-2");
      setSelectedSupervisorIds([]);
      setCategoriesText("");
    }
    setErrorMessage(null);
    setSuccessMessage(null);
  }, [department, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const trimmedName = name.trim();
    const trimmedCode = code.trim().toUpperCase();
    const trimmedDesc = description.trim();
    const trimmedId = id.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "_");

    if (!trimmedName) {
      setErrorMessage("Department name is required.");
      return;
    }
    if (!trimmedCode) {
      setErrorMessage("Department code is required (e.g. CARD, MNT, PATH).");
      return;
    }
    if (!isEditMode && !trimmedId) {
      setErrorMessage("Department system ID is required (e.g. cardiology, maintenance).");
      return;
    }

    const parsedCategories = categoriesText
      .split(/[,\n]+/)
      .map((s) => s.trim())
      .filter(Boolean);

    try {
      setIsSubmitting(true);
      if (isEditMode && department) {
        await api.updateDepartment(department.id, {
          name: trimmedName,
          code: trimmedCode,
          description: trimmedDesc,
          icon,
          supervisor_ids: selectedSupervisorIds,
          categories: parsedCategories,
        });
        setSuccessMessage(`Department "${trimmedName}" updated successfully.`);
      } else {
        await api.createDepartment({
          id: trimmedId,
          name: trimmedName,
          code: trimmedCode,
          description: trimmedDesc,
          icon,
          supervisor_ids: selectedSupervisorIds,
          categories: parsedCategories,
        });
        setSuccessMessage(`Department "${trimmedName}" created successfully.`);
      }

      setTimeout(() => {
        onSuccess();
        onClose();
      }, 700);
    } catch (err: any) {
      setErrorMessage(err?.message || "Failed to save department. Check uniqueness of name and code.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4">
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity"
      />

      <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border-2 border-[#CBD5E1] p-6 z-10 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#E2E8F0]">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-[#E8F3F1] border border-[#99F6E4] text-[#176B63]">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-black text-[#0F172A]">
                {isEditMode ? "Edit Hospital Department" : "Add New Department"}
              </h3>
              <p className="text-xs text-[#64748B] font-semibold">
                {isEditMode
                  ? `Update details and service category for ${department?.name}`
                  : "Register a clinical or service department in the hospital directory"}
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

        {/* Feedback banners */}
        {errorMessage && (
          <div className="mt-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs font-bold flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
            <span>{errorMessage}</span>
          </div>
        )}
        {successMessage && (
          <div className="mt-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
            <span>{successMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* Department Name */}
          <div>
            <label className="block text-xs font-black text-[#0F172A] uppercase tracking-wider mb-1">
              Department Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (!isEditMode && !id) {
                  setId(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 30));
                }
              }}
              placeholder="e.g. Diagnostic Pathology Lab"
              className="w-full px-3.5 py-2.5 rounded-xl border-2 border-[#CBD5E1] bg-[#F8FAFC] text-sm font-bold text-[#0F172A] focus:outline-none focus:border-[#176B63] focus:bg-white"
            />
          </div>

          {/* Grid: Code and System ID */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-black text-[#0F172A] uppercase tracking-wider mb-1">
                Department Code <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                maxLength={10}
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="e.g. PATH"
                className="w-full px-3.5 py-2.5 rounded-xl border-2 border-[#CBD5E1] bg-[#F8FAFC] text-sm font-mono font-black text-[#176B63] uppercase focus:outline-none focus:border-[#176B63] focus:bg-white"
              />
              <span className="text-[10px] text-[#64748B] mt-0.5 block">Short 2-6 character identifier</span>
            </div>

            <div>
              <label className="block text-xs font-black text-[#0F172A] uppercase tracking-wider mb-1">
                System Identifier ID <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                disabled={isEditMode}
                value={id}
                onChange={(e) => setId(e.target.value.toLowerCase())}
                placeholder="e.g. pathology"
                className="w-full px-3.5 py-2.5 rounded-xl border-2 border-[#CBD5E1] bg-[#F8FAFC] text-sm font-mono font-bold text-[#0F172A] disabled:opacity-60 disabled:bg-[#E2E8F0] focus:outline-none focus:border-[#176B63] focus:bg-white"
              />
              <span className="text-[10px] text-[#64748B] mt-0.5 block">Unique database routing key</span>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-black text-[#0F172A] uppercase tracking-wider mb-1">
              Description & Scope
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Clinical and operational responsibilities of this department..."
              className="w-full px-3.5 py-2 rounded-xl border-2 border-[#CBD5E1] bg-[#F8FAFC] text-xs font-semibold text-[#0F172A] focus:outline-none focus:border-[#176B63] focus:bg-white leading-relaxed"
            />
          </div>

          {/* Icon Selector */}
          <div>
            <label className="block text-xs font-black text-[#0F172A] uppercase tracking-wider mb-1.5">
              Department Icon
            </label>
            <div className="grid grid-cols-4 gap-2">
              {AVAILABLE_ICONS.map((item) => {
                const IconComponent = item.icon;
                const isSelected = icon === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setIcon(item.id)}
                    className={`p-2.5 rounded-xl border-2 flex flex-col items-center gap-1 transition cursor-pointer text-center ${
                      isSelected
                        ? "border-[#176B63] bg-[#E8F3F1] text-[#176B63] shadow-xs"
                        : "border-[#E2E8F0] bg-white text-[#64748B] hover:border-[#CBD5E1] hover:text-[#0F172A]"
                    }`}
                  >
                    <IconComponent className="h-5 w-5" />
                    <span className="text-[10px] font-bold truncate max-w-full">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Multi-Supervisor Assignment (Section 3 & 5) */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-black text-[#0F172A] uppercase tracking-wider">
                Assigned Department Supervisors
              </label>
              <span className="text-[10px] text-[#176B63] font-bold">
                {selectedSupervisorIds.length} Assigned
              </span>
            </div>
            <p className="text-[11px] text-[#64748B] mb-2">
              Incoming patient requests route exclusively to these assigned supervisors.
            </p>
            <div className="max-h-36 overflow-y-auto p-2 rounded-xl border-2 border-[#CBD5E1] bg-[#F8FAFC] space-y-1.5 scrollbar-thin">
              {availableSupervisors.length === 0 ? (
                <div className="text-xs text-[#64748B] italic p-2">
                  No active supervisor accounts registered yet.
                </div>
              ) : (
                availableSupervisors.map((s) => {
                  const isChecked = selectedSupervisorIds.includes(s.id);
                  return (
                    <label
                      key={s.id}
                      className={`flex items-center justify-between p-2 rounded-lg border text-xs cursor-pointer transition ${
                        isChecked
                          ? "bg-[#E8F3F1] border-[#176B63] text-[#176B63] font-bold"
                          : "bg-white border-[#E2E8F0] text-[#0F172A] hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedSupervisorIds((prev) => [...prev, s.id]);
                            } else {
                              setSelectedSupervisorIds((prev) => prev.filter((id) => id !== s.id));
                            }
                          }}
                          className="rounded text-[#176B63] focus:ring-[#176B63]"
                        />
                        <span>{s.name}</span>
                      </div>
                      <span className="text-[10px] text-[#64748B] font-mono">
                        {s.designation || s.email}
                      </span>
                    </label>
                  );
                })
              )}
            </div>
          </div>

          {/* Department-Specific Request Categories (Section 7) */}
          <div>
            <label className="block text-xs font-black text-[#0F172A] uppercase tracking-wider mb-1">
              Configurable Request Categories
            </label>
            <p className="text-[11px] text-[#64748B] mb-1.5">
              Enter permitted patient request categories separated by commas or new lines.
            </p>
            <textarea
              rows={3}
              value={categoriesText}
              onChange={(e) => setCategoriesText(e.target.value)}
              placeholder="e.g. Electrical issue, Plumbing issue, Air conditioning, Equipment repair, General maintenance"
              className="w-full px-3.5 py-2 rounded-xl border-2 border-[#CBD5E1] bg-[#F8FAFC] text-xs font-semibold text-[#0F172A] focus:outline-none focus:border-[#176B63] focus:bg-white leading-relaxed"
            />
          </div>

          {/* Action Buttons */}
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
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 rounded-xl bg-[#176B63] text-white hover:bg-[#12534C] text-xs font-black flex items-center gap-2 shadow-sm transition cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <span>{isEditMode ? "Save Department Changes" : "Create Department"}</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
