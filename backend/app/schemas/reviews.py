from datetime import datetime
from typing import Optional, List, Dict, Any
import json
from pydantic import BaseModel, Field, field_validator

class BaseUTCModel(BaseModel):
    class Config:
        from_attributes = True

class GoogleLocationResponse(BaseUTCModel):
    id: int
    integration_id: int
    google_location_id: str
    location_name: str
    address: Optional[str] = None
    phone_number: Optional[str] = None
    average_rating: float = 0.0
    total_reviews_count: int = 0
    is_active: bool = True
    created_at: datetime

class GoogleIntegrationResponse(BaseUTCModel):
    id: int
    account_email: str
    account_name: Optional[str] = None
    status: str  # "connected", "disconnected", "error", "needs_reauth"
    token_expires_at: Optional[datetime] = None
    last_sync_at: Optional[datetime] = None
    last_error: Optional[str] = None
    locations_count: int = 0
    locations: List[GoogleLocationResponse] = []
    created_at: datetime
    updated_at: datetime

class ReviewAIAnalysisResponse(BaseUTCModel):
    id: int
    review_id: int
    review_summary: str
    detected_topics: List[str] = []
    sentiment: str
    severity: str
    suggested_department: Optional[str] = None
    possible_root_causes: List[str] = []
    recommended_actions: List[str] = []
    evidence_needed: List[str] = []
    suggested_public_reply: Optional[str] = None
    confidence: float
    human_review_required: bool
    model_version: str
    created_at: datetime

    @field_validator("detected_topics", "possible_root_causes", "recommended_actions", "evidence_needed", mode="before")
    @classmethod
    def parse_json_lists(cls, v):
        if isinstance(v, str):
            try:
                return json.loads(v)
            except Exception:
                return [v] if v else []
        return v or []

class ReviewAlertResponse(BaseUTCModel):
    id: int
    review_id: int
    star_rating: int
    priority: str
    alert_status: str
    acknowledged_at: Optional[datetime] = None
    acknowledged_by: Optional[int] = None
    notification_status: str
    notification_sent_at: Optional[datetime] = None
    created_at: datetime

class ReviewCorrectiveActionResponse(BaseUTCModel):
    id: int
    task_number: str
    review_id: int
    issue_summary: str
    department_id: str
    department_name: Optional[str] = None
    assigned_to_id: Optional[int] = None
    assigned_to_name: Optional[str] = None
    priority: str
    due_date: Optional[datetime] = None
    status: str
    investigation_notes: Optional[str] = None
    root_cause: Optional[str] = None
    corrective_action: Optional[str] = None
    preventive_action: Optional[str] = None
    completion_evidence: Optional[str] = None
    approved_by_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime

class ReviewCorrectiveActionCreate(BaseModel):
    issue_summary: str
    department_id: str
    priority: str = "high"
    due_date: Optional[datetime] = None
    assigned_to_id: Optional[int] = None
    root_cause: Optional[str] = None
    corrective_action: Optional[str] = None
    preventive_action: Optional[str] = None
    investigation_notes: Optional[str] = None

class ReviewCorrectiveActionUpdate(BaseModel):
    status: Optional[str] = None
    investigation_notes: Optional[str] = None
    root_cause: Optional[str] = None
    corrective_action: Optional[str] = None
    preventive_action: Optional[str] = None
    completion_evidence: Optional[str] = None
    assigned_to_id: Optional[int] = None
    priority: Optional[str] = None

class GoogleReviewResponse(BaseUTCModel):
    id: int
    location_id: int
    location_name: Optional[str] = None
    google_review_id: str
    author_name: str
    author_photo_url: Optional[str] = None
    star_rating: int
    previous_star_rating: Optional[int] = None
    review_text: Optional[str] = None
    original_review_url: Optional[str] = None
    review_created_at: datetime
    review_updated_at: Optional[datetime] = None
    is_updated: bool
    is_low_rating_alert: bool
    alert_priority: str
    investigation_status: str
    assigned_department_id: Optional[str] = None
    assigned_owner_id: Optional[int] = None
    assigned_owner_name: Optional[str] = None
    internal_notes: Optional[str] = None
    public_reply_status: str
    public_reply_draft: Optional[str] = None
    public_reply_approved_by: Optional[int] = None
    public_reply_approved_at: Optional[datetime] = None
    linked_ticket_id: Optional[int] = None
    linked_ticket_number: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    ai_analysis: Optional[ReviewAIAnalysisResponse] = None
    alert: Optional[ReviewAlertResponse] = None

class ReviewNoteCreate(BaseModel):
    notes: str

class ReviewReplyDraftRequest(BaseModel):
    custom_instructions: Optional[str] = None

class ReviewReplyApproveRequest(BaseModel):
    edited_reply: Optional[str] = None

class ReviewChatMessageCreate(BaseModel):
    review_id: Optional[int] = None
    content: str

class ReviewChatMessageResponse(BaseUTCModel):
    id: int
    review_id: Optional[int] = None
    user_id: int
    user_name: Optional[str] = None
    role: str
    content: str
    context_metadata: Optional[Dict[str, Any]] = None
    created_at: datetime

class ReviewSummaryResponse(BaseModel):
    average_rating: float
    total_reviews_count: int
    new_reviews_period: int
    reviews_below_3_stars: int
    unresolved_corrective_actions: int
    average_internal_response_minutes: float
    rating_breakdown: Dict[int, int]  # {5: count, 4: count, ...}
    department_complaints_count: Dict[str, int]
    topics_frequency: Dict[str, int]
    sentiment_distribution: Dict[str, int]

class PubSubNotificationPayload(BaseModel):
    message: Dict[str, Any]
    subscription: Optional[str] = None

class OAuthCallbackRequest(BaseModel):
    code: str
    state: str
