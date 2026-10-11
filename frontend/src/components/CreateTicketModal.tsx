"use client";

import React, { useState } from "react";
import { X, Plus, Building, User, AlertTriangle } from "lucide-react";
import { Department, Room } from "@/lib/api";

interface CreateTicketModalProps {
  departments: Department[];
  rooms: Room[];
  onClose: () => void;
  onCreate: (data: {
    title: string;
    description: string;
    department_id: string;
    room_number: string;
    category: string;
    priority: string;
  }) => void;
}

export function CreateTicketModal({
  departments,
  rooms,
  onClose,
  onCreate,
}: CreateTicketModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [deptId, setDeptId] = useState(departments[0]?.id || "maintenance");
  const [roomNumber, setRoomNumber] = useState(rooms[0]?.room_number || "Room 204");
  const [category, setCategory] = useState("Ceiling Fan");
  const [priority, setPriority] = useState("medium");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    onCreate({
      title: title.trim(),
      description: description.trim() || title.trim(),
      department_id: deptId,
      room_number: roomNumber,
      category,
      priority,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-2xl max-w-lg w-full p-6 border border-[#E5E9EF] shadow-2xl space-y-4 text-xs animate-in zoom-in-95 duration-150"
      >
        <div className="flex items-center justify-between border-b pb-3 border-[#E5E9EF]">
          <div>
            <h3 className="font-bold text-base text-[#17212F]">Create New Hospital Ticket</h3>
            <p className="text-[#667085]">Manually dispatch an operational service ticket</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[#667085] hover:text-[#17212F] p-1 rounded-lg"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-1">
          <label className="font-bold text-[#17212F]">Issue Title *</label>
          <input
            required
            type="text"
            placeholder="e.g. Overhead Ceiling Fan Wobble or Water Tap Leak"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full p-2.5 rounded-lg border border-[#E5E9EF] focus:outline-none focus:border-[#176B63]"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="font-bold text-[#17212F]">Department *</label>
            <select
              value={deptId}
              onChange={(e) => setDeptId(e.target.value)}
              className="w-full p-2.5 rounded-lg border border-[#E5E9EF] capitalize"
            >
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="font-bold text-[#17212F]">Hospital Location *</label>
            <select
              value={roomNumber}
              onChange={(e) => setRoomNumber(e.target.value)}
              className="w-full p-2.5 rounded-lg border border-[#E5E9EF]"
            >
              {rooms.map((r) => (
                <option key={r.id} value={r.room_number}>
                  {r.room_number} ({r.wing})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="font-bold text-[#17212F]">Category / Fixture</label>
            <input
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="e.g. Ceiling Fan, Oxygen Valve"
              className="w-full p-2.5 rounded-lg border border-[#E5E9EF]"
            />
          </div>

          <div className="space-y-1">
            <label className="font-bold text-[#17212F]">Priority Level *</label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="w-full p-2.5 rounded-lg border border-[#E5E9EF]"
            >
              <option value="low">Low (Standard)</option>
              <option value="medium">Medium</option>
              <option value="high">High (Urgent)</option>
              <option value="critical">Critical (STAT)</option>
            </select>
          </div>
        </div>

        <div className="space-y-1">
          <label className="font-bold text-[#17212F]">Detailed Description</label>
          <textarea
            rows={3}
            placeholder="Technical details, observed symptoms, patient reports..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full p-2.5 rounded-lg border border-[#E5E9EF]"
          />
        </div>

        <div className="flex justify-end gap-2 pt-3 border-t border-[#E5E9EF]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-[#E5E9EF] hover:bg-[#F7F8FA]"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-5 py-2 rounded-xl bg-[#176B63] hover:bg-[#10574F] text-white font-bold shadow-sm"
          >
            Dispatch Ticket
          </button>
        </div>
      </form>
    </div>
  );
}
