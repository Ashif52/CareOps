"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  Shield,
  ShieldCheck,
  Lock,
  CheckCircle2,
  AlertTriangle,
  Info
} from "lucide-react";
import { RoleMetadata, api } from "@/lib/api";

interface RolesManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function RolesManagementModal({
  isOpen,
  onClose,
}: RolesManagementModalProps) {
  const [roles, setRoles] = useState<RoleMetadata[]>([]);
  const [selectedRole, setSelectedRole] = useState<RoleMetadata | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      loadRoles();
    }
  }, [isOpen]);

  const loadRoles = async () => {
    setIsLoading(true);
    try {
      const data = await api.getRolesMetadata();
      setRoles(data);
      if (data.length > 0) {
        setSelectedRole(data[0]);
      }
    } catch (err) {
      console.error("Failed to load roles metadata", err);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 sm:p-6">
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity"
      />

      <div className="relative w-full max-w-4xl bg-white rounded-3xl shadow-2xl border-2 border-[#CBD5E1] overflow-hidden z-10 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-6 border-b-2 border-[#E2E8F0] bg-[#F8FAFC] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-[#176B63] text-white shadow-sm">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-xl font-black text-[#0F172A]">Hospital Role-Based Access Control (RBAC)</h2>
              <p className="text-xs font-semibold text-[#475569]">
                Hierarchical role permissions, protected system privileges, and healthcare workflow boundaries
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-[#64748B] hover:text-[#0F172A] hover:bg-[#E2E8F0] transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content Body: Master / Detail Split */}
        <div className="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-3 divide-y-2 md:divide-y-0 md:divide-x-2 divide-[#E2E8F0]">
          {/* Left Column: Role List */}
          <div className="p-4 overflow-y-auto space-y-2 bg-[#F8FAFC]">
            <h3 className="text-xs font-black uppercase tracking-wider text-[#475569] px-2 mb-2">
              Hospital Roles ({roles.length})
            </h3>
            {isLoading ? (
              <div className="p-4 text-xs font-bold text-[#64748B] text-center">Loading roles...</div>
            ) : (
              roles.map((r) => (
                <button
                  key={r.id}
                  onClick={() => setSelectedRole(r)}
                  className={`w-full text-left p-3.5 rounded-2xl transition-all cursor-pointer flex items-center justify-between border-2 ${
                    selectedRole?.id === r.id
                      ? "bg-white border-[#176B63] shadow-sm text-[#0F172A]"
                      : "bg-white/60 hover:bg-white border-transparent text-[#334155]"
                  }`}
                >
                  <div>
                    <div className="font-black text-sm">{r.name}</div>
                    <div className="text-xs font-mono font-bold text-[#176B63]">{r.id}</div>
                  </div>
                  <span className="text-xs font-black px-2 py-0.5 rounded-md bg-[#F1F5F9] text-[#475569]">
                    {r.permission_count} perms
                  </span>
                </button>
              ))
            )}
          </div>

          {/* Right Column: Role Details & Permissions */}
          <div className="md:col-span-2 p-6 overflow-y-auto space-y-5 bg-white">
            {selectedRole ? (
              <>
                <div className="border-b-2 border-[#E2E8F0] pb-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-black text-[#0F172A] flex items-center gap-2">
                      <Shield className="h-5 w-5 text-[#176B63]" />
                      <span>{selectedRole.name}</span>
                    </h3>
                    {selectedRole.protected_system_role && (
                      <span className="text-xs font-black px-2.5 py-1 rounded-lg bg-[#FEF3C7] text-[#92400E] border border-[#FCD34D] flex items-center gap-1">
                        <Lock className="h-3 w-3" /> Protected System Role
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-semibold text-[#334155] mt-2">
                    {selectedRole.description}
                  </p>
                </div>

                <div className="space-y-3">
                  <h4 className="text-sm font-black text-[#0F172A] flex items-center justify-between">
                    <span>Enforced Granular Permissions</span>
                    <span className="text-xs font-bold text-[#176B63] bg-[#E8F3F1] px-2.5 py-0.5 rounded-full">
                      {selectedRole.permissions.length} active
                    </span>
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {selectedRole.permissions.map((p) => (
                      <div
                        key={p}
                        className="p-3 rounded-xl bg-[#F8FAFC] border-2 border-[#E2E8F0] flex items-center gap-2.5 text-xs"
                      >
                        <CheckCircle2 className="h-4 w-4 text-[#16805D] shrink-0" />
                        <span className="font-mono font-black text-[#0F172A]">{p}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-[#EEF4FD] border-2 border-[#BFDBFE] text-xs font-semibold text-[#1E3A8A] flex items-start gap-2.5">
                  <Info className="h-4 w-4 shrink-0 text-[#2563EB] mt-0.5" />
                  <div>
                    <strong>Healthcare Boundary Enforcement:</strong> Backend API routes check and enforce permissions on each operation. Non-admin roles (e.g. IT Admin) are strictly denied clinical data access by default.
                  </div>
                </div>
              </>
            ) : (
              <div className="p-8 text-center text-sm font-bold text-[#64748B]">
                Select a role to inspect permissions
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t-2 border-[#E2E8F0] bg-[#F8FAFC] flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-[#0F172A] hover:bg-[#1E293B] text-white text-sm font-bold cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
