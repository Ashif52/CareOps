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
  Lock,
  Database,
  HeartHandshake,
  Star,
  LogOut
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

  // Strict Role-Based Navigation Items (Super Admin strictly separated from operational tabs)
  let navItems: {
    id: string;
    label: string;
    icon: any;
    badge?: string;
  }[] = [];

  if (userRole === "superadmin") {
    navItems = [
      {
        id: "superadmin-admins",
        label: "Admin Accounts",
        icon: UserCheck,
      },
      {
        id: "superadmin-security",
        label: "Security Settings",
        icon: Lock,
      },
      {
        id: "superadmin-audit",
        label: "Superadmin Audit",
        icon: ScrollText,
      },
      {
        id: "superadmin-maintenance",
        label: "Database Maintenance",
        icon: Database,
        badge: "Root",
      },
    ];
  } else if (userRole === "admin") {
    navItems = [
      { id: "overview", label: "Overview", icon: LayoutDashboard },
      { id: "tickets", label: "All Tickets", icon: Ticket },
      { id: "my-department", label: "Staff Workspace", icon: Briefcase },
      { id: "ai-verify", label: "AI Verification", icon: Sparkles, badge: "AI Core" },
      { id: "sla", label: "Escalation & SLA", icon: ClockAlert },
      { id: "departments", label: "Departments & Staff", icon: Building2 },
      { id: "rooms", label: "QR Room Ops", icon: QrCode },
      { id: "analytics", label: "Analytics & Reports", icon: BarChart3 },
      { id: "nps", label: "NPS & Patient Voice", icon: HeartHandshake, badge: "Patient" },
      { id: "reviews", label: "Google Reputation", icon: Star, badge: "Google AI" },
      { id: "audit", label: "Audit Logs", icon: ScrollText },
      { id: "settings", label: "Settings & System", icon: Settings },
    ];
  } else if (userRole === "supervisor") {
    navItems = [
      { id: "tickets", label: "Department Tickets", icon: Ticket },
      { id: "my-department", label: "Supervisor Workspace", icon: Briefcase },
      { id: "departments", label: "My Team & Staff", icon: Building2 },
      { id: "ai-verify", label: "AI Verification", icon: Sparkles },
      { id: "sla", label: "Escalations", icon: ClockAlert },
      { id: "analytics", label: "Department Analytics", icon: BarChart3 },
      { id: "nps", label: "Patient Experience", icon: HeartHandshake },
      { id: "reviews", label: "Google Reviews", icon: Star },
    ];
  } else {
    // Staff
    navItems = [
      { id: "tickets", label: "Assigned Tickets", icon: Ticket },
      { id: "my-department", label: "My Tasks & Evidence", icon: Briefcase },
      { id: "reviews", label: "Patient Feedback", icon: Star },
    ];
  }

  return (
    <aside
      className={`fixed top-0 left-0 bottom-0 z-30 flex flex-col bg-white border-r border-[#E5E9EF] transition-all duration-300 ${
        collapsed ? "w-18" : "w-64"
      }`}
    >
      {/* Brand Header */}
      <div className="h-15 flex items-center justify-between px-3.5 border-b border-[#E5E9EF]">
        <div className="flex items-center gap-2.5 overflow-hidden">
          <div className="h-8.5 w-8.5 rounded-lg bg-[#176B63] flex items-center justify-center shrink-0 shadow-sm text-white">
            <ShieldCheck className="h-5 w-5" />
          </div>
          {!collapsed && (
            <div className="flex flex-col">
              <span className="font-extrabold text-base tracking-tight text-[#0F172A] flex items-center gap-1">
                CareOps <span className="text-[#176B63]">AI</span>
              </span>
              <span className="text-[10px] text-[#475569] tracking-wider font-extrabold uppercase">
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
          className="p-1 rounded-lg text-[#475569] hover:text-[#0F172A] hover:bg-[#E2E8F0] transition-colors cursor-pointer"
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronRight className="h-4.5 w-4.5" /> : <ChevronLeft className="h-4.5 w-4.5" />}
        </button>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 overflow-y-auto px-2.5 py-3 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setCurrentTab(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-semibold transition-all group cursor-pointer ${
                isActive
                  ? "bg-[#E8F3F1] text-[#176B63] shadow-xs"
                  : "text-[#334155] hover:text-[#0F172A] hover:bg-[#F1F5F9]"
              }`}
              title={collapsed ? item.label : undefined}
            >
              <Icon
                className={`h-4.5 w-4.5 shrink-0 transition-colors ${
                  isActive ? "text-[#176B63]" : "text-[#475569] group-hover:text-[#0F172A]"
                }`}
              />
              {!collapsed && (
                <div className="flex-1 flex items-center justify-between text-left">
                  <span className="truncate">{item.label}</span>
                  {item.badge && (
                    <span className="text-[10px] uppercase font-black tracking-wider px-2 py-0.5 rounded-md bg-[#176B63] text-white">
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
          <div className="p-3 my-2.5 rounded-lg bg-[#F1F5F9] border border-[#CBD5E1] text-xs text-[#334155] space-y-1">
            <span className="font-extrabold text-[#0F172A] block">Staff Workspace Active</span>
            <p className="text-[11px] leading-relaxed">Admin tools (SLA policies, QR rooms, system settings, and audit logs) are restricted to Administrator accounts.</p>
          </div>
        )}

        {/* Patient Portal Trigger (Admin Only) */}
        {userRole === "admin" && (
          <div className="pt-3 border-t border-[#E2E8F0] mt-3">
            <button
              onClick={onOpenPatientPortal}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-[#92400E] bg-[#FEF3C7] hover:bg-[#FDE68A] border border-[#FCD34D] transition-colors ${
                collapsed ? "justify-center" : ""
              }`}
              title="Admin: Test Bedside Patient QR Flow"
            >
              <QrCode className="h-4 w-4 shrink-0" />
              {!collapsed && (
                <div className="text-left">
                  <div className="text-xs font-extrabold text-[#78350F]">Test Patient QR</div>
                  <div className="text-[10px] text-[#92400E] font-medium">Admin Bedside Simulator</div>
                </div>
              )}
            </button>
          </div>
        )}
      </nav>

      {/* User Account Footer */}
      <div className="p-3 border-t border-[#E2E8F0] bg-[#F8FAFC]">
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <img
              src={currentUser?.avatar_url || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150"}
              alt="Avatar"
              className="h-8.5 w-8.5 rounded-full object-cover border border-[#94A3B8]"
            />
            <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-[#16805D] ring-2 ring-white" />
          </div>
          {!collapsed && (
            <div className="flex-1 overflow-hidden">
              <div className="text-xs font-black text-[#0F172A] truncate">
                {currentUser?.name || "Dr. Alistair Vance"}
              </div>
              <div className="flex items-center gap-1 mt-0.5">
                <span
                  className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded tracking-wider border ${
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
                  <span className="text-[10px] text-[#475569] capitalize font-medium truncate">
                    {currentUser.department_id}
                  </span>
                )}
              </div>
            </div>
          )}
          <button
            onClick={onLogout}
            className="p-1.5 rounded-lg text-[#475569] hover:text-[#DC2626] hover:bg-[#FEE2E2] transition-colors cursor-pointer"
            title="Log Out / Switch Portal"
          >
            <LogOut className="h-4.5 w-4.5" />
          </button>
        </div>
      </div>
    </aside>
  );
}
