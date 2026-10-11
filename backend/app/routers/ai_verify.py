from datetime import datetime, timezone
import json
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.database import get_db
from app.models import Ticket, Evidence, AIVerificationJob, User, AuditLog
from app.schemas import AIVerificationJobResponse, AIHumanReviewRequest
from app.services.auth_service import get_current_user, require_roles
from app.services.ai_vision_service import AIVisionService

router = APIRouter(prefix="/ai-verify", tags=["AI Verification Center"])

def parse_job_response(job: AIVerificationJob) -> dict:
    return {
        "id": job.id,
        "ticket_id": job.ticket_id,
        "status": job.status,
        "before_evidence_id": job.before_evidence_id,
        "after_evidence_id": job.after_evidence_id,
        "evidence_relevance": job.evidence_relevance,
        "equipment_match": job.equipment_match,
        "visible_fault_assessment": job.visible_fault_assessment,
        "after_repair_functional_evidence": job.after_repair_functional_evidence,
        "media_quality": job.media_quality,
        "missing_evidence": json.loads(job.missing_evidence) if isinstance(job.missing_evidence, str) else job.missing_evidence,
        "inconsistencies": json.loads(job.inconsistencies) if isinstance(job.inconsistencies, str) else job.inconsistencies,
        "ai_recommendation": job.ai_recommendation,
        "review_requirement": job.review_requirement,
        "confidence_score": job.confidence_score,
        "analysis_notes": job.analysis_notes,
        "model_version": job.model_version,
        "analysis_timestamp": job.analysis_timestamp,
        "human_decision": job.human_decision,
        "human_reviewer_id": job.human_reviewer_id,
        "human_review_notes": job.human_review_notes,
        "human_override_reason": job.human_override_reason,
        "human_reviewed_at": job.human_reviewed_at,
        "created_at": job.created_at
    }

@router.get("/queue")
def get_verification_queue(
    department_id: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Returns queue of verification jobs awaiting supervisor sign-off or action"""
    query = db.query(AIVerificationJob).join(Ticket, AIVerificationJob.ticket_id == Ticket.id)
    
    if department_id:
        query = query.filter(Ticket.department_id == department_id)
        
    jobs = query.order_by(desc(AIVerificationJob.created_at)).limit(50).all()
    
    result = []
    for job in jobs:
        ticket = db.query(Ticket).filter(Ticket.id == job.ticket_id).first()
        before_ev = db.query(Evidence).filter(Evidence.id == job.before_evidence_id).first() if job.before_evidence_id else None
        after_ev = db.query(Evidence).filter(Evidence.id == job.after_evidence_id).first() if job.after_evidence_id else None
        
        parsed = parse_job_response(job)
        parsed["ticket_number"] = ticket.ticket_number if ticket else None
        parsed["ticket_title"] = ticket.title if ticket else None
        parsed["ticket_category"] = ticket.category if ticket else None
        parsed["ticket_priority"] = ticket.priority if ticket else None
        parsed["ticket_status"] = ticket.status if ticket else None
        parsed["room_number"] = ticket.room_number if ticket else None
        parsed["department_id"] = ticket.department_id if ticket else None
        parsed["before_evidence"] = before_ev
        parsed["after_evidence"] = after_ev
        result.append(parsed)
        
    return result

@router.post("/{ticket_id}/analyze")
def trigger_analysis(
    ticket_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Triggers or recalculates AI Multimodal verification job for a ticket"""
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
        
    before_ev = db.query(Evidence).filter(Evidence.ticket_id == ticket.id, Evidence.stage == "before").first()
    after_ev = db.query(Evidence).filter(Evidence.ticket_id == ticket.id, Evidence.stage == "after").order_by(Evidence.id.desc()).first()
    
    analysis_data = AIVisionService.analyze_ticket_evidence(ticket, before_ev, after_ev)
    
    job = AIVerificationJob(
        ticket_id=ticket.id,
        status="completed",
        before_evidence_id=before_ev.id if before_ev else None,
        after_evidence_id=after_ev.id if after_ev else None,
        evidence_relevance=analysis_data["evidence_relevance"],
        equipment_match=analysis_data["equipment_match"],
        visible_fault_assessment=analysis_data["visible_fault_assessment"],
        after_repair_functional_evidence=analysis_data["after_repair_functional_evidence"],
        media_quality=analysis_data["media_quality"],
        missing_evidence=json.dumps(analysis_data["missing_evidence"]),
        inconsistencies=json.dumps(analysis_data["inconsistencies"]),
        ai_recommendation=analysis_data["ai_recommendation"],
        review_requirement=analysis_data["review_requirement"],
        confidence_score=analysis_data["confidence_score"],
        analysis_notes=analysis_data["analysis_notes"],
        model_version=analysis_data["model_version"],
        analysis_timestamp=analysis_data["analysis_timestamp"]
    )
    db.add(job)
    
    audit = AuditLog(
        ticket_id=ticket.id,
        action="AI_ANALYSIS_MANUALLY_TRIGGERED",
        actor_id=current_user.id,
        actor_name=current_user.name,
        actor_role=current_user.role,
        details=json.dumps({"ai_recommendation": analysis_data["ai_recommendation"]})
    )
    db.add(audit)
    db.commit()
    db.refresh(job)
    return parse_job_response(job)

@router.post("/{job_id}/review")
def review_verification(
    job_id: int,
    payload: AIHumanReviewRequest,
    current_user: User = Depends(require_roles("admin", "supervisor")),
    db: Session = Depends(get_db)
):
    """
    Supervisor or Admin human sign-off / override on AI verification.
    If overruling AI recommendation, requires documented justification!
    """
    job = db.query(AIVerificationJob).filter(AIVerificationJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="AI Verification Job not found")
        
    ticket = db.query(Ticket).filter(Ticket.id == job.ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Associated ticket not found")
        
    # Check if this is an override of the AI recommendation
    is_override = (
        (payload.decision == "approved" and job.ai_recommendation != "likely_resolved") or
        (payload.decision == "rejected" and job.ai_recommendation == "likely_resolved")
    )
    
    if is_override and not (payload.override_reason and payload.override_reason.strip()):
        raise HTTPException(
            status_code=400,
            detail="Mandatory requirement: You must provide a documented rationale when overruling the AI system's assessment."
        )
        
    job.human_decision = payload.decision
    job.human_reviewer_id = current_user.id
    job.human_review_notes = payload.notes
    job.human_override_reason = payload.override_reason
    job.human_reviewed_at = datetime.now(timezone.utc)
    
    # If supervisor approves, and ticket is ready, advance ticket to closed
    if payload.decision == "approved":
        if ticket.status == "resolution_submitted":
            ticket.status = "closed"
            ticket.closed_at = datetime.now(timezone.utc)
            ticket.is_escalated = False
            
    audit = AuditLog(
        ticket_id=ticket.id,
        action="AI_VERIFICATION_HUMAN_REVIEW",
        actor_id=current_user.id,
        actor_name=current_user.name,
        actor_role=current_user.role,
        details=json.dumps({
            "job_id": job.id,
            "decision": payload.decision,
            "is_override": is_override,
            "override_reason": payload.override_reason,
            "notes": payload.notes
        })
    )
    db.add(audit)
    db.commit()
    db.refresh(job)
    return parse_job_response(job)
