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
  RefreshCw
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

  // Flow Step: "auth" -> "categories" -> "form" -> "confirmation"
  const [step, setStep] = useState<"auth" | "categories" | "form" | "confirmation">("auth");
  const [patientSession, setPatientSession] = useState<{
    token: string;
    type: "guest" | "verified";
    identifier: string;
  } | null>(null);

  // Phone OTP Verification State
  const [phoneInput, setPhoneInput] = useState("");
  const [otpInput, setOtpInput] = useState("");
  const [showOtpField, setShowOtpField] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);

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
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioBase64, setAudioBase64] = useState<string | null>(null);
  const [transcription, setTranscription] = useState<string>("");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Submission & Tracking State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState<string>("");
  const [submittedTicket, setSubmittedTicket] = useState<{
    ticket_number: string;
    department: string;
    status: string;
    room_number: string;
    created_at: string;
    friendly_status?: string;
    acknowledged_at?: string | null;
    in_progress_at?: string | null;
    closed_at?: string | null;
    tracking_url?: string;
  } | null>(null);

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
                status: live.status,
                friendly_status: live.friendly_status,
                acknowledged_at: live.acknowledged_at,
                in_progress_at: live.in_progress_at,
                closed_at: live.closed_at,
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

  // Service Request Categories (Hospital Standards)
  const categories = [
    {
      id: "maintenance",
      deptId: "maintenance",
      name: "Electrical & Lighting",
      icon: Sparkles,
      description: "Lights flickering, reading lamp, switches, bed power outlets, TV remote",
      color: "border-[#176B63] hover:bg-[#E8F3F1]/40",
      accent: "text-[#176B63] bg-[#E8F3F1]",
      defaultItems: ["Reading Lamp / Lighting", "Bed Electrical Socket", "Ceiling Fan", "TV / Remote Control"],
    },
    {
      id: "climate",
      deptId: "maintenance",
      name: "Air Conditioning & Climate",
      icon: Fan,
      description: "Room too cold, AC not cooling, fan noise, airflow adjustment",
      color: "border-[#2563EB] hover:bg-[#EFF6FF]/40",
      accent: "text-[#2563EB] bg-[#EFF6FF]",
      defaultItems: ["Room Too Cold", "AC Not Cooling", "Fan Noise", "Thermostat Adjustment"],
    },
    {
      id: "plumbing",
      deptId: "maintenance",
      name: "Plumbing & Restroom",
      icon: Droplets,
      description: "Tap leak, flush issue, hot water supply, shower pressure, drain block",
      color: "border-[#0891B2] hover:bg-[#ECFEFF]/40",
      accent: "text-[#0891B2] bg-[#ECFEFF]",
      defaultItems: ["Tap Leak", "Hot Water Supply", "Toilet Flush", "Clogged Drain"],
    },
    {
      id: "housekeeping",
      deptId: "housekeeping",
      name: "Housekeeping & Linen",
      icon: Sparkles,
      description: "Fresh bed sheets, floor mopping, bathroom sanitization, waste clearance",
      color: "border-[#D97706] hover:bg-[#FFFBEB]/40",
      accent: "text-[#D97706] bg-[#FFFBEB]",
      defaultItems: ["Fresh Bed Linen / Blanket", "Floor Cleaning / Spill", "Restroom Sanitization", "Trash Bin Clearance"],
    },
    {
      id: "biomedical",
      deptId: "maintenance",
      name: "Biomedical & Room Equipment",
      icon: Wrench,
      description: "Motorized bed elevation controls, IV pole adjustment, overbed table",
      color: "border-[#4F46E5] hover:bg-[#EEF2FF]/40",
      accent: "text-[#4F46E5] bg-[#EEF2FF]",
      defaultItems: ["Motorized Bed Elevation", "Overbed Food Table", "Wheelchair Request", "IV Stand Wheel"],
    },
    {
      id: "nursing_assistance",
      deptId: "nursing",
      name: "Nursing Assistance (Non-Emergency)",
      icon: HeartPulse,
      description: "Bed adjustment, drinking water, warm blanket, routine comfort support",
      color: "border-[#DC2626] hover:bg-[#FEF2F2]/40",
      accent: "text-[#DC2626] bg-[#FEF2F2]",
      defaultItems: ["Warm Blanket / Water", "Patient Mobility Assistance", "Routine Comfort Query", "Pillow Repositioning"],
    },
    {
      id: "dietary",
      deptId: "housekeeping",
      name: "Food & Dietary Services",
      icon: Utensils,
      description: "Diet meal inquiry, hot water thermos refill, extra cutlery or napkin",
      color: "border-[#059669] hover:bg-[#ECFDF5]/40",
      accent: "text-[#059669] bg-[#ECFDF5]",
      defaultItems: ["Diet Meal Inquiry", "Hot Water Thermos Refill", "Extra Cutlery / Napkins", "Patient Tea / Soup"],
    },
    {
      id: "other",
      deptId: "billing",
      name: "Other Hospital Service Request",
      icon: HelpCircle,
      description: "Discharge clarification, interim invoice review, visitor guidelines",
      color: "border-[#475569] hover:bg-[#F8FAFC]/40",
      accent: "text-[#475569] bg-[#F8FAFC]",
      defaultItems: ["Interim Bill Clarification", "Visitor Pass Query", "Pharmacy Delivery Status", "Other General Request"],
    },
  ];

  // Auth Action 1: 1-Click Bedside Guest Session
  const handleContinueAsGuest = async () => {
    setIsAuthenticating(true);
    setAuthError(null);
    try {
      const res = await api.createGuestSession(currentToken);
      setPatientSession({
        token: res.access_token,
        type: "guest",
        identifier: res.patient_identifier || `Room ${roomData?.room_number}`,
      });
      setStep("categories");
    } catch (err: any) {
      setAuthError(err.message || "Failed to initialize guest session.");
    } finally {
      setIsAuthenticating(false);
    }
  };

  // Auth Action 2: Verified Mobile Login
  const handleVerifyMobile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showOtpField) {
      if (!phoneInput || phoneInput.length < 8) {
        setAuthError("Please enter a valid mobile number.");
        return;
      }
      setShowOtpField(true);
      setAuthError(null);
      return;
    }

    setIsAuthenticating(true);
    setAuthError(null);
    try {
      const res = await api.verifyPatientSession({
        phone: phoneInput,
        otp_code: otpInput || "123456",
        qr_token: currentToken,
      });
      setPatientSession({
        token: res.access_token,
        type: "verified",
        identifier: phoneInput,
      });
      setPatientContact(phoneInput);
      setStep("categories");
    } catch (err: any) {
      setAuthError(err.message || "OTP Verification failed. Please check code.");
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleSelectCategory = (cat: (typeof categories)[0]) => {
    setSelectedDept(cat.deptId);
    setCategoryName(cat.name);
    setTitle(`${cat.name} Issue`);
    setStep("form");
  };

  // Web Audio Recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const url = URL.createObjectURL(audioBlob);
        setAudioUrl(url);

        const reader = new FileReader();
        reader.onloadend = () => {
          setAudioBase64(reader.result as string);
        };
        reader.readAsDataURL(audioBlob);

        setTranscription("Patient voice message recorded for care team.");
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (_) {
      alert("Microphone permission required to record audio.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());
    }
  };

  const resetRecording = () => {
    setAudioUrl(null);
    setAudioBase64(null);
    setTranscription("");
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
        patient_contact: patientContact || undefined,
        photo_base64: photoBase64 || undefined,
        idempotency_key: idempotencyKey,
      });

      setSubmittedTicket({
        ticket_number: res.ticket_number,
        department: res.department,
        status: res.status,
        room_number: res.room_number,
        created_at: res.created_at,
        friendly_status: "Received & Queued",
        tracking_url: res.tracking_url,
      });
      setStep("confirmation");
    } catch (err: any) {
      alert(`Submission error: ${err.message}`);
    } finally {
      setIsSubmitting(false);
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
            {/* STEP 1: AUTHENTICATION / ACCESS SELECTION */}
            {step === "auth" && (
              <div className="space-y-5 animate-in fade-in duration-200">
                {/* Location Confirmation Banner */}
                <div className="p-4 rounded-2xl bg-[#E8F3F1] border-2 border-[#A7D7D1] space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-[#176B63] uppercase tracking-wider">
                      Verified Location
                    </span>
                    <span className="text-[10px] font-mono text-[#176B63] bg-white px-2 py-0.5 rounded-md border border-[#A7D7D1]">
                      {roomData?.token}
                    </span>
                  </div>
                  <h2 className="text-lg font-black text-[#0F172A]">
                    {roomData?.room_number} • {roomData?.wing}
                  </h2>
                  <p className="text-xs text-[#475569]">{roomData?.floor} • Metropolitan General Hospital</p>
                </div>

                <div className="space-y-1">
                  <h3 className="text-base font-bold text-[#0F172A]">Choose How to Enter</h3>
                  <p className="text-xs text-[#64748B]">
                    For non-clinical room requests, guest access is fast and requires no passwords.
                  </p>
                </div>

                {authError && (
                  <div className="p-3 bg-[#FEF2F2] border border-[#FCA5A5] rounded-xl text-xs text-[#991B1B]">
                    {authError}
                  </div>
                )}

                {/* Option A: Bedside Guest Access (1-Click) */}
                <div className="p-5 rounded-3xl bg-white border-2 border-[#CBD5E1] hover:border-[#176B63] shadow-xs transition-all space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <span className="text-[10px] font-black text-[#16805D] bg-[#EDF7F2] px-2 py-0.5 rounded-full uppercase">
                        Recommended for Patients
                      </span>
                      <h4 className="text-sm font-bold text-[#0F172A]">1-Click Bedside Guest Access</h4>
                      <p className="text-xs text-[#64748B]">
                        Instantly submit complaints for lighting, cooling, plumbing, or room cleaning.
                      </p>
                    </div>
                    <UserCheck className="h-6 w-6 text-[#176B63] shrink-0" />
                  </div>

                  <button
                    onClick={handleContinueAsGuest}
                    disabled={isAuthenticating}
                    className="w-full py-3 rounded-2xl bg-[#176B63] hover:bg-[#10574F] text-white text-xs font-bold shadow-md shadow-[#176B63]/25 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                  >
                    <span>{isAuthenticating ? "Connecting..." : "Continue as Bedside Guest"}</span>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>

                {/* Option B: Mobile Number Verification */}
                <div className="p-5 rounded-3xl bg-white border-2 border-[#CBD5E1] shadow-xs space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <h4 className="text-sm font-bold text-[#0F172A]">Verified Patient Login</h4>
                      <p className="text-xs text-[#64748B]">
                        Receive SMS updates and track past hospital complaints across visits.
                      </p>
                    </div>
                    <Phone className="h-6 w-6 text-[#2563EB] shrink-0" />
                  </div>

                  <form onSubmit={handleVerifyMobile} className="space-y-3 pt-1">
                    <div>
                      <label className="text-[11px] font-bold text-[#475569] block mb-1">
                        Mobile Phone Number
                      </label>
                      <input
                        type="tel"
                        placeholder="e.g. +1 555-0192 or +91 98450 11223"
                        value={phoneInput}
                        onChange={(e) => setPhoneInput(e.target.value)}
                        className="w-full p-2.5 rounded-xl border border-[#CBD5E1] text-xs font-medium focus:outline-none focus:border-[#176B63]"
                      />
                    </div>

                    {showOtpField && (
                      <div className="animate-in fade-in duration-150">
                        <label className="text-[11px] font-bold text-[#475569] block mb-1">
                          6-Digit Verification Code (Demo: 123456)
                        </label>
                        <input
                          type="text"
                          maxLength={6}
                          placeholder="123456"
                          value={otpInput}
                          onChange={(e) => setOtpInput(e.target.value)}
                          className="w-full p-2.5 rounded-xl border border-[#CBD5E1] text-xs font-mono font-bold tracking-widest focus:outline-none focus:border-[#176B63]"
                        />
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={isAuthenticating}
                      className="w-full py-2.5 rounded-xl border-2 border-[#2563EB] text-[#2563EB] hover:bg-[#2563EB] hover:text-white text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
                    >
                      {showOtpField ? "Verify OTP & Continue" : "Send Verification Code"}
                    </button>
                  </form>
                </div>
              </div>
            )}

            {/* STEP 2: CATEGORY SELECTION */}
            {step === "categories" && (
              <div className="space-y-5 animate-in fade-in duration-200">
                <div className="flex items-center justify-between pb-2 border-b border-[#E2E8F0]">
                  <div>
                    <h2 className="text-base sm:text-lg font-black text-[#0F172A]">
                      How Can We Help You?
                    </h2>
                    <p className="text-xs text-[#64748B]">
                      Select an issue category below. It routes directly to the on-duty staff.
                    </p>
                  </div>
                  <button
                    onClick={() => setStep("auth")}
                    className="text-xs text-[#64748B] hover:text-[#0F172A] font-semibold"
                  >
                    Change Login
                  </button>
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
                <div className="p-3.5 rounded-2xl bg-white border-2 border-[#CBD5E1] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#0F172A]">Optional Voice Note</span>
                    {audioUrl && (
                      <button
                        type="button"
                        onClick={resetRecording}
                        className="text-[11px] text-[#DC2626] font-bold hover:underline"
                      >
                        Delete
                      </button>
                    )}
                  </div>

                  {!audioUrl ? (
                    <div className="flex items-center gap-3">
                      {!isRecording ? (
                        <button
                          type="button"
                          onClick={startRecording}
                          className="px-4 py-2 rounded-xl bg-[#176B63] hover:bg-[#10574F] text-white text-xs font-bold flex items-center gap-2 cursor-pointer transition-all"
                        >
                          <Mic className="h-4 w-4" />
                          <span>Record Voice Message</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={stopRecording}
                          className="px-4 py-2 rounded-xl bg-[#DC2626] hover:bg-[#B91C1C] text-white text-xs font-bold flex items-center gap-2 animate-pulse cursor-pointer transition-all"
                        >
                          <Square className="h-4 w-4" />
                          <span>Stop Recording</span>
                        </button>
                      )}
                      <span className="text-[11px] text-[#64748B]">
                        {isRecording ? "Listening to your voice..." : "Speak details in your language"}
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <audio controls src={audioUrl} className="h-8 w-full max-w-xs" />
                      <span className="text-[11px] text-[#16805D] font-bold">Recorded ✓</span>
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

                {/* Callback Phone (Optional) */}
                <div>
                  <label className="text-xs font-bold text-[#0F172A] block mb-1">
                    Callback Phone (Optional for SMS Updates)
                  </label>
                  <input
                    type="tel"
                    placeholder="e.g. +1 555-0192"
                    value={patientContact}
                    onChange={(e) => setPatientContact(e.target.value)}
                    className="w-full p-3 rounded-2xl border-2 border-[#CBD5E1] bg-white text-xs font-medium focus:outline-none focus:border-[#176B63]"
                  />
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

            {/* STEP 4: CONFIRMATION & LIVE TRACKING */}
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
                        active: ["acknowledged", "in_progress", "resolution_submitted", "closed"].includes(
                          submittedTicket.status
                        ),
                        time: submittedTicket.acknowledged_at,
                      },
                      {
                        label: "4. Work in Progress",
                        desc: "Repairs / service underway at room",
                        active: ["in_progress", "resolution_submitted", "closed"].includes(submittedTicket.status),
                        time: submittedTicket.in_progress_at,
                      },
                      {
                        label: "5. Resolved & Closed",
                        desc: "Verified by hospital supervisor",
                        active: submittedTicket.status === "closed",
                        time: submittedTicket.closed_at,
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
