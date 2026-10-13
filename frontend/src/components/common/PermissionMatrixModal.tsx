"use client";

import React, { useState, useEffect } from "react";
import {
  ShieldCheck,
  CheckSquare,
  Square,
  RotateCcw,
  Save,
  X,
  ChevronDown,
  ChevronRight,
  AlertCircle,
  Lock
} from "lucide-react";
import { api } from "@/lib/api";

interface ActionItem {
  id: string;
  key: string;
  label: string;
  description: string;
}

interface ModuleItem {
  id: string;
  name: string;
  description: string;
  actions: ActionItem[];
}

interface PermissionMatrixModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: number;
  userName: string;
  userRole: string;
  isSuperadminTarget?: boolean;
  onSaved?: () => void;
}

export function PermissionMatrixModal({
  isOpen,
  onClose,
  userId,
  userName,
  userRole,
  isSuperadminTarget = false,
  onSaved,
}: PermissionMatrixModalProps) {
  const [modules, setModules] = useState<ModuleItem[]>([]);
  const [assignedPermissions, setAssignedPermissions] = useState<string[]>([]);
  const [originalPermissions, setOriginalPermissions] = useState<string[]>([]);
  const [defaultRolePermissions, setDefaultRolePermissions] = useState<string[]>([]);
  const [expandedModules, setExpandedModules] = useState<{ [id: string]: boolean }>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Check if dirty
  const isDirty =
    assignedPermissions.length !== originalPermissions.length ||
    assignedPermissions.some((p) => !originalPermissions.includes(p));

  // Load catalog and current user permissions
  useEffect(() => {
    if (!isOpen) return;

    const loadData = async () => {
      setIsLoading(true);
      setSaveSuccess(false);
      try {
        // 1. Fetch matrix catalog
        const catalogRes: any = await api.getPermissionMatrixCatalog(isSuperadminTarget);
        if (Array.isArray(catalogRes)) {
          setModules(catalogRes);
          // Default all expanded
          const exp: { [id: string]: boolean } = {};
          catalogRes.forEach((m) => {
            exp[m.id] = true;
          });
          setExpandedModules(exp);
        }

        // 2. Fetch target user permissions
        const userRes: any = isSuperadminTarget
          ? await api.getAdminPermissions(userId)
          : await api.getUserPermissionsMatrix(userId);

        const activePerms = userRes?.assigned_permissions || userRes?.permissions || [];
        const roleDefaults = userRes?.default_role_permissions || [];

        setAssignedPermissions(activePerms);
        setOriginalPermissions(activePerms);
        setDefaultRolePermissions(roleDefaults);
      } catch (err: any) {
        console.error("Failed to load permissions matrix:", err);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [isOpen, userId, isSuperadminTarget]);

  if (!isOpen) return null;

  const togglePermission = (key: string) => {
    setAssignedPermissions((prev) =>
      prev.includes(key) ? prev.filter((p) => p !== key) : [...prev, key]
    );
  };

  const toggleModule = (module: ModuleItem) => {
    const moduleKeys = module.actions.map((a) => a.key);
    const allSelected = moduleKeys.every((k) => assignedPermissions.includes(k));

    if (allSelected) {
      // Deselect all in module
      setAssignedPermissions((prev) => prev.filter((k) => !moduleKeys.includes(k)));
    } else {
      // Select all in module
      const toAdd = moduleKeys.filter((k) => !assignedPermissions.includes(k));
      setAssignedPermissions((prev) => [...prev, ...toAdd]);
    }
  };

  const handleResetToDefault = () => {
    setAssignedPermissions([...defaultRolePermissions]);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      if (isSuperadminTarget) {
        await api.setAdminPermissions(userId, assignedPermissions);
      } else {
        await api.updateUserPermissionsMatrix(userId, assignedPermissions);
      }
      setOriginalPermissions([...assignedPermissions]);
      setSaveSuccess(true);
      if (onSaved) onSaved();
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch (err: any) {
      alert(`Save error: ${err.message || err}`);
    } finally {
      setIsSaving(false);
    }
  };

  const toggleExpand = (modId: string) => {
    setExpandedModules((prev) => ({ ...prev, [modId]: !prev[modId] }));
  };

  // Standard matrix columns: Read, Create, Edit, Delete, Assign, Export
  const standardActionColumns = [
    { id: "read", label: "Read" },
    { id: "create", label: "Create" },
    { id: "update", label: "Edit" },
    { id: "delete", label: "Delete" },
    { id: "assign", label: "Assign" },
    { id: "export", label: "Export" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
      <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col border border-[#E5E9EF] shadow-2xl animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-5 border-b border-[#E5E9EF] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-[#EEF4FD] rounded-xl text-[#3868C9]">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-[#17212F]">Granular Permission Matrix</h2>
                <span className="px-2 py-0.5 rounded-full bg-[#F0F2F5] text-[#475467] text-[11px] font-mono font-bold capitalize">
                  {userRole}
                </span>
                {isDirty && (
                  <span className="px-2 py-0.5 rounded-full bg-[#FEF3F2] text-[#B42318] text-[10px] font-bold">
                    Unsaved Changes
                  </span>
                )}
              </div>
              <p className="text-xs text-[#667085] mt-0.5">
                Configuring access rights for <span className="font-semibold text-[#17212F]">{userName}</span>.
                Changes persist to database and take effect on next API call.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#667085] hover:text-[#17212F] hover:bg-[#F7F8FA] transition cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content Table */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {isLoading ? (
            <div className="py-16 text-center text-xs text-[#667085]">Loading permission catalog...</div>
          ) : (
            <>
              {/* Matrix Table */}
              <div className="border border-[#E5E9EF] rounded-xl overflow-hidden shadow-xs">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-[#F8F9FA] border-b border-[#E5E9EF] text-[#475467] font-semibold">
                      <th className="py-3 px-4 w-1/3">Module / Resource</th>
                      {standardActionColumns.map((col) => (
                        <th key={col.id} className="py-3 px-3 text-center">
                          {col.label}
                        </th>
                      ))}
                      <th className="py-3 px-3 text-center">Module All</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E5E9EF]">
                    {modules.map((module) => {
                      const isExpanded = !!expandedModules[module.id];
                      const moduleKeys = module.actions.map((a) => a.key);
                      const allSelected = moduleKeys.length > 0 && moduleKeys.every((k) => assignedPermissions.includes(k));
                      const someSelected = moduleKeys.some((k) => assignedPermissions.includes(k));

                      return (
                        <React.Fragment key={module.id}>
                          <tr className="bg-[#FAFBFD] hover:bg-[#F2F5F9] transition">
                            <td className="py-2.5 px-4">
                              <button
                                type="button"
                                onClick={() => toggleExpand(module.id)}
                                className="flex items-center gap-2 text-left font-bold text-[#17212F] cursor-pointer"
                              >
                                {isExpanded ? (
                                  <ChevronDown className="h-4 w-4 text-[#667085]" />
                                ) : (
                                  <ChevronRight className="h-4 w-4 text-[#667085]" />
                                )}
                                <span>{module.name}</span>
                              </button>
                              <span className="text-[11px] text-[#667085] ml-6 block">
                                {module.description}
                              </span>
                            </td>

                            {/* Standard Action Checkboxes */}
                            {standardActionColumns.map((col) => {
                              // Find action in this module matching this action category
                              const act = module.actions.find(
                                (a) =>
                                  a.id === col.id ||
                                  (col.id === "update" && (a.id === "edit" || a.id === "update")) ||
                                  (col.id === "delete" && (a.id === "delete" || a.id === "deactivate"))
                              );

                              if (!act) {
                                return (
                                  <td key={col.id} className="py-2.5 px-3 text-center text-[#D0D5DD]">
                                    —
                                  </td>
                                );
                              }

                              const checked = assignedPermissions.includes(act.key);

                              return (
                                <td key={col.id} className="py-2.5 px-3 text-center">
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => togglePermission(act.key)}
                                    title={`${module.name} - ${act.label} (${act.key})`}
                                    className="h-4 w-4 rounded border-[#D0D5DD] text-[#3868C9] focus:ring-[#3868C9] cursor-pointer"
                                  />
                                </td>
                              );
                            })}

                            {/* Select Entire Module */}
                            <td className="py-2.5 px-3 text-center">
                              <button
                                type="button"
                                onClick={() => toggleModule(module)}
                                className={`text-[10px] font-bold px-2 py-0.5 rounded cursor-pointer transition ${
                                  allSelected
                                    ? "bg-[#EEF4FD] text-[#3868C9]"
                                    : "bg-[#F0F2F5] text-[#667085] hover:bg-[#E5E9EF]"
                                }`}
                              >
                                {allSelected ? "All" : someSelected ? "Partial" : "None"}
                              </button>
                            </td>
                          </tr>

                          {/* Expanded Action Detail Rows */}
                          {isExpanded &&
                            module.actions.map((act) => {
                              const checked = assignedPermissions.includes(act.key);
                              return (
                                <tr key={act.key} className="bg-white hover:bg-[#F9FAFB] transition text-[11px]">
                                  <td className="py-1.5 px-4 pl-10 text-[#475467]">
                                    <div className="flex items-center gap-2">
                                      <span className="font-mono text-[#667085]">{act.key}</span>
                                      <span className="text-[#98A2B3]">·</span>
                                      <span>{act.description}</span>
                                    </div>
                                  </td>
                                  <td colSpan={6} className="py-1.5 px-3 text-right pr-6">
                                    <label className="inline-flex items-center gap-1.5 cursor-pointer">
                                      <input
                                        type="checkbox"
                                        checked={checked}
                                        onChange={() => togglePermission(act.key)}
                                        className="h-3.5 w-3.5 rounded border-[#D0D5DD] text-[#3868C9] focus:ring-[#3868C9]"
                                      />
                                      <span className="text-[11px] font-semibold text-[#344054]">
                                        {checked ? "Enabled" : "Disabled"}
                                      </span>
                                    </label>
                                  </td>
                                  <td></td>
                                </tr>
                              );
                            })}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        {/* Footer actions */}
        <div className="p-4 border-t border-[#E5E9EF] flex items-center justify-between bg-[#F8F9FA] rounded-b-2xl">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleResetToDefault}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-[#D0D5DD] hover:bg-white rounded-lg text-xs font-semibold text-[#475467] transition cursor-pointer"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Reset to Role Defaults</span>
            </button>
            <span className="text-xs text-[#667085]">
              {assignedPermissions.length} permissions granted
            </span>
            {saveSuccess && (
              <span className="text-xs font-bold text-[#16805D] animate-in fade-in">
                ✓ Saved successfully to PostgreSQL
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-[#E5E9EF] hover:bg-white rounded-lg text-xs font-semibold text-[#344054] transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving || !isDirty}
              className="inline-flex items-center gap-1.5 px-5 py-2 bg-[#3868C9] hover:bg-[#2C52A4] text-white rounded-lg text-xs font-bold transition shadow-xs cursor-pointer disabled:opacity-40"
            >
              <Save className="h-3.5 w-3.5" />
              <span>{isSaving ? "Saving..." : "Save Changes"}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
