export function getApiBase(): string {
  // If explicitly configured via environment variable (e.g. on Vercel deployment)
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL.replace(/\/+$/, "");
  }

  if (typeof window !== "undefined") {
    const hostname = window.location.hostname;
    // Local LAN network IP (e.g. 192.168.x.x or 10.x.x.x) for testing mobile QR scanner on same WiFi
    if (hostname && hostname !== "localhost" && hostname !== "127.0.0.1" && /^(\d{1,3}\.){3}\d{1,3}$/.test(hostname)) {
      return `http://${hostname}:8000/api`;
    }
    // If deployed on custom domain with reverse proxy or same-origin routing
    if (hostname && hostname !== "localhost" && hostname !== "127.0.0.1") {
      return `${window.location.origin}/api`;
    }
  }
  return "http://127.0.0.1:8000/api";
}

export function getBackendBase(): string {
  if (process.env.NEXT_PUBLIC_BACKEND_URL) {
    return process.env.NEXT_PUBLIC_BACKEND_URL.replace(/\/+$/, "");
  }
  const apiUrl = getApiBase();
  return apiUrl.replace(/\/api\/?$/, "");
}

export function getFileUrl(url: string | null | undefined): string {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("data:") || url.startsWith("blob:")) {
    return url;
  }
  const clean = url.startsWith("/") ? url : `/${url}`;
  return `${getBackendBase()}${clean}`;
}

export function parseUtcDate(val: string | number | Date | null | undefined): Date | null {
  if (!val) return null;
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
  if (typeof val === "number") return new Date(val);

  let str = String(val).trim();
  if (!str) return null;

  // If the timestamp string has no timezone offset (no Z and no +/-),
  // SQLite & backend store naive UTC timestamps, so we treat it as UTC by appending 'Z'.
  if (!str.endsWith("Z") && !str.includes("+") && !/[0-9]-[0-9]{2}:[0-9]{2}$/.test(str)) {
    if (str.includes("T") || str.includes(" ")) {
      str = str.replace(" ", "T") + "Z";
    }
  }
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}

export function formatTime(val: string | number | Date | null | undefined, options?: Intl.DateTimeFormatOptions): string {
  const d = parseUtcDate(val);
  if (!d) return "—";
  return d.toLocaleTimeString([], options || { hour: "2-digit", minute: "2-digit" });
}

