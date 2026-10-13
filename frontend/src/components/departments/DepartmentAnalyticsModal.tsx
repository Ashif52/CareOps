"use client";

import React, { useState, useEffect } from "react";
import {
  Building2,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Users,
  TrendingUp,
  X,
  Phone,
  BarChart3,
  RefreshCw,
  ShieldCheck
} from "lucide-react";
import { api } from "@/lib/api";

interface DepartmentAnalyticsModalProps {
  departmentId: string | null;
  onClose: () => void;
}

export function DepartmentAnalyticsModal({ departmentId, onClose }: DepartmentAnalyticsModalProps) {
  const [data, setData] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!departmentId) return;

    const loadAnalytics = async () => {
      setIsLoading(true);
      try {
        const res: any = await api.getDepartmentAnalytics(departmentId);
        setData(res);
      } catch (err: any) {
        console.error("Failed to load department analytics:", err);
      } finally {
        setIsLoading(false);
      }
    };

    loadAnalytics();
  }, [departmentId]);

  if (!departmentId) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
      <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col border border-[#E5E9EF] shadow-2xl animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-5 border-b border-[#E5E9EF] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-[#EEF4FD] rounded-xl text-[#3868C9]">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-[#17212F]">
                  {data?.department_name || "Department"} Performance Analytics
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-[#EEF4FD] text-[#3868C9] font-mono text-[10px] font-bold">
                  {data?.department_code || departmentId.toUpperCase()}
                </span>
                {data?.is_demo_data && (
                  <span className="px-2 py-0.5 rounded-full bg-[#FEF7EC] text-[#B54708] text-[10px] font-bold">
                    Demo Data
                  </span>
                )}
              </div>
              <p className="text-xs text-[#667085] mt-0.5">
                Supervisor: <strong className="text-[#17212F]">{data?.supervisor_name || "Assigned Lead"}</strong> &bull; Live database operational telemetry
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

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {isLoading ? (
            <div className="py-16 text-center text-xs text-[#667085]">
              Loading department telemetry metrics...
            </div>
          ) : data ? (
            <>
              {/* 4 Stat Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="p-3.5 bg-[#F8F9FA] rounded-xl border border-[#E5E9EF]">
                  <span className="text-[#667085] block mb-1">Total Service Orders</span>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-xl font-bold text-[#17212F]">{data.total_tickets}</span>
                    <span className="text-[11px] text-[#667085]">tickets</span>
                  </div>
                  <span className="text-[10px] text-[#667085] mt-1 block">
                    {data.open_tickets} active &bull; {data.completed_tickets} resolved
                  </span>
                </div>

                <div className="p-3.5 bg-[#F8F9FA] rounded-xl border border-[#E5E9EF]">
                  <span className="text-[#667085] block mb-1">Overdue / SLA Risk</span>
                  <div className="flex items-baseline gap-1.5">
                    <span className={`text-xl font-bold ${data.overdue_tickets > 0 ? "text-[#DC2626]" : "text-[#16805D]"}`}>
                      {data.overdue_tickets}
                    </span>
                    <span className="text-[11px] text-[#667085]">breached</span>
                  </div>
                  <span className="text-[10px] text-[#667085] mt-1 block">
                    SLA Compliance: <strong className="text-[#17212F]">{data.sla_compliance_percentage}%</strong>
                  </span>
                </div>

                <div className="p-3.5 bg-[#F8F9FA] rounded-xl border border-[#E5E9EF]">
                  <span className="text-[#667085] block mb-1">Avg Acknowledgement</span>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-xl font-bold text-[#3868C9]">{data.avg_acknowledgement_minutes}</span>
                    <span className="text-[11px] text-[#667085]">mins</span>
                  </div>
                  <span className="text-[10px] text-[#667085] mt-1 block">From complaint scan</span>
                </div>

                <div className="p-3.5 bg-[#F8F9FA] rounded-xl border border-[#E5E9EF]">
                  <span className="text-[#667085] block mb-1">Avg Resolution Time</span>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-xl font-bold text-[#16805D]">{data.avg_resolution_minutes}</span>
                    <span className="text-[11px] text-[#667085]">mins</span>
                  </div>
                  <span className="text-[10px] text-[#667085] mt-1 block">Door-to-door completion</span>
                </div>
              </div>

              {/* Workload Distribution Across Assigned Staff */}
              <div className="bg-white rounded-xl border border-[#E5E9EF] p-4 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-[#3868C9]" />
                    <h3 className="text-xs font-bold text-[#17212F]">
                      Staff Workload Distribution & Direct Dispatch ({data.staff_workload?.length || 0} Technicians)
                    </h3>
                  </div>
                  <span className="text-[11px] text-[#667085]">
                    Click phone to call staff directly
                  </span>
                </div>

                {data.staff_workload?.length === 0 ? (
                  <div className="py-6 text-center text-xs text-[#667085]">
                    No staff members currently assigned to this department.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                    {data.staff_workload.map((staff: any) => (
                      <div
                        key={staff.staff_id}
                        className="p-3 bg-[#F8F9FA] rounded-xl border border-[#E5E9EF] text-xs flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <p className="font-bold text-[#17212F] truncate">{staff.staff_name}</p>
                          <span className="text-[11px] text-[#667085] block">{staff.designation}</span>
                          <span className="text-[10px] text-[#3868C9] font-medium block mt-0.5">
                            {staff.active_tickets} active &bull; {staff.completed_tickets} done
                          </span>
                        </div>

                        {staff.phone ? (
                          <a
                            href={`tel:${staff.phone}`}
                            className="p-2 rounded-lg bg-[#EEF4FD] hover:bg-[#DCE7FB] text-[#3868C9] transition shrink-0 cursor-pointer"
                            title={`Call ${staff.staff_name} (${staff.phone})`}
                          >
                            <Phone className="h-3.5 w-3.5" />
                          </a>
                        ) : (
                          <span className="text-[10px] text-[#98A2B3]">No phone</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Categories & 7-Day Performance */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Categories */}
                <div className="bg-white rounded-xl border border-[#E5E9EF] p-4 shadow-xs space-y-2.5">
                  <h3 className="text-xs font-bold text-[#17212F]">Complaint Categories</h3>
                  <div className="space-y-1.5">
                    {data.categories_breakdown?.map((cat: any) => (
                      <div key={cat.category} className="flex items-center justify-between text-xs py-1 border-b border-[#F2F4F7]">
                        <span className="text-[#475467]">{cat.category}</span>
                        <span className="font-mono font-bold text-[#17212F] bg-[#F0F2F5] px-2 py-0.5 rounded">
                          {cat.count}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 7-Day Trend */}
                <div className="bg-white rounded-xl border border-[#E5E9EF] p-4 shadow-xs space-y-2.5">
                  <h3 className="text-xs font-bold text-[#17212F]">7-Day Volume Trend</h3>
                  <div className="space-y-1.5">
                    {data.performance_trend?.map((pt: any) => (
                      <div key={pt.date} className="flex items-center justify-between text-xs py-1 border-b border-[#F2F4F7]">
                        <span className="font-mono text-[#667085]">{pt.date}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-[#3868C9] font-mono font-semibold">+{pt.created} new</span>
                          <span className="text-[#16805D] font-mono font-semibold">✓ {pt.resolved} resolved</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          ) : null}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#E5E9EF] flex items-center justify-end bg-[#F8F9FA] rounded-b-2xl">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-[#17212F] hover:bg-[#253243] text-white rounded-lg text-xs font-semibold transition cursor-pointer"
          >
            Close Analytics View
          </button>
        </div>
      </div>
    </div>
  );
}
