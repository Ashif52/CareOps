import json
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Ticket, Evidence, AIVerificationJob, User, AuditLog
from app.schemas import EvidenceResponse
from app.services.auth_service import get_current_user
from app.services.storage_service import StorageService
from app.services.ai_vision_service import AIVisionService

router = APIRouter(prefix="/evidence", tags=["Evidence & Media"])

@router.post("/upload", response_model=EvidenceResponse)
async def upload_evidence(
    ticket_id: int = Form(...),
    stage: str = Form(...),  # "before" or "after"
    media_type: str = Form(...),  # "image" or "video"
    equipment_type: Optional[str] = Form(None),
    notes: Optional[str] = Form(None),
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
        
    if stage not in ["before", "after"]:
        raise HTTPException(status_code=400, detail="Evidence stage must be 'before' or 'after'")
        
    rel_url, file_hash, file_size, det_type = StorageService.save_upload_file(file, subfolder=f"ticket_{ticket_id}")
    final_media_type = det_type or media_type or "image"
    
    evidence = Evidence(
        ticket_id=ticket.id,
        stage=stage,
        media_type=final_media_type,
        file_url=rel_url,
        file_size_bytes=file_size,
        file_hash=file_hash,
        equipment_type=equipment_type or ticket.category,
        uploaded_by_id=current_user.id,
        notes=notes
    )
    db.add(evidence)
    db.flush()
    
    audit = AuditLog(
        ticket_id=ticket.id,
        action=f"EVIDENCE_UPLOADED_{stage.upper()}",
        actor_id=current_user.id,
        actor_name=current_user.name,
        actor_role=current_user.role,
        details=json.dumps({"stage": stage, "media_type": media_type, "file_url": rel_url})
    )
    db.add(audit)
    
    # Check if we should automatically trigger AI verification job when both stages have evidence!
    before_ev = db.query(Evidence).filter(Evidence.ticket_id == ticket.id, Evidence.stage == "before").first()
    after_ev = db.query(Evidence).filter(Evidence.ticket_id == ticket.id, Evidence.stage == "after").order_by(Evidence.id.desc()).first()
    
    if stage == "after" and before_ev and after_ev:
        analysis_data = AIVisionService.analyze_ticket_evidence(ticket, before_ev, after_ev)
        ai_job = AIVerificationJob(
            ticket_id=ticket.id,
            status="completed",
            before_evidence_id=before_ev.id,
            after_evidence_id=after_ev.id,
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
        db.add(ai_job)
        
        audit_ai = AuditLog(
            ticket_id=ticket.id,
            action="AI_VERIFICATION_EVALUATED",
            actor_name="CareOps Vision Engine",
            actor_role="ai_system",
            details=json.dumps({
                "recommendation": analysis_data["ai_recommendation"],
                "confidence": analysis_data["confidence_score"],
                "review_requirement": analysis_data["review_requirement"]
            })
        )
        db.add(audit_ai)
        
    db.commit()
    db.refresh(evidence)
    return evidence