export function formatDateTime(val: string | number | Date | null | undefined, options?: Intl.DateTimeFormatOptions): string {
  const d = parseUtcDate(val);
  if (!d) return "—";
  return d.toLocaleString([], options || {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

export interface User {
  id: number;
  email: string;
  name: string;
  role: string;
  department_id?: string | null;
  phone?: string | null;
  avatar_url?: string | null;
  is_active: boolean;
  employee_id?: string | null;
  designation?: string | null;
  account_status?: string;
  failed_login_attempts?: number;
  locked_at?: string | null;
  locked_reason?: string | null;
  last_login_at?: string | null;
  permissions?: string[];
  created_at: string;
}

export interface StaffMember {
  id: number;
  employee_id: string;
  name: string;
  email: string;
  phone?: string | null;
  role: string;
  department_id?: string | null;
  department_name?: string | null;
  designation: string;
  account_status: "active" | "inactive" | "locked" | "pending_activation";
  is_active: boolean;
  failed_login_attempts: number;
  locked_at?: string | null;
  locked_reason?: string | null;
  last_login_at?: string | null;
  avatar_url?: string | null;
  created_at: string;
  permissions: string[];
}

export interface StaffMetrics {
  total_staff: number;
  active_accounts: number;
  inactive_accounts: number;
  locked_accounts: number;
  pending_activation: number;
}

export interface StaffListResponse {
  items: StaffMember[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
  metrics: StaffMetrics;
}

export interface RoleMetadata {
  id: string;
  name: string;
  description: string;
  protected_system_role: boolean;
  permissions: string[];
  permission_count: number;
}

export interface SecurityEvent {
  id: number;
  action: string;
  actor_id?: number | null;
  actor_name: string;
  actor_role: string;
  ticket_id?: number | null;
  details: any;
  created_at: string;
}

export interface Department {
  id: string;
  name: string;
  code: string;
  description?: string;
  icon: string;
  supervisor_id?: number | null;
  is_active: boolean;
  active_ticket_count?: number;
  staff_count?: number;
}

export interface Room {
  id: number;
  room_number: string;
  floor: string;
  wing: string;
  bed_count: number;
  qr_token: string;
  is_active: boolean;
}

export interface Evidence {
  id: number;
  ticket_id: number;
  stage: "before" | "after";
  media_type: "image" | "video";
  file_url: string;
  thumbnail_url?: string;
  file_size_bytes: number;
  equipment_type?: string;
  uploaded_by_id?: number;
  notes?: string;
  created_at: string;
}

export interface AIVerificationJob {
  id: number;
  ticket_id: number;
  status: string;
  before_evidence_id?: number | null;
  after_evidence_id?: number | null;
  evidence_relevance: string;
  equipment_match: string;
  visible_fault_assessment: string;
  after_repair_functional_evidence: string;
  media_quality: string;
  missing_evidence: string[] | string;
  inconsistencies: string[] | string;
  ai_recommendation: "likely_resolved" | "likely_unresolved" | "inconclusive";
  review_requirement: "mandatory_human_review" | "standard_signoff" | "fast_track_eligible";
  confidence_score: number;
  analysis_notes: string;
  model_version: string;
  analysis_timestamp?: string;
  human_decision?: "approved" | "rejected" | "requested_new_evidence" | "inconclusive" | null;
  human_reviewer_id?: number | null;
  human_review_notes?: string | null;
  human_override_reason?: string | null;
  human_reviewed_at?: string | null;
  created_at: string;
  // enriched fields
  ticket_number?: string;
  ticket_title?: string;
  ticket_category?: string;
  ticket_priority?: string;
  ticket_status?: string;
  room_number?: string;
  department_id?: string;
  before_evidence?: Evidence | null;
  after_evidence?: Evidence | null;
}

export interface TicketNote {
  id: number;
  ticket_id: number;
  author_id?: number;
  author_name: string;
  content: string;
  is_internal: boolean;
  created_at: string;
}

export interface Ticket {
  id: number;
  ticket_number: string;
  title: string;
  description: string;
  voice_recording_url?: string | null;
  voice_transcription?: string | null;
  department_id: string;
  room_id?: number | null;
  room_number: string;
  category: string;
  priority: "low" | "medium" | "high" | "critical";
  status: "submitted" | "assigned" | "acknowledged" | "in_progress" | "resolution_submitted" | "closed" | "reopened";
  is_escalated: boolean;
  escalation_level: number;
  escalation_reason?: string | null;
  assigned_staff_id?: number | null;
  assigned_staff_name?: string | null;
  assigned_supervisor_id?: number | null;
  assigned_supervisor_name?: string | null;
  sla_acknowledgement_deadline?: string | null;
  sla_resolution_deadline?: string | null;
  acknowledged_at?: string | null;
  in_progress_at?: string | null;
  resolution_submitted_at?: string | null;
  closed_at?: string | null;
  resolution_summary?: string | null;
  parts_replaced?: string | null;
  functional_test_notes?: string | null;
  delay_reason?: string | null;
  revised_eta?: string | null;
  patient_contact?: string | null;
  patient_feedback_rating?: number | null;
  patient_feedback_comment?: string | null;
  created_at: string;
  updated_at: string;
  evidences?: Evidence[];
  latest_ai_verification?: AIVerificationJob | null;
  notes?: TicketNote[];
}

export interface SLAPolicy {
  id: number;
  department_id: string;
  priority: string;
  ack_target_minutes: number;
  resolution_target_minutes: number;
  reminder_1_minutes_before: number;
  reminder_2_minutes_before: number;
  escalation_after_deadline_minutes: number;
  requires_closure_approval: boolean;
  is_active: boolean;
}

export interface EscalationLog {
  id: number;
  ticket_id: number;
  ticket_number: string;
  ticket_title: string;
  room_number: string;
  department_id: string;
  escalation_level: number;
  trigger_reason: string;
  notified_supervisor: string;
  delivery_status: string;
  created_at: string;
}

export interface DashboardMetrics {
  kpis: {
    total_open_tickets: number;
    tickets_due_soon: number;
    overdue_tickets: number;
    sla_compliance_rate: number;
    avg_resolution_time_minutes: number;
    pending_ai_verifications: number;
  };
  department_workload: Array<{ department_id: string; department_name: string; code: string; count: number }>;
  sla_by_department: Array<{ department_id: string; department_name: string; compliance_rate: number }>;
  volume_trends: Array<{ day: string; created: number; resolved: number }>;
  priority_overdue: Array<{
    id: number;
    ticket_number: string;
    title: string;
    room_number: string;
    department_id: string;
    priority: string;
    status: string;
    minutes_overdue: number;
  }>;
}

export interface AuditLog {
  id: number;
  ticket_id?: number | null;
  action: string;
  actor_id?: number | null;
  actor_name: string;
  actor_role: string;
  details: any;
  created_at: string;
}

export interface GoogleLocation {
  id: number;
  integration_id: number;
  google_location_id: string;
  location_name: string;
  store_code?: string | null;
  address?: string | null;
  phone_number?: string | null;
  website_url?: string | null;
  average_rating: number;
  total_reviews_count: number;
  is_verified: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface GoogleIntegration {
  id: number;
  hospital_id: string;
  account_id: string;
  account_email?: string | null;
  account_name?: string | null;
  status: "connected" | "disconnected" | "error" | "token_expired";
  last_sync_at?: string | null;
  last_sync_status?: string | null;
  last_sync_message?: string | null;
  sync_frequency_minutes: number;
  created_at: string;
  updated_at: string;
  locations: GoogleLocation[];
}

export interface ReviewAIAnalysis {
  id: number;
  review_id: number;
  detected_topics: string[];
  sentiment: "positive" | "neutral" | "negative";
  sentiment_score?: number | null;
  severity: "low" | "medium" | "high" | "critical";
  suggested_department?: string | null;
  department_confidence?: number | null;
  review_summary?: string | null;
  possible_root_causes: string[];
  recommended_actions: string[];
  evidence_needed?: string | null;
  suggested_public_reply?: string | null;
  reply_safety_passed: boolean;
  model_name?: string | null;
  confidence: number;
  human_review_required: boolean;
  created_at: string;
}

export interface ReviewAlert {
  id: number;
  review_id: number;
  star_rating: number;
  severity: "critical" | "high" | "medium" | "normal";
  status: "pending" | "acknowledged" | "investigating" | "resolved" | "dismissed";
  issue_summary: string;
  suggested_department?: string | null;
  recommended_action?: string | null;
  notification_sent: boolean;
  notification_provider?: string | null;
  notification_error?: string | null;
  acknowledged_by?: number | null;
  acknowledged_at?: string | null;
  created_at: string;
}

export interface ReviewCorrectiveAction {
  id: number;
  task_code: string;
  review_id: number;
  title: string;
  description: string;
  department_id: string;
  assigned_to_id?: number | null;
  priority: "urgent" | "high" | "medium" | "low";
  due_date?: string | null;
  investigation_notes?: string | null;
  root_cause_assessment?: string | null;
  corrective_action?: string | null;
  preventive_action?: string | null;
  status: "New" | "Assigned" | "Investigating" | "Action Required" | "Pending Verification" | "Completed" | "Reopened";
  completion_evidence?: string | null;
  created_by_id: number;
  created_at: string;
  updated_at: string;
}

export interface GoogleReview {
  id: number;
  integration_id: number;
  location_id: number;
  google_review_id: string;
  reviewer_name: string;
  reviewer_photo_url?: string | null;
  star_rating: number;
  review_text?: string | null;
  review_create_time: string;
  review_update_time?: string | null;
  google_review_url?: string | null;
  detected_at: string;
  is_updated: boolean;
  previous_star_rating?: number | null;
  is_below_threshold: boolean;
  alert_triggered: boolean;
  assigned_department?: string | null;
  assigned_owner_id?: number | null;
  investigation_status: "new" | "triaged" | "investigating" | "action_taken" | "closed";
  public_reply_status: "not_replied" | "drafted" | "approved" | "published" | "dismissed";
  public_reply_draft?: string | null;
  public_reply_published?: string | null;
  public_reply_published_at?: string | null;
  internal_notes?: string | null;
  linked_ticket_id?: number | null;
  location?: GoogleLocation | null;
  ai_analysis?: ReviewAIAnalysis | null;
  alerts?: ReviewAlert[];
  corrective_actions?: ReviewCorrectiveAction[];
}

export interface ReviewChatMessage {
  id: number;
  conversation_id: string;
  sender_role: "user" | "assistant" | "system";
  content: string;
  grounded_review_id?: number | null;
  suggested_action_type?: string | null;
  created_at: string;
}

export interface ReviewSummary {
  total_reviews: number;
  average_rating: number;
  rating_distribution: Record<string, number>;
  below_threshold_count: number;
  unacknowledged_alerts_count: number;
  pending_corrective_actions_count: number;
  public_reply_stats: {
    not_replied: number;
    drafted: number;
    approved: number;
    published: number;
  };
  department_breakdown: Record<string, number>;
}

// Token helper
export function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("careops_token");
}

export function setStoredToken(token: string): void {
  if (typeof window !== "undefined") {
    localStorage.setItem("careops_token", token);
  }
}

export function clearStoredToken(): void {
  if (typeof window !== "undefined") {
    localStorage.removeItem("careops_token");
  }
}

async function fetchWithAuth(endpoint: string, options: RequestInit = {}) {
  const token = getStoredToken();
  const headers = new Headers(options.headers || {});
  
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  
  if (!headers.has("Content-Type") && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 25000);

  try {
    const response = await fetch(`${getApiBase()}${endpoint}`, {
      ...options,
      headers,
      signal: options.signal || controller.signal,
    });
    
    if (!response.ok) {
      let errMessage = `Error ${response.status}: ${response.statusText}`;
      try {
        const text = await response.text();
        try {
          const data = JSON.parse(text);
          if (data.detail) {
            errMessage = typeof data.detail === "string" ? data.detail : JSON.stringify(data.detail);
          }
        } catch {
          if (text && text.length < 150) {
            errMessage = text;
          }
        }
      } catch (_) {}
      throw new Error(errMessage);
    }
    
    return response.json();
  } catch (err: any) {
    if (err.name === "AbortError") {
      throw new Error("Request timed out. The backend service may be waking up from sleep. Please try again in a moment.");
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

export const api = {
  // Auth
  login: (creds: { email: string; password: string }) =>
    fetchWithAuth("/auth/login", { method: "POST", body: JSON.stringify(creds) }),
  register: (data: {
    name: string;
    email: string;
    password: string;
    role?: string;
    department_id?: string;
    designation?: string;
    phone?: string;
  }) => fetchWithAuth("/auth/register", { method: "POST", body: JSON.stringify(data) }),
  getMe: () => fetchWithAuth("/auth/me"),
  getDemoUsers: () => fetchWithAuth("/auth/demo-users"),

  // Patient QR & Guest Session
  getRoomByToken: (token: string) => fetchWithAuth(`/patient/room/${token}`),
  createGuestSession: (qrToken: string) =>
    fetchWithAuth("/patient/session/guest", { method: "POST", body: JSON.stringify({ qr_token: qrToken }) }),
  verifyPatientSession: (data: { phone: string; otp_code: string; qr_token?: string }) =>
    fetchWithAuth("/patient/session/verify", { method: "POST", body: JSON.stringify(data) }),
  submitPatientTicket: (data: any) =>
    fetchWithAuth("/patient/submit", { method: "POST", body: JSON.stringify(data) }),
  getPatientTicketStatus: (ticketNumber: string, token?: string) =>
    fetchWithAuth(`/patient/ticket/${encodeURIComponent(ticketNumber)}${token ? `?token=${encodeURIComponent(token)}` : ""}`),
  escalatePatientTicket: (ticketNumber: string, reason?: string) =>
    fetchWithAuth(`/patient/ticket/${encodeURIComponent(ticketNumber)}/escalate`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    }),
  getPatientStreamUrl: (ticketNumber: string) =>
    `${getApiBase()}/patient/ticket/${encodeURIComponent(ticketNumber)}/stream`,
  getStaffStreamUrl: (token: string) =>
    `${getApiBase()}/tickets/stream?token=${encodeURIComponent(token)}`,

  // Tickets
  getTickets: (params?: {
    department_id?: string;
    status?: string;
    priority?: string;
    is_escalated?: boolean;
    assigned_to_me?: boolean;
    search?: string;
  }) => {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== "") {
          searchParams.append(k, String(v));
        }
      });
    }
    const qs = searchParams.toString();
    return fetchWithAuth(qs ? `/tickets?${qs}` : "/tickets");
  },
  getTicketDetail: (id: number) => fetchWithAuth(`/tickets/${id}`),
  createStaffTicket: (data: any) =>
    fetchWithAuth("/tickets", { method: "POST", body: JSON.stringify(data) }),
  acknowledgeTicket: (id: number, note?: string) =>
    fetchWithAuth(`/tickets/${id}/acknowledge`, { method: "POST", body: JSON.stringify({ note }) }),
  startWork: (id: number, note?: string) =>
    fetchWithAuth(`/tickets/${id}/start-work`, { method: "POST", body: JSON.stringify({ note }) }),
  submitResolution: (id: number, data: { resolution_summary: string; parts_replaced?: string; functional_test_notes?: string }) =>
    fetchWithAuth(`/tickets/${id}/submit-resolution`, { method: "POST", body: JSON.stringify(data) }),
  closeTicket: (id: number, data: { approval_note?: string; is_approved?: boolean }) =>
    fetchWithAuth(`/tickets/${id}/close`, { method: "POST", body: JSON.stringify(data) }),
  reportDelay: (id: number, data: { delay_reason: string; revised_eta_minutes: number }) =>
    fetchWithAuth(`/tickets/${id}/delay-report`, { method: "POST", body: JSON.stringify(data) }),
  addNote: (id: number, data: { content: string; is_internal: boolean }) =>
    fetchWithAuth(`/tickets/${id}/notes`, { method: "POST", body: JSON.stringify(data) }),

  // Evidence
  uploadEvidence: (formData: FormData) =>
    fetchWithAuth("/evidence/upload", { method: "POST", body: formData }),

  // AI Verification
  getVerificationQueue: (deptId?: string) =>
    fetchWithAuth(deptId ? `/ai-verify/queue?department_id=${deptId}` : "/ai-verify/queue"),
  triggerAIAnalysis: (ticketId: number) =>
    fetchWithAuth(`/ai-verify/${ticketId}/analyze`, { method: "POST" }),
  reviewVerification: (jobId: number, data: { decision: string; notes?: string; override_reason?: string }) =>
    fetchWithAuth(`/ai-verify/${jobId}/review`, { method: "POST", body: JSON.stringify(data) }),

  // Departments & Staff
  getDepartments: () => fetchWithAuth("/departments"),
  createDepartment: (data: any) =>
    fetchWithAuth("/departments", { method: "POST", body: JSON.stringify(data) }),
  getDepartmentStaff: (deptId: string) => fetchWithAuth(`/departments/${deptId}/staff`),

  // Rooms & Network QR
  getRooms: () => fetchWithAuth("/rooms"),
  getNetworkHost: () => fetchWithAuth("/rooms/network-host"),
  createRoom: (data: any) =>
    fetchWithAuth("/rooms", { method: "POST", body: JSON.stringify(data) }),

  // SLA & Escalations
  getSLAPolicies: () => fetchWithAuth("/sla/policies"),
  runSLACheckNow: () => fetchWithAuth("/sla/check-now", { method: "POST" }),
  getEscalations: () => fetchWithAuth("/sla/escalations"),
  getEscalationSettings: () => fetchWithAuth("/sla/escalation-settings"),
  updateEscalationSettings: (data: any) =>
    fetchWithAuth("/sla/escalation-settings", { method: "PUT", body: JSON.stringify(data) }),
  testSMTPSConnection: (data?: { target_email?: string }) =>
    fetchWithAuth("/sla/test-smtps", { method: "POST", body: JSON.stringify(data || {}) }),

  // Analytics & Audit
  getDashboardMetrics: () => fetchWithAuth("/analytics/dashboard"),
  getAuditLogs: (ticketId?: number) =>
    fetchWithAuth(ticketId ? `/audit?ticket_id=${ticketId}` : "/audit"),

  // Enterprise Staff Directory & Access Management
  getStaffList: (params?: { search?: string; department_id?: string; role?: string; account_status?: string; page?: number; page_size?: number }) => {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== "") {
          searchParams.append(k, String(v));
        }
      });
    }
    const qs = searchParams.toString();
    return fetchWithAuth(qs ? `/staff?${qs}` : "/staff");
  },
  getStaffDetail: (id: number) => fetchWithAuth(`/staff/${id}`),
  createStaff: (data: any) =>
    fetchWithAuth("/staff", { method: "POST", body: JSON.stringify(data) }),
  updateStaff: (id: number, data: any) =>
    fetchWithAuth(`/staff/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  activateStaff: (id: number) =>
    fetchWithAuth(`/staff/${id}/activate`, { method: "POST" }),
  deactivateStaff: (id: number, reason: string) =>
    fetchWithAuth(`/staff/${id}/deactivate`, { method: "POST", body: JSON.stringify({ reason }) }),
  unlockStaff: (id: number, reason: string) =>
    fetchWithAuth(`/staff/${id}/unlock`, { method: "POST", body: JSON.stringify({ reason }) }),
  resetStaffPassword: (id: number, data: { temporary_password?: string; require_change?: boolean }) =>
    fetchWithAuth(`/staff/${id}/reset-password`, { method: "POST", body: JSON.stringify(data) }),
  getRolesMetadata: () => fetchWithAuth("/staff/meta/roles"),
  getSecurityEvents: () => fetchWithAuth("/staff/meta/security-events"),

  // System & Superadmin Operations
  clearDatabase: (data: { mode: "purge_operational" | "reset_all"; confirm_phrase: string }) =>
    fetchWithAuth("/system/clear-database", { method: "POST", body: JSON.stringify(data) }),

  // Google Business Profile Integration
  getGoogleIntegrationStatus: () => fetchWithAuth("/integrations/google/status"),
  getGoogleAuthUrl: () => fetchWithAuth("/integrations/google/auth-url"),
  submitGoogleOAuthCallback: (code: string, state: string) =>
    fetchWithAuth(`/integrations/google/callback?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`, { method: "POST" }),
  disconnectGoogleIntegration: (revoke?: boolean) =>
    fetchWithAuth(`/integrations/google/disconnect?revoke=${revoke ? "true" : "false"}`, { method: "POST" }),
  syncGoogleReviews: () => fetchWithAuth("/integrations/google/sync", { method: "POST" }),

  // Reviews Intelligence
  getReviewsSummary: () => fetchWithAuth("/reviews/summary"),
  getReviewsList: (params?: {
    location_id?: number;
    min_rating?: number;
    max_rating?: number;
    rating?: number;
    investigation_status?: string;
    public_reply_status?: string;
    department?: string;
    search?: string;
    limit?: number;
    skip?: number;
  }) => {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== "") {
          searchParams.append(k, String(v));
        }
      });
    }
    const qs = searchParams.toString();
    return fetchWithAuth(qs ? `/reviews?${qs}` : "/reviews");
  },
  getCriticalReviews: () => fetchWithAuth("/reviews/critical"),
  getReviewDetail: (id: number) => fetchWithAuth(`/reviews/${id}`),
  updateReviewNotes: (id: number, notes: string) =>
    fetchWithAuth(`/reviews/${id}/notes`, { method: "PUT", body: JSON.stringify({ notes }) }),
  generateReviewReplyDraft: (id: number) =>
    fetchWithAuth(`/reviews/${id}/reply/draft`, { method: "POST" }),
  approveReviewReplyDraft: (id: number, draftText?: string) =>
    fetchWithAuth(`/reviews/${id}/reply/approve`, { method: "POST", body: JSON.stringify({ draft_text: draftText }) }),
  linkReviewToTicket: (id: number, ticketId: number) =>
    fetchWithAuth(`/reviews/${id}/link-ticket`, { method: "POST", body: JSON.stringify({ ticket_id: ticketId }) }),

  // Review Alerts
  getReviewAlerts: (status?: string) =>
    fetchWithAuth(status ? `/reviews/alerts?status=${status}` : "/reviews/alerts"),
  acknowledgeReviewAlert: (alertId: number) =>
    fetchWithAuth(`/reviews/alerts/${alertId}/acknowledge`, { method: "POST" }),

  // Corrective Actions (CAP)
  getCorrectiveActions: (params?: { department_id?: string; status?: string; review_id?: number }) => {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== "") {
          searchParams.append(k, String(v));
        }
      });
    }
    const qs = searchParams.toString();
    return fetchWithAuth(qs ? `/reviews/corrective-actions?${qs}` : "/reviews/corrective-actions");
  },
  createCorrectiveAction: (data: {
    review_id: number;
    title: string;
    description: string;
    department_id: string;
    assigned_to_id?: number | null;
    priority?: string;
    due_date?: string | null;
    root_cause_assessment?: string | null;
    corrective_action?: string | null;
    preventive_action?: string | null;
  }) => fetchWithAuth("/reviews/corrective-actions", { method: "POST", body: JSON.stringify(data) }),
  updateCorrectiveAction: (id: number, data: any) =>
    fetchWithAuth(`/reviews/corrective-actions/${id}`, { method: "PUT", body: JSON.stringify(data) }),

  // Copilot Assistant
  sendReviewChatMessage: (data: {
    message: string;
    review_id?: number | null;
    conversation_id?: string | null;
  }) => fetchWithAuth("/reviews/chat", { method: "POST", body: JSON.stringify(data) }),

  // ============================================================================
  // SUPER ADMIN MANAGEMENT & SYSTEM MAINTENANCE (SECTION 2 & SECTION 4)
  // ============================================================================
  getMaintenancePreview: (categories: string[]) =>
    fetchWithAuth("/system/maintenance/preview", { method: "POST", body: JSON.stringify({ categories }) }),
  executeMaintenancePurge: (categories: string[], confirmPhrase: string) =>
    fetchWithAuth("/system/maintenance/purge", { method: "POST", body: JSON.stringify({ categories, confirm_phrase: confirmPhrase }) }),
  getMaintenanceAuditLogs: () =>
    fetchWithAuth("/system/maintenance/audit-logs"),
  getAdminsList: () =>
    fetchWithAuth("/system/admins"),
  createAdmin: (data: any) =>
    fetchWithAuth("/system/admins", { method: "POST", body: JSON.stringify(data) }),
  updateAdmin: (id: number, data: any) =>
    fetchWithAuth(`/system/admins/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  activateAdmin: (id: number) =>
    fetchWithAuth(`/system/admins/${id}/activate`, { method: "POST" }),
  deactivateAdmin: (id: number) =>
    fetchWithAuth(`/system/admins/${id}/deactivate`, { method: "POST" }),
  getAdminPermissions: (id: number) =>
    fetchWithAuth(`/system/admins/${id}/permissions`),
  setAdminPermissions: (id: number, permissions: string[]) =>
    fetchWithAuth(`/system/admins/${id}/permissions`, { method: "PUT", body: JSON.stringify({ permissions }) }),
  getSecuritySettings: () =>
    fetchWithAuth("/system/security-settings"),
  updateSecuritySettings: (data: any) =>
    fetchWithAuth("/system/security-settings", { method: "PUT", body: JSON.stringify(data) }),
  getSuperAdminAuditLogs: () =>
    fetchWithAuth("/system/audit-logs"),
  getPermissionMatrixCatalog: (isSuperadmin: boolean = false) =>
    fetchWithAuth(`/system/permissions/catalog?is_superadmin=${isSuperadmin}`),

  // ============================================================================
  // STAFF, SUPERVISORS & PERMISSIONS MATRIX (SECTION 3 & SECTION 9)
  // ============================================================================
  getUserPermissionsMatrix: (userId: number) =>
    fetchWithAuth(`/staff/${userId}/permissions`),
  updateUserPermissionsMatrix: (userId: number, permissions: string[]) =>
    fetchWithAuth(`/staff/${userId}/permissions`, { method: "PUT", body: JSON.stringify({ permissions }) }),
  getSupervisorsList: () =>
    fetchWithAuth("/staff/supervisors/list"),
  getSupervisorTeam: (supervisorId: number) =>
    fetchWithAuth(`/staff/supervisors/${supervisorId}/team`),

  // ============================================================================
  // DEPARTMENT PERFORMANCE ANALYTICS (SECTION 13)
  // ============================================================================
  getDepartmentAnalytics: (departmentId: string) =>
    fetchWithAuth(`/departments/${departmentId}/analytics`),

  // ============================================================================
  // NPS & PATIENT EXPERIENCE (SECTION 8 - SEPARATE FROM GOOGLE REVIEWS)
  // ============================================================================
  getNPSDashboard: (departmentId?: string) =>
    fetchWithAuth(departmentId ? `/nps/dashboard?department_id=${departmentId}` : "/nps/dashboard"),
  getNPSResponses: (params?: { department_id?: string; emoji_rating?: string; is_critical?: boolean; limit?: number; offset?: number }) => {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== "") {
          searchParams.append(k, String(v));
        }
      });
    }
    const qs = searchParams.toString();
    return fetchWithAuth(qs ? `/nps/responses?${qs}` : "/nps/responses");
  },
  submitNPSFeedback: (data: { ticket_id?: number; tracking_token?: string; emoji_rating: string; nps_score?: number; feedback_comment?: string }) =>
    fetchWithAuth("/nps/submit", { method: "POST", body: JSON.stringify(data) }),

  // ============================================================================
  // AI VISION MODELS CONFIGURATION (SECTION 11)
  // ============================================================================
  getAIModels: () =>
    fetchWithAuth("/ai-verify/models"),
  configureAIModel: (provider: string, modelName: string) =>
    fetchWithAuth("/ai-verify/configure-model", { method: "POST", body: JSON.stringify({ provider, model_name: modelName }) }),
};


