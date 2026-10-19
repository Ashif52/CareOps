"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Wrench,
  Stethoscope,
  HeartPulse,
  Sparkles,
  Receipt,
  Pill,
  Mic,
  MicOff,
  Square,
  Play,
  RotateCcw,
  Camera,
  CheckCircle2,
  ChevronLeft,
  ArrowRight,
  ShieldCheck,
  Building,
  Clock,
  Send,
  X,
  QrCode,
  AlertTriangle,
  Flame,
  Fan,
  Droplets,
  Utensils,
  HelpCircle,
  Phone,
  UserCheck,
  Lock,
  ExternalLink,
  RefreshCw,
  Pause,
  Trash2,
  Volume2,
  MessageSquare,
  ThumbsUp,
  Star
} from "lucide-react";
import { api, formatTime } from "@/lib/api";
import { RoomQRPlacardModal } from "@/components/RoomQRPlacardModal";

interface PatientPortalProps {
  onClose?: () => void;
  initialRoomToken?: string;
  allRooms?: any[];
}

interface RoomData {
  hospital_name?: string;
  room_number: string;
  floor: string;
  wing: string;
  token: string;
  is_active: boolean;
  departments?: any[];
}

export function PatientPortal({ onClose, initialRoomToken, allRooms }: PatientPortalProps) {
  const currentToken = initialRoomToken || "CARE-RM204-7X9Q";

  // State: QR Resolution & Validation
  const [roomData, setRoomData] = useState<RoomData | null>(null);
  const [isValidatingQR, setIsValidatingQR] = useState(true);
  const [qrError, setQrError] = useState<string | null>(null);

  // Flow Step: "categories" -> "form" -> "confirmation" (No guest or OTP screens; mobile is required on form)
  const [step, setStep] = useState<"categories" | "form" | "confirmation">("categories");

  // Helper functions for E.164 phone normalization and validation
  const normalizeE164 = (phone: string): string => {
    const cleaned = phone.replace(/[\s\-\(\)]/g, "");
    if (!cleaned) return "";
    if (cleaned.startsWith("+")) return cleaned;
    if (cleaned.length === 10) return `+1${cleaned}`;
    return `+${cleaned}`;
  };

  const isValidPhone = (phone: string): boolean => {
    const cleaned = phone.replace(/[\s\-\(\)]/g, "");
    return /^\+?[1-9]\d{7,14}$/.test(cleaned);
  };

  // Form Fields
  const [selectedDept, setSelectedDept] = useState<string>("maintenance");
  const [categoryName, setCategoryName] = useState<string>("Lighting / Electrical");
  const [title, setTitle] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [patientContact, setPatientContact] = useState<string>("");
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  // Audio Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [recordedDuration, setRecordedDuration] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioBase64, setAudioBase64] = useState<string | null>(null);
  const [transcription, setTranscription] = useState<string>("");
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackTime, setPlaybackTime] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const recordingStartTimeRef = useRef<number>(0);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const initialOffsetRef = useRef<number>(0);

  const formatAudioDuration = (totalSeconds: number) => {
    if (isNaN(totalSeconds) || totalSeconds < 0) return "0:00";
    const mins = Math.floor(totalSeconds / 60);
    const secs = Math.floor(totalSeconds % 60);
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  // Submission & Tracking State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState<string>("");
  const [submittedTicket, setSubmittedTicket] = useState<{
    id?: number;
    ticket_number: string;
    department: string;
    status: string;
    room_number: string;
    category?: string;
    created_at: string;
    friendly_status?: string;
    acknowledged_at?: string | null;
    in_progress_at?: string | null;
    work_started_at?: string | null;
    work_completed_at?: string | null;
    closed_at?: string | null;
    estimated_arrival_minutes?: number | null;
    tracking_url?: string;
    tracking_token?: string;
    resolution_summary?: string | null;
    assigned_staff_name?: string | null;
    assigned_staff_designation?: string | null;
    assigned_staff_avatar?: string | null;
    ready_for_feedback?: boolean;
    is_eligible_for_feedback?: boolean;
  } | null>(null);

  // Patient Experience Feedback State on Bedside Screen
  const [selectedEmoji, setSelectedEmoji] = useState<"happy" | "okay" | "unhappy" | null>(null);
  const [npsScore, setNpsScore] = useState<number | null>(null);
  const [feedbackComment, setFeedbackComment] = useState("");
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);

  const [showQRModal, setShowQRModal] = useState(false);

  // 1. Resolve & Validate Room QR on Mount
  useEffect(() => {
    let isMounted = true;
    const validateQR = async () => {
      setIsValidatingQR(true);
      setQrError(null);
      try {
        const data = await api.getRoomByToken(currentToken);
        if (isMounted) {
          setRoomData(data);
        }
      } catch (err: any) {
        if (isMounted) {
          setQrError(err.message || "Failed to resolve room from QR token.");
        }
      } finally {
        if (isMounted) {
          setIsValidatingQR(false);
        }
      }
    };

    validateQR();
    // Initialize idempotency key for this session
    setIdempotencyKey(`idem-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`);

    return () => {
      isMounted = false;
    };
  }, [currentToken]);

  // 2. Real-Time Tracking for Submitted Ticket (SSE + Polling Fallback)
  useEffect(() => {
    if (!submittedTicket?.ticket_number) return;

    const ticketNum = submittedTicket.ticket_number;
    let sse: EventSource | null = null;

    const refreshTicketStatus = async () => {
      try {
        const live = await api.getPatientTicketStatus(ticketNum);
        setSubmittedTicket((prev) =>
          prev
            ? {
                ...prev,
                id: live.id || prev.id,
                status: live.status,
                friendly_status: live.friendly_status,
                acknowledged_at: live.acknowledged_at,
                in_progress_at: live.in_progress_at,
                work_started_at: live.work_started_at,
                work_completed_at: live.work_completed_at,
                closed_at: live.closed_at,
                estimated_arrival_minutes: live.estimated_arrival_minutes,
                resolution_summary: live.resolution_summary,
                assigned_staff_name: live.assigned_staff_name,
                assigned_staff_designation: live.assigned_staff_designation,
                assigned_staff_avatar: live.assigned_staff_avatar,
                ready_for_feedback: live.ready_for_feedback || live.is_eligible_for_feedback,
                is_eligible_for_feedback: live.is_eligible_for_feedback,
              }
            : null
        );
      } catch (_) {}
    };

    try {
      const sseUrl = api.getPatientStreamUrl(ticketNum);
      sse = new EventSource(sseUrl);

      sse.onmessage = (e) => {
        try {
          const payload = JSON.parse(e.data);
          if (payload.event === "ticket_updated") {
            refreshTicketStatus();
          }
        } catch (_) {}
      };

      sse.addEventListener("ticket_updated", () => {
        refreshTicketStatus();
      });
    } catch (_) {}

    const interval = setInterval(refreshTicketStatus, 4000);

    return () => {
      clearInterval(interval);
      if (sse) sse.close();
    };
  }, [submittedTicket?.ticket_number]);

  // Service Request Categories (Canonical Departments: Maintenance, Housekeeping, Linen, Medical, IT)
  const categories = [
    {
      id: "maint-electrical",
      deptId: "maintenance",
      deptName: "Maintenance",
      name: "Electrical & Lighting",
      icon: Sparkles,
      description: "Lights flickering, reading lamp, switches, bed power outlets",
      color: "border-[#176B63] hover:bg-[#E8F3F1]/40",
      accent: "text-[#176B63] bg-[#E8F3F1]",
      defaultItems: ["Reading Lamp / Lighting", "Bed Electrical Socket", "Switches", "General Power"],
    },
    {
      id: "maint-climate",
      deptId: "maintenance",
      deptName: "Maintenance",
      name: "Air Conditioning & Climate",
      icon: Fan,
      description: "Room too cold, AC not cooling, fan noise, airflow adjustment",
      color: "border-[#2563EB] hover:bg-[#EFF6FF]/40",
      accent: "text-[#2563EB] bg-[#EFF6FF]",
      defaultItems: ["Room Too Cold", "AC Not Cooling", "Fan Noise", "Thermostat Adjustment"],
    },
    {
      id: "maint-plumbing",
      deptId: "maintenance",
      deptName: "Maintenance",
      name: "Plumbing & Restroom",
      icon: Droplets,
      description: "Tap leak, flush issue, hot water supply, shower pressure, clogged drain",
      color: "border-[#0891B2] hover:bg-[#ECFEFF]/40",
      accent: "text-[#0891B2] bg-[#ECFEFF]",
      defaultItems: ["Tap Leak", "Hot Water Supply", "Toilet Flush", "Clogged Drain"],
    },
    {
      id: "maint-general",
      deptId: "maintenance",
      deptName: "Maintenance",
      name: "General Maintenance",
      icon: Wrench,
      description: "Door latch, window blinds, motorized bed frame, room fixtures",
      color: "border-[#475569] hover:bg-[#F8FAFC]/40",
      accent: "text-[#475569] bg-[#F8FAFC]",
      defaultItems: ["Door Latch / Lock", "Window Blinds", "Motorized Bed Frame", "Furniture Repair"],
    },
    {
      id: "housekeeping-cleaning",
      deptId: "housekeeping",
      deptName: "Housekeeping",
      name: "Housekeeping & Room Sanitization",
      icon: Sparkles,
      description: "Floor mopping, dust clearance, bathroom sanitization, waste clearance",
      color: "border-[#D97706] hover:bg-[#FFFBEB]/40",
      accent: "text-[#D97706] bg-[#FFFBEB]",
      defaultItems: ["Floor Mopping / Spill", "Bathroom Sanitization", "Trash Bin Clearance", "Spill Clean-up"],
    },
    {
      id: "linen-change",
      deptId: "linen",
      deptName: "Linen",
      name: "Linen & Bedding",
      icon: Sparkles,
      description: "Fresh bed sheets, extra warm blanket, pillow change, clean patient gown",
      color: "border-[#7C3AED] hover:bg-[#F5F3FF]/40",
      accent: "text-[#7C3AED] bg-[#F5F3FF]",
      defaultItems: ["Fresh Bed Sheets", "Extra Warm Blanket", "Pillow Change", "Clean Patient Gown"],
    },
    {
      id: "medical-support",
      deptId: "medical",
      deptName: "Medical",
      name: "Medical Assistance (Non-Emergency)",
      icon: HeartPulse,
      description: "Drinking water, routine nursing query, mobility assistance (non-emergency)",
      color: "border-[#DC2626] hover:bg-[#FEF2F2]/40",
      accent: "text-[#DC2626] bg-[#FEF2F2]",
      defaultItems: ["Bed Reclining Help", "Drinking Water Refill", "Routine Nursing Query", "Mobility Assistance"],
    },
    {
      id: "it-tech",
      deptId: "it",
      deptName: "IT",
      name: "IT & Digital Services",
      icon: HelpCircle,
      description: "Patient TV / remote, hospital Wi-Fi connectivity, bedside digital screen",
      color: "border-[#0284C7] hover:bg-[#F0F9FF]/40",
      accent: "text-[#0284C7] bg-[#F0F9FF]",
      defaultItems: ["In-Room TV / Remote", "Patient Wi-Fi Connectivity", "Bedside Screen", "Digital Call Panel"],
    },
  ];

  const handleSelectCategory = (cat: (typeof categories)[0]) => {
    setSelectedDept(cat.deptId);
    setCategoryName(cat.name);
    setTitle(`${cat.name} Issue`);
    setStep("form");
  };

  // Clean up audio & recording timers on unmount
  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
        mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  // Web Audio Recording with Accurate Hardware Clock Normalization
  const startRecording = async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert("Audio recording is not supported in this browser.");
        return;
      }

      // Reset prior audio states
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
      }
      setIsPlaying(false);
      setPlaybackTime(0);
      setRecordedDuration(0);
      setRecordingSeconds(0);
      initialOffsetRef.current = 0;

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      let mimeType = "audio/webm";
      if (typeof MediaRecorder !== "undefined") {
        if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) {
          mimeType = "audio/webm;codecs=opus";
        } else if (MediaRecorder.isTypeSupported("audio/webm")) {
          mimeType = "audio/webm";
        } else if (MediaRecorder.isTypeSupported("audio/mp4")) {
          mimeType = "audio/mp4";
        } else if (MediaRecorder.isTypeSupported("audio/aac")) {
          mimeType = "audio/aac";
        }
      }

      const mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        if (recordingTimerRef.current) {
          clearInterval(recordingTimerRef.current);
          recordingTimerRef.current = null;
        }

        const elapsedMs = Date.now() - recordingStartTimeRef.current;
        const finalSecs = Math.max(1, Math.round(elapsedMs / 1000));
        setRecordedDuration(finalSecs);
        setRecordingSeconds(finalSecs);

        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        const url = URL.createObjectURL(audioBlob);
        setAudioUrl(url);

        const reader = new FileReader();
        reader.onloadend = () => {
          setAudioBase64(reader.result as string);
        };
        reader.readAsDataURL(audioBlob);

        setTranscription(
          `Patient voice message recorded for care team (${formatAudioDuration(finalSecs)}).`
        );
      };

      mediaRecorder.start(250);
      recordingStartTimeRef.current = Date.now();
      setIsRecording(true);

      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - recordingStartTimeRef.current) / 1000);
        setRecordingSeconds(elapsed);
        if (elapsed >= 120) {
          stopRecording();
        }
      }, 250);
    } catch (_) {
      alert("Microphone permission required to record audio.");
    }
  };

  const stopRecording = () => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());
    }
    setIsRecording(false);
  };

  const resetRecording = () => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());
    }
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
    }
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }
    setAudioUrl(null);
    setAudioBase64(null);
    setTranscription("");
    setIsRecording(false);
    setRecordingSeconds(0);
    setRecordedDuration(0);
    setPlaybackTime(0);
    setIsPlaying(false);
    initialOffsetRef.current = 0;
  };

  // Custom Audio Playback Handlers (Immune to WebM Android hardware timestamp bug)
  const togglePlayback = () => {
    const audio = audioPlayerRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      if (playbackTime >= recordedDuration) {
        audio.currentTime = initialOffsetRef.current || 0;
        setPlaybackTime(0);
      }
      audio
        .play()
        .then(() => setIsPlaying(true))
        .catch((err) => console.error("Playback error:", err));
    }
  };

  const handleAudioTimeUpdate = () => {
    const audio = audioPlayerRef.current;
    if (!audio) return;

    let curr = audio.currentTime;
    // Normalize Android WebM system uptime clock offset (e.g. 10800s / ~3 hours)
    if (curr > 3600) {
      if (!initialOffsetRef.current) {
        initialOffsetRef.current = curr;
      }
      curr = curr - initialOffsetRef.current;
    }

    curr = Math.max(0, Math.min(recordedDuration, Math.floor(curr)));
    setPlaybackTime(curr);
  };

  const handleAudioEnded = () => {
    setIsPlaying(false);
    setPlaybackTime(0);
    if (audioPlayerRef.current) {
      audioPlayerRef.current.currentTime = initialOffsetRef.current || 0;
    }
  };

  const handleSeek = (seconds: number) => {
    const target = Math.max(0, Math.min(recordedDuration, seconds));
    setPlaybackTime(target);
    if (audioPlayerRef.current) {
      audioPlayerRef.current.currentTime = (initialOffsetRef.current || 0) + target;
    }
  };

  const handlePhotoCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        alert("Photo must be less than 10MB");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        setPhotoBase64(base64);
        setPhotoPreview(base64);
      };
      reader.readAsDataURL(file);
    }
  };

  // Submit Complaint with Idempotency Protection
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return; // Prevent double-clicks

    const trimmedContact = patientContact.trim();
    if (!trimmedContact) {
      alert("Mobile number is required for ticket tracking and WhatsApp status notifications.");
      return;
    }
    const normalizedPhone = normalizeE164(trimmedContact);
    if (!isValidPhone(normalizedPhone)) {
      alert("Please enter a valid mobile number (e.g. +1 555-0192 or +91 98450 11223).");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await api.submitPatientTicket({
        qr_token: currentToken,
        department_id: selectedDept,
        category: categoryName,
        title: title || `${categoryName} Request`,
        description: description || transcription || `Service request for ${categoryName}`,
        voice_recording_base64: audioBase64 || undefined,
        voice_transcription: transcription || undefined,
        patient_contact: normalizedPhone,
        photo_base64: photoBase64 || undefined,
        idempotency_key: idempotencyKey,
      });

      setSubmittedTicket({
        id: res.id,
        ticket_number: res.ticket_number,
        department: res.department,
        status: res.status,
        room_number: res.room_number,
        category: categoryName,
        created_at: res.created_at,
        friendly_status: "Received & Queued",
        tracking_url: res.tracking_url,
        tracking_token: res.token,
      });
      setStep("confirmation");
    } catch (err: any) {
      alert(`Submission error: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFeedbackSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmoji) {
      alert("Please select one of the satisfaction emojis (Unhappy, Okay, or Happy).");
      return;
    }
    if (!submittedTicket?.id) {
      alert("Ticket details are loading. Please wait a moment.");
      return;
    }

    setIsSubmittingFeedback(true);
    try {
      await api.submitNPSFeedback({
        ticket_id: submittedTicket.id,
        tracking_token: submittedTicket.tracking_token || undefined,
        emoji_rating: selectedEmoji,
        nps_score: npsScore !== null ? npsScore : undefined,
        feedback_comment: feedbackComment.trim() || undefined,
      });
      setFeedbackSubmitted(true);
    } catch (err: any) {
      alert(`Failed to record feedback: ${err.message || err}`);
    } finally {
      setIsSubmittingFeedback(false);
    }
  };

  return (
    <div className="min-h-full bg-[#F7F8FA] flex flex-col justify-between max-w-xl mx-auto shadow-2xl relative">
      {/* Top Header Bar */}
      <header className="bg-white border-b border-[#E2E8F0] px-5 py-3.5 flex items-center justify-between sticky top-0 z-20 shadow-xs">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-xl bg-[#176B63] flex items-center justify-center text-white shadow-xs">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xs font-bold text-[#0F172A] flex items-center gap-1.5">
              <span>CareOps Bedside Assist</span>
              <span className="text-[10px] text-[#16805D] bg-[#EDF7F2] px-1.5 py-0.5 rounded-full font-bold">
                Live Portal
              </span>
            </div>
            <div className="text-[11px] text-[#64748B] flex items-center gap-1">
              <Building className="h-3 w-3" />
              <span>
                {roomData ? `${roomData.room_number} • ${roomData.wing}` : "Resolving Location..."}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowQRModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#176B63] hover:bg-[#10574F] text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
            title="View Real Scannable Room QR Code"
          >
            <QrCode className="h-4 w-4" />
            <span className="hidden sm:inline">Room QR</span>
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-[#64748B] hover:text-[#0F172A] hover:bg-[#F1F5F9] cursor-pointer"
              title="Close patient portal"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>
      </header>

      {/* Main Content Pane */}
      <main className="flex-1 p-5 overflow-y-auto space-y-5">
        {/* CRITICAL MEDICAL EMERGENCY WARNING BANNER (Always Visible) */}
        <div className="p-3.5 rounded-2xl bg-[#FEF2F2] border-2 border-[#FCA5A5] flex items-start gap-3 shadow-xs">
          <div className="p-2 rounded-xl bg-[#EF4444] text-white shrink-0 mt-0.5">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div className="space-y-1 text-xs">
            <strong className="text-[#991B1B] font-black uppercase tracking-wide block">
              Medical Emergency Warning
            </strong>
            <p className="text-[#7F1D1D] leading-relaxed">
              For acute chest pain, difficulty breathing, or urgent medical deterioration,{" "}
              <strong>press the RED Nurse Call button</strong> on your bed rail or notify nursing staff immediately.
              This service portal is for facility, room maintenance, and non-emergency requests only.
            </p>
          </div>
        </div>

        {/* LOADING & QR ERROR STATES */}
        {isValidatingQR ? (
          <div className="py-20 text-center text-sm text-[#64748B] space-y-3">
            <div className="animate-spin h-8 w-8 border-3 border-[#176B63] border-t-transparent rounded-full mx-auto" />
            <p className="font-semibold text-xs">Validating Hospital Bedside QR Code...</p>
          </div>
        ) : qrError ? (
          <div className="p-6 rounded-3xl bg-white border-2 border-[#FCA5A5] text-center space-y-4 shadow-sm">
            <div className="h-12 w-12 rounded-full bg-[#FEE2E2] text-[#DC2626] flex items-center justify-center mx-auto">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#0F172A]">Bedside QR Code Invalid or Revoked</h2>
              <p className="text-xs text-[#64748B] mt-1">{qrError}</p>
            </div>
            <div className="p-3 bg-[#F8FAFC] rounded-2xl border border-[#CBD5E1] text-[11px] text-[#475569]">
              Please inform your attending nurse or ward manager to generate an updated QR placard.
            </div>
          </div>
        ) : (
          <>
            {/* STEP 1: CATEGORY SELECTION (Prefilled Room Location) */}
            {step === "categories" && (
              <div className="space-y-4 animate-in fade-in duration-200">
                {/* Verified Room Location Card */}
                <div className="p-4 rounded-2xl bg-[#E8F3F1] border-2 border-[#A7D7D1] space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-[#176B63] uppercase tracking-wider">
                      Verified Room Location
                    </span>
                    <span className="text-[10px] font-mono text-[#176B63] bg-white px-2 py-0.5 rounded-md border border-[#A7D7D1]">
                      {roomData?.token || currentToken}
                    </span>
                  </div>
                  <h2 className="text-base font-black text-[#0F172A]">
                    {roomData ? `${roomData.room_number} • ${roomData.wing}` : "Room 204 • East Wing"}
                  </h2>
                  <p className="text-[11px] text-[#475569]">
                    {roomData?.floor || "Floor 2"} • Metropolitan General Hospital
                  </p>
                </div>

                <div className="pb-1 border-b border-[#E2E8F0]">
                  <h2 className="text-base font-black text-[#0F172A]">
                    How Can We Assist You?
                  </h2>
                  <p className="text-xs text-[#64748B]">
                    Select a hospital service category below. It routes directly to the on-duty staff.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {categories.map((cat) => {
                    const Icon = cat.icon;
                    return (
                      <button
                        key={cat.id}
                        onClick={() => handleSelectCategory(cat)}
                        className={`text-left p-4 rounded-3xl bg-white border-2 border-[#CBD5E1] hover:border-[#176B63] shadow-xs hover:shadow-md transition-all flex flex-col justify-between group cursor-pointer ${cat.color}`}
                      >
                        <div className="space-y-3">
                          <div
                            className={`h-10 w-10 rounded-2xl flex items-center justify-center ${cat.accent}`}
                          >
                            <Icon className="h-5 w-5" />
                          </div>
                          <div>
                            <h3 className="font-bold text-sm text-[#0F172A] group-hover:text-[#176B63] transition-colors">
                              {cat.name}
                            </h3>
                            <p className="text-[11px] text-[#64748B] mt-1 leading-relaxed">
                              {cat.description}
                            </p>
                          </div>
                        </div>

                        <div className="pt-3 mt-3 border-t border-[#F1F5F9] flex items-center justify-between text-[11px] font-bold text-[#176B63]">
                          <span>Select Issue</span>
                          <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-1 transition-transform" />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* STEP 3: COMPLAINT FORM */}
            {step === "form" && (
              <form onSubmit={handleSubmit} className="space-y-4 animate-in fade-in duration-200">
                <div className="flex items-center justify-between pb-2 border-b border-[#E2E8F0]">
                  <button
                    type="button"
                    onClick={() => setStep("categories")}
                    className="flex items-center gap-1.5 text-xs text-[#64748B] hover:text-[#0F172A] font-bold cursor-pointer"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    <span>Back to Categories</span>
                  </button>
                  <span className="text-xs font-bold text-[#176B63]">{categoryName}</span>
                </div>

                {/* Complaint Title */}
                <div>
                  <label className="text-xs font-bold text-[#0F172A] block mb-1">
                    Complaint Title / Issue Summary *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Ceiling light over bed 2 is not turning on"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full p-3 rounded-2xl border-2 border-[#CBD5E1] bg-white text-xs font-medium focus:outline-none focus:border-[#176B63]"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="text-xs font-bold text-[#0F172A] block mb-1">
                    Details & Specific Room Area *
                  </label>
                  <textarea
                    required
                    rows={3}
                    placeholder="Describe the problem, location in room, or any noise/leaks..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full p-3 rounded-2xl border-2 border-[#CBD5E1] bg-white text-xs font-medium focus:outline-none focus:border-[#176B63]"
                  />
                </div>

                {/* Voice Note Recording Option */}
                <div className="p-3.5 rounded-2xl bg-white border-2 border-[#CBD5E1] space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#0F172A] flex items-center gap-1.5">
                      <Mic className="h-4 w-4 text-[#176B63]" />
                      <span>Optional Voice Note</span>
                    </span>
                    {audioUrl && (
                      <button
                        type="button"
                        onClick={resetRecording}
                        className="text-[11px] text-[#DC2626] font-bold hover:underline cursor-pointer flex items-center gap-1"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span>Delete</span>
                      </button>
                    )}
                  </div>

                  {!audioUrl ? (
                    <div>
                      {!isRecording ? (
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
                          <button
                            type="button"
                            onClick={startRecording}
                            className="px-4 py-2.5 rounded-xl bg-[#176B63] hover:bg-[#10574F] text-white text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-all shadow-xs shrink-0"
                          >
                            <Mic className="h-4 w-4" />
                            <span>Record Voice Message</span>
                          </button>
                          <span className="text-[11px] text-[#64748B]">
                            Speak details in your language (hands-free)
                          </span>
                        </div>
                      ) : (
                        <div className="p-3 bg-[#FEF2F2] rounded-xl border border-[#FCA5A5] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="flex items-center gap-2.5">
                            <span className="relative flex h-3 w-3">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                            </span>
                            <div className="flex items-center gap-1">
                              <span className="w-1 h-3 bg-[#DC2626] rounded-full animate-pulse" />
                              <span className="w-1 h-5 bg-[#DC2626] rounded-full animate-pulse delay-75" />
                              <span className="w-1 h-2 bg-[#DC2626] rounded-full animate-pulse delay-150" />
                            </div>
                            <span className="text-xs font-mono font-bold text-[#DC2626]">
                              Recording: {formatAudioDuration(recordingSeconds)}
                            </span>
                            <span className="text-[11px] text-[#991B1B]">(Max 2:00)</span>
                          </div>

                          <button
                            type="button"
                            onClick={stopRecording}
                            className="px-4 py-2 rounded-xl bg-[#DC2626] hover:bg-[#B91C1C] text-white text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-all shadow-sm shrink-0"
                          >
                            <Square className="h-3.5 w-3.5 fill-current" />
                            <span>Stop Recording</span>
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="p-3 bg-[#F0FDF4] rounded-xl border border-[#BBF7D0] space-y-2.5">
                      <audio
                        ref={audioPlayerRef}
                        src={audioUrl}
                        preload="auto"
                        onTimeUpdate={handleAudioTimeUpdate}
                        onEnded={handleAudioEnded}
                        className="hidden"
                      />

                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={togglePlayback}
                          className="h-9 w-9 rounded-xl bg-[#176B63] hover:bg-[#10574F] text-white flex items-center justify-center shrink-0 shadow-sm cursor-pointer transition-transform active:scale-95"
                          title={isPlaying ? "Pause" : "Play"}
                        >
                          {isPlaying ? (
                            <Pause className="h-4 w-4" />
                          ) : (
                            <Play className="h-4 w-4 fill-current ml-0.5" />
                          )}
                        </button>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between text-[11px] font-mono font-bold text-[#17212F] mb-1">
                            <span className="text-[#176B63]">
                              {formatAudioDuration(playbackTime)}
                            </span>
                            <span className="text-[#64748B]">
                              {formatAudioDuration(recordedDuration)}
                            </span>
                          </div>
                          <input
                            type="range"
                            min={0}
                            max={recordedDuration || 1}
                            value={playbackTime}
                            onChange={(e) => handleSeek(Number(e.target.value))}
                            className="w-full h-1.5 bg-[#CBD5E1] rounded-lg appearance-none cursor-pointer accent-[#176B63]"
                          />
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-[11px] font-bold text-[#16805D] bg-[#DCFCE7] px-2 py-0.5 rounded-md flex items-center gap-1">
                            <span>Recorded ✓</span>
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Photo Attachment */}
                <div className="p-3.5 rounded-2xl bg-white border-2 border-[#CBD5E1] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#0F172A]">Optional Photo Attachment</span>
                    {photoPreview && (
                      <button
                        type="button"
                        onClick={() => {
                          setPhotoBase64(null);
                          setPhotoPreview(null);
                        }}
                        className="text-[11px] text-[#DC2626] font-bold hover:underline"
                      >
                        Remove Photo
                      </button>
                    )}
                  </div>

                  {!photoPreview ? (
                    <label className="flex items-center gap-2.5 p-3 rounded-xl border border-dashed-2 border-[#CBD5E1] hover:border-[#176B63] bg-[#F8FAFC] hover:bg-white cursor-pointer text-xs text-[#64748B] transition-all">
                      <Camera className="h-5 w-5 text-[#176B63]" />
                      <span>Take a photo or upload from camera gallery</span>
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={handlePhotoCapture}
                        className="hidden"
                      />
                    </label>
                  ) : (
                    <div className="relative w-32 h-32 rounded-xl overflow-hidden border border-[#CBD5E1]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
                    </div>
                  )}
                </div>

                {/* Mobile Phone Number (Required for WhatsApp & Live Tracking) */}
                <div>
                  <label className="text-xs font-bold text-[#0F172A] flex items-center justify-between mb-1">
                    <span>Mobile Phone Number *</span>
                    <span className="text-[10px] text-[#16805D] font-bold">WhatsApp Enabled</span>
                  </label>
                  <div className="relative">
                    <input
                      type="tel"
                      required
                      placeholder="e.g. +1 555-0192 or +91 98450 11223"
                      value={patientContact}
                      onChange={(e) => setPatientContact(e.target.value)}
                      className="w-full p-3 rounded-2xl border-2 border-[#CBD5E1] bg-white text-xs font-medium focus:outline-none focus:border-[#176B63] pl-9"
                    />
                    <Phone className="h-4 w-4 text-[#64748B] absolute left-3 top-3.5" />
                  </div>
                  <p className="text-[11px] text-[#64748B] mt-1">
                    Mandatory for live WhatsApp resolution updates and tracking link delivery.
                  </p>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-4 rounded-2xl bg-[#176B63] hover:bg-[#10574F] text-white text-sm font-black shadow-lg shadow-[#176B63]/25 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                >
                  <Send className="h-4 w-4" />
                  <span>{isSubmitting ? "Submitting to Hospital Staff..." : "Submit Complaint Now"}</span>
                </button>
              </form>
            )}

            {/* STEP 3: CONFIRMATION & LIVE TRACKING */}
            {step === "confirmation" && submittedTicket && (
              <div className="space-y-6 text-center py-4 animate-in zoom-in-95 duration-200">
                <div className="h-16 w-16 rounded-full bg-[#EDF7F2] text-[#16805D] flex items-center justify-center mx-auto border-4 border-white shadow-md">
                  <CheckCircle2 className="h-8 w-8" />
                </div>

                <div className="space-y-1">
                  <span className="text-[11px] font-black text-[#16805D] uppercase tracking-wider bg-[#EDF7F2] px-3 py-1 rounded-full">
                    Complaint Successfully Saved
                  </span>
                  <h2 className="text-xl font-black text-[#0F172A]">Request Sent to Care Team</h2>
                  <p className="text-xs text-[#64748B] max-w-sm mx-auto">
                    The {submittedTicket.department} staff has been notified. This screen updates live in real-time.
                  </p>
                </div>

                {/* Dynamic Arrival Status Banner */}
                {(() => {
                  const isAcknowledged =
                    submittedTicket.status === "acknowledged" ||
                    (Boolean(submittedTicket.acknowledged_at) &&
                      submittedTicket.status === "submitted");
                  const isWorking = ["in_progress", "work_started"].includes(submittedTicket.status);
                  const isWorkCompleted = [
                    "resolution_submitted",
                    "work_completed",
                  ].includes(submittedTicket.status);
                  const isClosed = submittedTicket.status === "closed";

                  if (isAcknowledged) {
                    return (
                      <div className="p-4 rounded-2xl bg-[#EBF3FD] border-2 border-[#BFDBFE] text-xs flex items-center justify-between text-left shadow-2xs animate-in fade-in">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-white rounded-xl text-[#3868C9] shadow-2xs">
                            <Clock className="h-5 w-5 text-[#3868C9]" />
                          </div>
                          <div>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-[#3868C9] block">
                              Estimated Arrival
                            </span>
                            <strong className="text-sm font-black text-[#17212F]">
                              {submittedTicket.estimated_arrival_minutes || 10}–{((submittedTicket.estimated_arrival_minutes || 10) + 5)} Minutes
                            </strong>
                            <span className="text-[11px] text-[#475467] block">
                              Staff acknowledged and en route to {submittedTicket.room_number}
                            </span>
                          </div>
                        </div>
                        <span className="px-2.5 py-1 rounded-full bg-white text-[11px] font-bold text-[#3868C9] border border-[#BFDBFE] shrink-0">
                          Technician En Route
                        </span>
                      </div>
                    );
                  }

                  if (isWorking) {
                    return (
                      <div className="p-4 rounded-2xl bg-[#EDF7F2] border-2 border-[#A6E1CE] text-xs flex items-center justify-between text-left shadow-2xs animate-in fade-in">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-white rounded-xl text-[#16805D] shadow-2xs">
                            <UserCheck className="h-5 w-5 text-[#16805D]" />
                          </div>
                          <div>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-[#16805D] block">
                              Staff Arrived On-Site
                            </span>
                            <strong className="text-sm font-black text-[#0F172A]">
                              Staff Has Arrived at {submittedTicket.room_number}
                            </strong>
                            <span className="text-[11px] text-[#334155] block">
                              {submittedTicket.assigned_staff_name ? `${submittedTicket.assigned_staff_name} is` : "Technician is"} actively attending to your request
                            </span>
                          </div>
                        </div>
                        <span className="px-2.5 py-1 rounded-full bg-white text-[11px] font-black text-[#16805D] border border-[#A6E1CE] shrink-0">
                          Work in Progress
                        </span>
                      </div>
                    );
                  }

                  if (isWorkCompleted) {
                    return (
                      <div className="p-4 rounded-2xl bg-[#F0FDF4] border-2 border-[#86EFAC] text-xs flex items-center justify-between text-left shadow-2xs animate-in fade-in">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-white rounded-xl text-[#15803D] shadow-2xs">
                            <CheckCircle2 className="h-5 w-5 text-[#15803D]" />
                          </div>
                          <div>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-[#15803D] block">
                              Service Completed
                            </span>
                            <strong className="text-sm font-black text-[#0F172A]">
                              Staff Has Completed the Service
                            </strong>
                            <span className="text-[11px] text-[#334155] block">
                              Work completed with safety standards; awaiting final sign-off
                            </span>
                          </div>
                        </div>
                        <span className="px-2.5 py-1 rounded-full bg-white text-[11px] font-black text-[#15803D] border border-[#86EFAC] shrink-0">
                          Work Completed
                        </span>
                      </div>
                    );
                  }

                  if (isClosed) {
                    return (
                      <div className="p-4 rounded-2xl bg-[#EDF7F2] border-2 border-[#A6E1CE] text-xs flex items-center justify-between text-left shadow-2xs animate-in fade-in">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-white rounded-xl text-[#16805D] shadow-2xs">
                            <CheckCircle2 className="h-5 w-5 text-[#16805D]" />
                          </div>
                          <div>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-[#16805D] block">
                              Resolved & Closed
                            </span>
                            <strong className="text-sm font-black text-[#0F172A]">
                              Issue Officially Resolved
                            </strong>
                            <span className="text-[11px] text-[#334155] block">
                              Inspected and closed by hospital supervisor
                            </span>
                          </div>
                        </div>
                        <span className="px-2.5 py-1 rounded-full bg-white text-[11px] font-black text-[#16805D] border border-[#A6E1CE] shrink-0">
                          Closed
                        </span>
                      </div>
                    );
                  }

                  return null;
                })()}

                {/* Patient-Safe Confirmation Box */}
                {(() => {
                  const fullTrackingUrl = (submittedTicket.tracking_url && submittedTicket.tracking_url.startsWith("http"))
                    ? submittedTicket.tracking_url
                    : typeof window !== "undefined"
                    ? `${window.location.origin}/track/${submittedTicket.ticket_number}${submittedTicket.tracking_url?.includes("?token=") ? `?token=${submittedTicket.tracking_url.split("?token=")[1]}` : ""}`
                    : `https://care-ops-dusky.vercel.app/track/${submittedTicket.ticket_number}`;

                  const waNoticeText = `*Official CareOps Hospital Confirmation Notice*\n\nYour complaint has been registered successfully.\n• Ticket Reference: *${submittedTicket.ticket_number}*\n• Service Location: *${submittedTicket.room_number}*\n• Department: *${submittedTicket.department}*\n\nTrack real-time resolution progress here:\n${fullTrackingUrl}`;

                  const cleanPhone = patientContact.replace(/[^\d+]/g, "").replace(/^\+/, "");
                  const waUrl = cleanPhone
                    ? `https://api.whatsapp.com/send?phone=${encodeURIComponent(cleanPhone)}&text=${encodeURIComponent(waNoticeText)}`
                    : `https://api.whatsapp.com/send?text=${encodeURIComponent(waNoticeText)}`;

                  return (
                    <div className="p-4 rounded-2xl bg-[#E8F3F1] border-2 border-[#A7D7D1] text-left space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="text-[11px] font-bold text-[#176B63] uppercase tracking-wider flex items-center gap-1.5">
                          <CheckCircle2 className="h-4 w-4" />
                          <span>Official Confirmation Notice</span>
                        </div>
                        {patientContact && (
                          <span className="text-[10px] font-bold text-[#16805D] bg-white px-2 py-0.5 rounded-full border border-[#A6E1CE]">
                            WhatsApp: {patientContact}
                          </span>
                        )}
                      </div>

                      <p className="text-xs font-medium text-[#0F172A] leading-relaxed bg-white p-3.5 rounded-xl border border-[#CBD5E1]">
                        &ldquo;Your complaint has been registered successfully. Your ticket reference is{" "}
                        <strong className="font-mono text-[#176B63]">{submittedTicket.ticket_number}</strong>. Track the progress of your request here:{" "}
                        <a
                          href={fullTrackingUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[#176B63] underline font-bold break-all"
                        >
                          {fullTrackingUrl}
                        </a>
                        .&rdquo;
                      </p>

                      <a
                        href={waUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="w-full py-2.5 px-4 rounded-xl bg-[#25D366] hover:bg-[#1EBE5D] text-white text-xs font-black flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer"
                        title="Receive / Open Official Notice in WhatsApp"
                      >
                        <MessageSquare className="h-4 w-4" />
                        <span>Open / Receive on WhatsApp</span>
                      </a>
                    </div>
                  );
                })()}

                {/* Reference Card */}
                <div className="bg-white p-5 rounded-3xl border-2 border-[#CBD5E1] shadow-xs text-left space-y-3">
                  <div className="flex justify-between items-center pb-3 border-b border-[#F1F5F9]">
                    <div>
                      <span className="text-[10px] text-[#64748B] uppercase font-bold block">
                        Unique Reference ID
                      </span>
                      <span className="font-black text-base text-[#176B63] font-mono">
                        {submittedTicket.ticket_number}
                      </span>
                    </div>
                    <span className="text-xs font-black px-2.5 py-1 rounded-full bg-[#EDF7F2] text-[#16805D] capitalize">
                      {submittedTicket.friendly_status || "Received & Queued"}
                    </span>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-[#64748B]">Service Location:</span>
                      <strong className="text-[#0F172A]">{submittedTicket.room_number}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#64748B]">Department:</span>
                      <strong className="text-[#0F172A]">{submittedTicket.department}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#64748B]">Submitted Time:</span>
                      <span className="text-[#0F172A]">
                        {formatTime(submittedTicket.created_at)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 5-Step Live Progress Tracker */}
                <div className="p-5 bg-white rounded-3xl border-2 border-[#CBD5E1] text-left space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-xs text-[#0F172A] uppercase tracking-wider">
                      Live Resolution Milestones
                    </h4>
                    <span className="text-[10px] text-[#16805D] bg-[#EDF7F2] px-2 py-0.5 rounded-full font-bold">
                      ● Live Sync Active
                    </span>
                  </div>

                  <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-[#CBD5E1]">
                    {[
                      {
                        label: "1. Request Registered",
                        desc: "Saved in CareOps hospital database",
                        active: true,
                        time: submittedTicket.created_at,
                      },
                      {
                        label: "2. Assigned to On-Duty Team",
                        desc: "Assigned according to room and department",
                        active: submittedTicket.status !== "submitted",
                        time: submittedTicket.created_at,
                      },
                      {
                        label: "3. Staff Acknowledged & En Route",
                        desc: "Staff member accepted the task",
                        active: [
                          "acknowledged",
                          "in_progress",
                          "work_started",
                          "work_completed",
                          "resolution_submitted",
                          "closed",
                        ].includes(submittedTicket.status),
                        time: submittedTicket.acknowledged_at,
                      },
                      {
                        label: "4. Work in Progress",
                        desc: "Repairs / service underway at room",
                        active: [
                          "in_progress",
                          "work_started",
                          "work_completed",
                          "resolution_submitted",
                          "closed",
                        ].includes(submittedTicket.status),
                        time: submittedTicket.in_progress_at || submittedTicket.work_started_at,
                      },
                      {
                        label: "5. Resolved & Closed",
                        desc: "Verified by hospital supervisor",
                        active: [
                          "closed",
                          "work_completed",
                          "resolution_submitted",
                        ].includes(submittedTicket.status),
                        time: submittedTicket.closed_at || submittedTicket.work_completed_at,
                      },
                    ].map((m, idx) => (
                      <div key={idx} className="relative flex items-start gap-3">
                        <div
                          className={`absolute -left-6 top-0.5 h-5 w-5 rounded-full flex items-center justify-center text-xs font-bold ${
                            m.active
                              ? "bg-[#176B63] text-white shadow-xs"
                              : "bg-white border-2 border-[#CBD5E1] text-[#94A3B8]"
                          }`}
                        >
                          {m.active ? "✓" : idx + 1}
                        </div>
                        <div>
                          <span
                            className={`text-xs block font-bold ${
                              m.active ? "text-[#0F172A]" : "text-[#94A3B8]"
                            }`}
                          >
                            {m.label}
                          </span>
                          <span className="text-[10px] text-[#64748B] block">{m.desc}</span>
                          {m.time && (
                            <span className="text-[10px] text-[#16805D] font-mono">
                              {formatTime(m.time)}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Staff Recognition & Positive Feedback Card (when completed or closed) */}
                {(submittedTicket.ready_for_feedback ||
                  ["closed", "work_completed", "resolution_submitted"].includes(submittedTicket.status)) && (
                  <div className="bg-white rounded-3xl border-2 border-[#176B63] p-5 shadow-sm space-y-4 text-left">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-[#176B63]" />
                      <h3 className="text-sm font-black text-[#0F172A]">
                        How was your hospital service experience?
                      </h3>
                    </div>

                    {/* Staff Recognition & Care Standards Card */}
                    <div className="p-4 rounded-2xl bg-gradient-to-br from-[#F8FAFC] to-[#EEF4FD] border-2 border-[#BFDBFE] space-y-3 shadow-xs">
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          {submittedTicket.assigned_staff_avatar ? (
                            <img
                              src={submittedTicket.assigned_staff_avatar}
                              alt={submittedTicket.assigned_staff_name || "Staff"}
                              className="h-12 w-12 rounded-2xl object-cover border-2 border-[#176B63] shadow-xs"
                            />
                          ) : (
                            <div className="h-12 w-12 rounded-2xl bg-[#176B63] text-white flex items-center justify-center font-black text-sm border-2 border-[#0F4F48] shadow-xs">
                              {submittedTicket.assigned_staff_name
                                ? submittedTicket.assigned_staff_name
                                    .split(" ")
                                    .map((n: string) => n[0])
                                    .join("")
                                    .slice(0, 2)
                                : "ST"}
                            </div>
                          )}
                          <span className="absolute -bottom-1 -right-1 h-4 w-4 bg-[#16805D] border-2 border-white rounded-full flex items-center justify-center text-[9px] text-white font-bold">
                            ✓
                          </span>
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <h4 className="text-sm font-black text-[#0F172A]">
                              {submittedTicket.assigned_staff_name || "Dedicated Hospital Care Specialist"}
                            </h4>
                            <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-[#EDF7F2] text-[#16805D] border border-[#A6E1CE]">
                              Dedicated Care
                            </span>
                          </div>
                          <p className="text-xs font-semibold text-[#64748B]">
                            {submittedTicket.assigned_staff_designation || `${submittedTicket.department} Team Specialist`}
                          </p>
                        </div>
                      </div>

                      {/* Summary of diligence & accomplishment */}
                      <div className="bg-white p-3 rounded-xl border border-[#CBD5E1] space-y-1.5 text-xs">
                        <div className="flex items-center gap-1.5 text-[#16805D] font-bold text-[11px] uppercase tracking-wide">
                          <Sparkles className="h-3.5 w-3.5" />
                          <span>Work Completed & Hospital Quality Standards</span>
                        </div>
                        <p className="text-[#334155] font-medium leading-relaxed">
                          {submittedTicket.resolution_summary
                            ? submittedTicket.resolution_summary
                            : `Attended promptly to your ${submittedTicket.category || "service"} request at ${submittedTicket.room_number}, completed all safety tests, and ensured clean handover.`}
                        </p>
                        <div className="pt-1.5 flex flex-wrap gap-1.5 text-[10px] font-bold text-[#475569]">
                          <span className="bg-[#F1F5F9] px-2 py-0.5 rounded-md border border-[#E2E8F0]">✓ Attended On-Time</span>
                          <span className="bg-[#F1F5F9] px-2 py-0.5 rounded-md border border-[#E2E8F0]">✓ High Hygiene & Safety Protocol</span>
                          <span className="bg-[#F1F5F9] px-2 py-0.5 rounded-md border border-[#E2E8F0]">✓ Dignified Patient Care Assured</span>
                        </div>
                      </div>

                      <p className="text-[11.5px] font-semibold text-[#1E40AF] leading-snug">
                        Our frontline team works hard every day to care for your comfort and dignity. If you are satisfied with {submittedTicket.assigned_staff_name ? `${submittedTicket.assigned_staff_name}'s` : "our staff's"} prompt service, please share a positive rating below to recognize their dedication!
                      </p>
                    </div>

                    {feedbackSubmitted ? (
                      <div className="p-4 rounded-xl bg-[#EDF7F2] border border-[#A6E1CE] text-[#16805D] text-xs font-semibold text-center space-y-1">
                        <CheckCircle2 className="h-6 w-6 mx-auto" />
                        <p className="text-sm font-bold">Thank you for your valuable feedback!</p>
                        <p className="text-[11px] text-[#16805D]/80">
                          Your response helps us continually recognize staff and deliver dignified patient care.
                        </p>
                      </div>
                    ) : (
                      <form onSubmit={handleFeedbackSubmit} className="space-y-4 text-xs">
                        {/* 3 Emoji Buttons */}
                        <div className="space-y-1.5">
                          <label className="text-[#344054] font-semibold block">
                            Overall Satisfaction: <span className="text-[#DC2626]">*</span>
                          </label>
                          <div className="grid grid-cols-3 gap-2">
                            <button
                              type="button"
                              onClick={() => setSelectedEmoji("unhappy")}
                              className={`p-3 rounded-xl border text-center transition cursor-pointer flex flex-col items-center gap-1 ${
                                selectedEmoji === "unhappy"
                                  ? "bg-[#FEF3F2] border-[#DC2626] text-[#DC2626] font-bold"
                                  : "bg-[#F8F9FA] border-[#E5E9EF] text-[#667085] hover:bg-[#F2F4F7]"
                              }`}
                            >
                              <span className="text-2xl">😞</span>
                              <span className="text-xs">Unhappy</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => setSelectedEmoji("okay")}
                              className={`p-3 rounded-xl border text-center transition cursor-pointer flex flex-col items-center gap-1 ${
                                selectedEmoji === "okay"
                                  ? "bg-[#FEF7EC] border-[#F79009] text-[#B54708] font-bold"
                                  : "bg-[#F8F9FA] border-[#E5E9EF] text-[#667085] hover:bg-[#F2F4F7]"
                              }`}
                            >
                              <span className="text-2xl">😐</span>
                              <span className="text-xs">Okay</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => setSelectedEmoji("happy")}
                              className={`p-3 rounded-xl border text-center transition cursor-pointer flex flex-col items-center gap-1 ${
                                selectedEmoji === "happy"
                                  ? "bg-[#EDF7F2] border-[#16805D] text-[#16805D] font-bold"
                                  : "bg-[#F8F9FA] border-[#E5E9EF] text-[#667085] hover:bg-[#F2F4F7]"
                              }`}
                            >
                              <span className="text-2xl">😊</span>
                              <span className="text-xs">Happy</span>
                            </button>
                          </div>
                        </div>

                        {/* Optional NPS (0 to 10) */}
                        <div className="space-y-1.5 pt-1">
                          <div className="flex items-center justify-between">
                            <label className="text-[#344054] font-semibold">
                              Likelihood to recommend (0 = Unlikely, 10 = Extremely Likely):
                            </label>
                            {npsScore !== null && (
                              <span className="font-bold text-[#176B63] font-mono">{npsScore} / 10</span>
                            )}
                          </div>
                          <div className="flex items-center justify-between gap-1 overflow-x-auto pb-1">
                            {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((score) => (
                              <button
                                key={score}
                                type="button"
                                onClick={() => setNpsScore(score)}
                                className={`flex-1 min-w-[28px] h-8 rounded-lg font-mono text-xs font-bold transition cursor-pointer ${
                                  npsScore === score
                                    ? score >= 9
                                      ? "bg-[#16805D] text-white"
                                      : score >= 7
                                      ? "bg-[#F79009] text-white"
                                      : "bg-[#DC2626] text-white"
                                    : "bg-[#F8F9FA] border border-[#E5E9EF] text-[#475467] hover:bg-[#EEF4FD]"
                                }`}
                              >
                                {score}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Optional Comment */}
                        <div className="space-y-1 pt-1">
                          <label className="text-[#344054] font-semibold block">
                            Additional Comments (Optional):
                          </label>
                          <textarea
                            value={feedbackComment}
                            onChange={(e) => setFeedbackComment(e.target.value)}
                            placeholder="Tell us what you liked about the technician's care or what we can improve..."
                            rows={3}
                            className="w-full p-3 rounded-xl border border-[#CBD5E1] bg-white text-xs text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#176B63]"
                          />
                        </div>

                        <button
                          type="submit"
                          disabled={isSubmittingFeedback || !selectedEmoji}
                          className="w-full py-3.5 bg-[#176B63] hover:bg-[#10574F] text-white font-bold text-xs rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 shadow-md shadow-[#176B63]/20 disabled:opacity-50"
                        >
                          <Send className="h-3.5 w-3.5" />
                          <span>{isSubmittingFeedback ? "Recording Feedback..." : "Submit Experience Rating"}</span>
                        </button>
                      </form>
                    )}
                  </div>
                )}

                <div className="flex flex-col sm:flex-row gap-3">
                  <a
                    href={`/track/${submittedTicket.ticket_number}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex-1 py-3 rounded-2xl border-2 border-[#176B63] text-[#176B63] hover:bg-[#E8F3F1] text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                  >
                    <span>Open Standalone Tracker</span>
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>

                  <button
                    onClick={() => {
                      setStep("categories");
                      setTitle("");
                      setDescription("");
                      resetRecording();
                      setPhotoBase64(null);
                      setPhotoPreview(null);
                      setIdempotencyKey(`idem-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`);
                    }}
                    className="flex-1 py-3 rounded-2xl border-2 border-[#CBD5E1] bg-white hover:bg-[#F8FAFC] text-xs font-bold text-[#0F172A] transition-all cursor-pointer"
                  >
                    Report Another Issue
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* Footer Branding */}
      <footer className="p-4 border-t border-[#E2E8F0] bg-white text-center text-[11px] text-[#64748B]">
        <span>CareOps AI Hospital Dignity & Service Assurance • Zero Patient App Download Required</span>
      </footer>

      {/* Scannable Room QR Placard Modal */}
      {showQRModal && (
        <RoomQRPlacardModal
          room={{
            room_number: roomData?.room_number || "Room 204",
            floor: roomData?.floor || "Floor 2",
            wing: roomData?.wing || "East Wing",
            qr_token: currentToken,
          }}
          allRooms={allRooms}
          onSelectRoom={(r) => {
            // Reload with chosen room
            window.location.href = `/?room=${r.qr_token}`;
          }}
          onClose={() => setShowQRModal(false)}
        />
      )}
    </div>
  );
}
