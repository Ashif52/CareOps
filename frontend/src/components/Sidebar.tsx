"use client";

import React from "react";
import {
  LayoutDashboard,
  Ticket,
  Briefcase,
  Sparkles,
  ClockAlert,
  Building2,
  QrCode,
  BarChart3,
  ScrollText,
  Settings,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  UserCheck,
  LogOut,
  Star
} from "lucide-react";
import { User } from "@/lib/api";

interface SidebarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  currentUser: User | null;
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
  onOpenPatientPortal: () => void;
  onLogout: () => void;
}

export function Sidebar({
  currentTab,
  setCurrentTab,
  currentUser,
  collapsed,
  setCollapsed,
  onOpenPatientPortal,
  onLogout,
}: SidebarProps) {
  const userRole = currentUser?.role || "admin";

  // Role-Based Navigation Items Filtering
  const allNavItems = [
    {
      id: "overview",
      label: "Overview",
      icon: LayoutDashboard,
      roles: ["admin"],
    },
    {
      id: "tickets",
      label: userRole === "staff" ? "Department Tickets" : userRole === "supervisor" ? "Department Tickets" : "All Tickets",
      icon: Ticket,
      roles: ["admin", "supervisor", "staff"],
    },
    {
      id: "my-department",
      label: "Staff Workspace",
      icon: Briefcase,
      roles: ["admin", "supervisor", "staff"],
    },
    {
      id: "ai-verify",
      label: "AI Verification",
      icon: Sparkles,
      badge: "AI Core",
      roles: ["admin", "supervisor"],
    },
    {
      id: "sla",
      label: "SLA & Escalations",
      icon: ClockAlert,
      roles: ["admin", "supervisor"],
    },
    {
      id: "departments",
      label: userRole === "supervisor" ? "Department Team" : "Departments & Staff",
      icon: Building2,
      roles: ["admin", "supervisor"],
    },
    {
      id: "rooms",
      label: "QR Room Management",
      icon: QrCode,
      roles: ["admin"],
    },
    {
      id: "analytics",
      label: "Analytics & Reports",
      icon: BarChart3,
      roles: ["admin", "supervisor"],
    },
    {
      id: "audit",
      label: "Audit Logs",
      icon: ScrollText,
      roles: ["admin"],
    },
    {
      id: "reviews",
      label: "Reputation & Reviews",
      icon: Star,
      badge: "Google AI",
      roles: ["admin", "supervisor", "staff"],
    },
    {
      id: "settings",
      label: "Settings & System",
      icon: Settings,
      roles: ["admin"],
    },
  ];

  const navItems = allNavItems.filter(
    (item) =>
      item.roles.includes(userRole) ||
      (userRole === "superadmin" && (item.roles.includes("admin") || item.roles.includes("supervisor")))
  );

  return (
    <aside
      className={`fixed top-0 left-0 bottom-0 z-30 flex flex-col bg-white border-r border-[#E5E9EF] transition-all duration-300 ${
        collapsed ? "w-20" : "w-68"
      }`}
    >
      {/* Brand Header */}
      <div className="h-18 flex items-center justify-between px-4 border-b border-[#E5E9EF]">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="h-10 w-10 rounded-xl bg-[#176B63] flex items-center justify-center shrink-0 shadow-sm text-white">
            <ShieldCheck className="h-6 w-6" />
          </div>
          {!collapsed && (
            <div className="flex flex-col">
              <span className="font-black text-lg tracking-tight text-[#0F172A] flex items-center gap-1.5">
                CareOps <span className="text-[#176B63]">AI</span>
              </span>
              <span className="text-xs text-[#334155] tracking-wider font-black uppercase">
                {userRole === "superadmin"
                  ? "Superadmin Portal"
                  : userRole === "admin"
                  ? "Admin Portal"
                  : userRole === "supervisor"
                  ? "Supervisor View"
                  : "Staff Portal"}
              </span>
            </div>
          )}
        </div>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1.5 rounded-lg text-[#475569] hover:text-[#0F172A] hover:bg-[#E2E8F0] transition-colors cursor-pointer"
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
        </button>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 overflow-y-auto px-3.5 py-4 space-y-1.5">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setCurrentTab(item.id)}
              className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-2xl text-base font-bold transition-all group cursor-pointer ${
                isActive
                  ? "bg-[#E8F3F1] text-[#176B63] shadow-xs"
                  : "text-[#334155] hover:text-[#0F172A] hover:bg-[#F1F5F9]"
              }`}
              title={collapsed ? item.label : undefined}
            >
              <Icon
                className={`h-5.5 w-5.5 shrink-0 transition-colors ${
                  isActive ? "text-[#176B63]" : "text-[#475569] group-hover:text-[#0F172A]"
                }`}
              />
              {!collapsed && (
                <div className="flex-1 flex items-center justify-between text-left">
                  <span className="truncate">{item.label}</span>
                  {item.badge && (
                    <span className="text-xs uppercase font-black tracking-wider px-2.5 py-0.5 rounded-lg bg-[#176B63] text-white">
                      {item.badge}
                    </span>
                  )}
                </div>
              )}
            </button>
          );
        })}

        {/* Staff Notice when in Staff Role */}
        {!collapsed && userRole === "staff" && (
          <div className="p-3.5 my-3 rounded-xl bg-[#F1F5F9] border-2 border-[#CBD5E1] text-xs text-[#334155] space-y-1">
            <span className="font-extrabold text-[#0F172A] block">Staff Workspace Active</span>
            <p>Admin tools (SLA policies, QR rooms, system settings, and audit logs) are restricted to Administrator accounts.</p>
          </div>
        )}

        {/* Patient Portal Trigger (Admin Only) */}
        {userRole === "admin" && (
          <div className="pt-4 border-t-2 border-[#E2E8F0] mt-4">
            <button
              onClick={onOpenPatientPortal}
              className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-2xl text-base font-bold text-[#92400E] bg-[#FEF3C7] hover:bg-[#FDE68A] border-2 border-[#FCD34D] transition-colors ${
                collapsed ? "justify-center" : ""
              }`}
              title="Admin: Test Bedside Patient QR Flow"
            >
              <QrCode className="h-5 w-5 shrink-0" />
              {!collapsed && (
                <div className="text-left">
                  <div className="text-sm font-extrabold text-[#78350F]">Test Patient QR</div>
                  <div className="text-xs text-[#92400E] font-bold">Admin Bedside Simulator</div>
                </div>
              )}
            </button>
          </div>
        )}
      </nav>

      {/* User Account Footer */}
      <div className="p-4 border-t-2 border-[#E2E8F0] bg-[#F8FAFC]">
        <div className="flex items-center gap-3">
          <div className="relative">
            <img
              src={currentUser?.avatar_url || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150"}
              alt="Avatar"
              className="h-11 w-11 rounded-full object-cover border-2 border-[#94A3B8]"
            />
            <span className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full bg-[#16805D] ring-2 ring-white" />
          </div>
          {!collapsed && (
            <div className="flex-1 overflow-hidden">
              <div className="text-base font-black text-[#0F172A] truncate">
                {currentUser?.name || "Dr. Alistair Vance"}
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span
                  className={`text-xs uppercase font-black px-2.5 py-0.5 rounded-lg tracking-wider border-2 ${
                    userRole === "superadmin"
                      ? "bg-[#FDF2F2] text-[#DC2626] border-[#FCA5A5]"
                      : userRole === "admin"
                      ? "bg-[#E8F3F1] text-[#176B63] border-[#99F6E4]"
                      : userRole === "supervisor"
                      ? "bg-[#FEF7EC] text-[#B7791F] border-[#FAD7A0]"
                      : "bg-[#EEF4FD] text-[#3868C9] border-[#BFDBFE]"
                  }`}
                >
                  {userRole}
                </span>
                {currentUser?.department_id && (
                  <span className="text-xs text-[#334155] capitalize font-bold truncate">
                    {currentUser.department_id}
                  </span>
                )}
              </div>
            </div>
          )}
          <button
            onClick={onLogout}
            className="p-2.5 rounded-xl text-[#475569] hover:text-[#DC2626] hover:bg-[#FEE2E2] border-2 border-transparent hover:border-[#FCA5A5] transition-colors cursor-pointer"
            title="Log Out / Switch Portal"
          >
            <LogOut className="h-5.5 w-5.5" />
          </button>
        </div>
      </div>
    </aside>
  );
}
