"use client";

import React, { useState } from "react";
import {
  Search,
  Bell,
  Plus,
  Shield,
  Activity,
  UserCheck,
  CheckCircle2,
  AlertTriangle,
  LogOut,
  RefreshCw
} from "lucide-react";
import { User } from "@/lib/api";

interface HeaderProps {
  currentTab: string;
  currentUser: User | null;
  onSelectRoleUser: (email: string) => void;
  onOpenCreateModal: () => void;
  onSearch: (query: string) => void;
  onRefreshData: () => void;
  isRefreshing?: boolean;
  onLogout: () => void;
}

export function Header({
  currentTab,
  currentUser,
  onSelectRoleUser,
  onOpenCreateModal,
  onSearch,
  onRefreshData,
  isRefreshing = false,
  onLogout,
}: HeaderProps) {
  const [showRoleMenu, setShowRoleMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  const breadcrumbsMap: Record<string, string> = {
    overview: "Command Center / Operations Overview",
    tickets: "Service Tickets / Global Register",
    "my-department": "Staff Workspace / Operational Queue",
    "ai-verify": "AI Verification Center / Evidence Diagnostics",
    sla: "Escalation",
    reviews: "Reputation & Patient Experience",
    departments: "Organization / Department & Staff Directory",
    rooms: "Facilities / QR Room Point Management",
    audit: "Compliance / Immutable Audit Logs",
    settings: "System Controls & AI Model Configuration",
  };

  const demoAccounts = [
    {
      name: "System Superadmin",
      role: "Superadmin (Root)",
      email: "superadmin@careops.hospital",
      desc: "Database purge & root platform authority",
    },
    {
      name: "Dr. Alistair Vance",
      role: "Administrator",
      email: "admin@careops.hospital",
      desc: "Full hospital controls & policies",
    },
    {
      name: "Vikramaditya Rao",
      role: "Maintenance Supervisor",
      email: "supervisor.mnt@careops.hospital",
      desc: "AI review sign-offs & SLA escalations",
    },
    {
      name: "Rajesh Sharma",
      role: "Maintenance Lead (Staff)",
      email: "technician.rajesh@careops.hospital",
      desc: "Acknowledge, capture evidence & resolve",
    },
    {
      name: "Nurse Priya Nair",
      role: "Senior Staff Nurse",
      email: "nurse.priya@careops.hospital",
      desc: "Clinical & IV requests",
    },
  ];

  return (
    <header className="h-18 bg-white border-b border-[#E5E9EF] sticky top-0 z-20 flex items-center justify-between px-6 sm:px-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-3.5">
        <span className="text-base sm:text-lg font-black text-[#0F172A] tracking-wide">
          {breadcrumbsMap[currentTab] || "Operations Dashboard"}
        </span>
      </div>

      {/* Global Actions */}
      <div className="flex items-center gap-3.5">
        {/* Search */}
        <div className="relative hidden lg:block w-72">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-[#475569]" />
          <input
            type="text"
            placeholder="Search tickets, rooms, faults..."
            onChange={(e) => onSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-xl border-2 border-[#CBD5E1] bg-[#F8FAFC] text-sm font-semibold text-[#0F172A] focus:outline-none focus:border-[#176B63] focus:bg-white transition-all placeholder-[#64748B]"
          />
        </div>

        {/* Refresh button */}
        <button
          onClick={onRefreshData}
          disabled={isRefreshing}
          className="p-2.5 rounded-xl text-[#475569] hover:text-[#0F172A] hover:bg-[#F1F5F9] transition-colors cursor-pointer"
          title="Refresh Data"
        >
          <RefreshCw className={`h-5 w-5 ${isRefreshing ? "animate-spin text-[#176B63]" : ""}`} />
        </button>

        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="p-2.5 rounded-xl text-[#475569] hover:text-[#0F172A] hover:bg-[#F1F5F9] transition-colors relative cursor-pointer"
            title="Notifications"
          >
            <Bell className="h-5 w-5" />
            <span className="absolute top-1.5 right-1.5 h-2.5 w-2.5 rounded-full bg-[#DC2626]" />
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-2 w-88 bg-white rounded-2xl shadow-2xl border-2 border-[#CBD5E1] p-4 text-sm z-50">
              <div className="flex items-center justify-between pb-2.5 border-b-2 border-[#E2E8F0] mb-3 font-black text-[#0F172A]">
                <span>Operational Alerts</span>
                <span className="text-xs text-[#176B63] bg-[#E8F3F1] px-2 py-0.5 rounded-md font-black">
                  2 Pending
                </span>
              </div>
              <div className="space-y-2.5">
                <div className="p-3 rounded-xl bg-[#FEF7EC] border-2 border-[#FAD7A0]">
                  <div className="font-black text-[#B7791F] flex items-center gap-1.5 text-sm">
                    <AlertTriangle className="h-4 w-4" />
                    <span>SLA Resolution Breach</span>
                  </div>
                  <div className="text-[#334155] text-xs font-semibold mt-1">
                    Ticket TKT-MNT-1002 (Room 205 Faucet) is 35 mins overdue. Supervisor escalated.
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-[#EEF4FD] border-2 border-[#BFDBFE]">
                  <div className="font-black text-[#3868C9] flex items-center gap-1.5 text-sm">
                    <CheckCircle2 className="h-4 w-4" />
                    <span>AI Verification Complete</span>
                  </div>
                  <div className="text-[#334155] text-xs font-semibold mt-1">
                    TKT-MNT-1001 (Room 204 Fan) ready for supervisor sign-off.
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Fast Role Switcher */}
        <div className="relative">
          <button
            onClick={() => setShowRoleMenu(!showRoleMenu)}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl border-2 border-[#CBD5E1] bg-white text-sm font-bold text-[#0F172A] hover:bg-[#F8FAFC] transition-colors cursor-pointer"
          >
            <UserCheck className="h-4 w-4 text-[#176B63]" />
            <span className="hidden sm:inline">Role:</span>
            <span
              className={`font-black capitalize ${
                currentUser?.role === "superadmin" ? "text-[#DC2626]" : "text-[#176B63]"
              }`}
            >
              {currentUser?.role === "superadmin" ? "Superadmin (Root)" : currentUser?.role || "Admin"}
            </span>
          </button>

          {showRoleMenu && (
            <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-2xl border-2 border-[#CBD5E1] p-3 text-sm z-50">
              <div className="px-2 py-1 text-xs font-black text-[#475569] uppercase tracking-wider">
                Simulate Role Workspace
              </div>
              <div className="space-y-1.5 mt-1.5">
                {demoAccounts.map((acc) => (
                  <button
                    key={acc.email}
                    onClick={() => {
                      onSelectRoleUser(acc.email);
                      setShowRoleMenu(false);
                    }}
                    className={`w-full text-left p-2.5 rounded-xl transition-colors flex flex-col ${
                      currentUser?.email === acc.email
                        ? "bg-[#E8F3F1] text-[#176B63]"
                        : "hover:bg-[#F1F5F9] text-[#0F172A]"
                    }`}
                  >
                    <div className="flex items-center justify-between font-black text-sm">
                      <span>{acc.name}</span>
                      <span className="text-xs uppercase font-black text-[#475569]">
                        {acc.role.split(" ")[0]}
                      </span>
                    </div>
                    <span className="text-xs text-[#475569] font-medium mt-0.5">{acc.desc}</span>
                  </button>
                ))}

                <div className="pt-2 border-t-2 border-[#E2E8F0] mt-1.5">
                  <button
                    onClick={() => {
                      setShowRoleMenu(false);
                      onLogout();
                    }}
                    className="w-full text-left p-2.5 rounded-xl hover:bg-[#FEE2E2] text-[#DC2626] font-black flex items-center justify-between transition-colors cursor-pointer"
                  >
                    <span>Switch Portal / Log Out</span>
                    <LogOut className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Create Ticket Action */}
        <button
          onClick={onOpenCreateModal}
          className="flex items-center gap-2 px-4.5 py-2.5 rounded-xl bg-[#176B63] hover:bg-[#10574F] text-white text-sm sm:text-base font-black shadow-md shadow-[#176B63]/25 transition-all cursor-pointer"
        >
          <Plus className="h-5 w-5" />
          <span>New Ticket</span>
        </button>
      </div>
    </header>
  );
}
