"use client";

import React, { useState } from "react";
import { X, ClipboardList, CheckCircle2, AlertTriangle, Calendar, Building2, User } from "lucide-react";
import { GoogleReview, api } from "@/lib/api";

interface CreateCAPModalProps {
  review: GoogleReview;
  onClose: () => void;
  onSuccess: () => void;
}

export function CreateCAPModal({ review, onClose, onSuccess }: CreateCAPModalProps) {
  const [title, setTitle] = useState(
    review.ai_analysis?.review_summary
      ? `CAP: ${review.ai_analysis.review_summary.slice(0, 60)}...`
      : `Resolve ${review.star_rating}★ Complaint from ${review.reviewer_name}`
  );
  const [description, setDescription] = useState(
    `Addressing Google Review #${review.id} (${review.star_rating} Stars) by ${review.reviewer_name}.\n\nReview Text: "${review.review_text || 'No text provided'}"`
  );
  const [departmentId, setDepartmentId] = useState(
    review.ai_analysis?.suggested_department || "General Administration"
  );
  const [priority, setPriority] = useState(
    review.star_rating === 1 ? "urgent" : review.star_rating === 2 ? "high" : "medium"
  );
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 3);
    return d.toISOString().split("T")[0];
  });
  const [rootCause, setRootCause] = useState(
    review.ai_analysis?.possible_root_causes?.join("; ") || ""
  );
  const [correctiveAction, setCorrectiveAction] = useState(
    review.ai_analysis?.recommended_actions?.join("; ") || ""
  );
  const [preventiveAction, setPreventiveAction] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      alert("Please enter a CAP task title.");
      return;
    }
    setIsSubmitting(true);
    try {
      await api.createCorrectiveAction({
        review_id: review.id,
        title,
        description,
        department_id: departmentId,
        priority,
        due_date: dueDate,
        root_cause_assessment: rootCause,
        corrective_action: correctiveAction,
        preventive_action: preventiveAction,
      });
      alert("Corrective Action Task successfully created and assigned!");
      onSuccess();
      onClose();
    } catch (err: any) {
      alert(`Failed to create CAP task: ${err.message || err}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-8 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-600">
              <ClipboardList className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Create Corrective Action Plan (CAP)
              </h3>
              <p className="text-xs text-slate-500">
                Linking official operational remediation task to Google Review #{review.id}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4 flex-1 text-xs">
          <div>
            <label className="font-bold text-slate-700 block mb-1">CAP Task Title *</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full p-2.5 rounded-lg border border-slate-200 focus:outline-none focus:border-indigo-500 font-medium"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="font-bold text-slate-700 block mb-1">Target Department</label>
              <select
                value={departmentId}
                onChange={(e) => setDepartmentId(e.target.value)}
                className="w-full p-2.5 rounded-lg border border-slate-200 focus:outline-none focus:border-indigo-500 bg-white"
              >
                <option value="Nursing">Nursing</option>
                <option value="Doctor Communication">Medical Staff</option>
                <option value="Housekeeping">Housekeeping</option>
                <option value="Maintenance">Maintenance</option>
                <option value="Billing">Billing & Insurance</option>
                <option value="Pharmacy">Pharmacy</option>
                <option value="General Administration">General Administration</option>
                <option value="Security">Security & Facilities</option>
              </select>
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="w-full p-2.5 rounded-lg border border-slate-200 focus:outline-none focus:border-indigo-500 bg-white font-semibold"
              >
                <option value="urgent">Urgent (SLA 24h)</option>
                <option value="high">High (SLA 48h)</option>
                <option value="medium">Medium (SLA 5d)</option>
                <option value="low">Low (Standard)</option>
              </select>
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Due Date</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full p-2.5 rounded-lg border border-slate-200 focus:outline-none focus:border-indigo-500 bg-white"
              />
            </div>
          </div>

          <div>
            <label className="font-bold text-slate-700 block mb-1">Root Cause Assessment</label>
            <textarea
              rows={2}
              value={rootCause}
              onChange={(e) => setRootCause(e.target.value)}
              placeholder="What systemic, operational, or communication failure produced this issue?"
              className="w-full p-2.5 rounded-lg border border-slate-200 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="font-bold text-slate-700 block mb-1">Immediate Corrective Action</label>
            <textarea
              rows={2}
              value={correctiveAction}
              onChange={(e) => setCorrectiveAction(e.target.value)}
              placeholder="Actions to resolve the immediate breakdown or patient concern..."
              className="w-full p-2.5 rounded-lg border border-slate-200 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="font-bold text-slate-700 block mb-1">Systemic Preventive Action</label>
            <textarea
              rows={2}
              value={preventiveAction}
              onChange={(e) => setPreventiveAction(e.target.value)}
              placeholder="Process improvement, staff retraining, or policy update to eliminate recurrence..."
              className="w-full p-2.5 rounded-lg border border-slate-200 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-[11px] text-slate-500 leading-relaxed">
            <strong>Audit Guarantee:</strong> Completing this task tracks internal resolution compliance and SLA metrics. In accordance with Google Business Profile API policies, internal CAP actions never modify or falsify the original public review.
          </div>

          {/* Footer controls */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <CheckCircle2 className="h-4 w-4" />
              <span>{isSubmitting ? "Creating CAP Task..." : "Create Corrective Action"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
