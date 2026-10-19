from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.auth import get_current_user, log_audit_event as log_audit_rbac, require_role, verify_patient_access
from app.db import get_db
from app.models_db import (
    CarePlan,
    CarePlanTask,
    Patient,
    RecommendationDraft,
    User,
    Visit,
    utcnow,
)
from app.schemas import (
    CarePlanResponse,
    CarePlanTaskResponse,
    DraftReviewRequest,
    RecommendationDraftResponse,
    TaskUpdateRequest,
    VisitCreate,
    VisitResponse,
)
from app.clinical.pre_visit import (
    generate_care_plan_from_approved,
    generate_draft_recommendations,
    generate_pre_visit_summary,
)

router = APIRouter(tags=["Visits & Care Plans"])


def _serialize_visit(visit: Visit) -> VisitResponse:
    drafts_schema = [
        RecommendationDraftResponse.model_validate(d) for d in visit.drafts
    ]
    patient_name = visit.patient.display_name if visit.patient else None
    clinician_name = visit.clinician.full_name if visit.clinician else None

    return VisitResponse(
        id=visit.id,
        patient_id=visit.patient_id,
        clinician_id=visit.clinician_id,
        scheduled_at=visit.scheduled_at,
        status=visit.status,  # type: ignore
        pre_visit_summary=visit.pre_visit_summary,
        notes=visit.notes,
        final_plan=visit.final_plan,
        created_at=visit.created_at,
        completed_at=visit.completed_at,
        drafts=drafts_schema,
        patient_name=patient_name,
        clinician_name=clinician_name,
    )


# ============================================================================
# Visits Endpoints
# ============================================================================

@router.post("/patients/{patient_id}/visits", response_model=VisitResponse)
def create_visit(
    patient_id: int,
    payload: Optional[VisitCreate] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Create a new clinical visit for a patient.
    Computes deterministic pre-visit summary and generates initial recommendation drafts.
    """
    patient = verify_patient_access(patient_id, current_user, db)

    scheduled_at = (
        payload.scheduled_at
        if payload and payload.scheduled_at
        else datetime.now(timezone.utc)
    )
    notes = payload.notes if payload else None

    clinician_id = current_user.id if current_user.role in ("clinician", "dietitian", "admin") else None

    # 1. Create Visit record
    visit = Visit(
        patient_id=patient_id,
        clinician_id=clinician_id,
        scheduled_at=scheduled_at,
        status="scheduled",
        notes=notes,
        created_at=utcnow(),
    )
    db.add(visit)
    db.flush()

    # 2. Generate pre-visit summary
    summary = generate_pre_visit_summary(patient, db)
    visit.pre_visit_summary = summary

    # 3. Generate draft recommendations
    generate_draft_recommendations(visit, patient, db)

    db.commit()
    db.refresh(visit)

    log_audit_rbac(
        db=db,
        user_id=current_user.id,
        action="create_visit",
        resource_type="visit",
        resource_id=visit.id,
        patient_id=patient_id,
    )

    return _serialize_visit(visit)


@router.get("/visits/{visit_id}", response_model=VisitResponse)
def get_visit(
    visit_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Retrieve clinical visit details with pre-visit summary, drafts, and final plan.
    """
    visit = db.query(Visit).filter(Visit.id == visit_id).first()
    if not visit:
        raise HTTPException(status_code=404, detail="Visit not found")

    verify_patient_access(visit.patient_id, current_user, db)
    return _serialize_visit(visit)


@router.get("/patients/{patient_id}/visits", response_model=List[VisitResponse])
def list_patient_visits(
    patient_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    List all clinical visits for a patient.
    """
    verify_patient_access(patient_id, current_user, db)

    visits = (
        db.query(Visit)
        .filter(Visit.patient_id == patient_id)
        .order_by(Visit.scheduled_at.desc())
        .all()
    )
    return [_serialize_visit(v) for v in visits]


@router.post("/visits/{visit_id}/start", response_model=VisitResponse)
def start_visit(
    visit_id: int,
    current_user: User = Depends(require_role("clinician", "dietitian", "admin")),
    db: Session = Depends(get_db),
):
    """
    Transition visit to 'in_progress' and assign active clinician.
    """
    visit = db.query(Visit).filter(Visit.id == visit_id).first()
    if not visit:
        raise HTTPException(status_code=404, detail="Visit not found")

    patient = verify_patient_access(visit.patient_id, current_user, db)

    visit.status = "in_progress"
    if not visit.clinician_id:
        visit.clinician_id = current_user.id

    if not visit.drafts:
        generate_draft_recommendations(visit, patient, db)

    db.commit()
    db.refresh(visit)
    return _serialize_visit(visit)


@router.post("/visits/{visit_id}/drafts/generate", response_model=List[RecommendationDraftResponse])
def regenerate_drafts(
    visit_id: int,
    current_user: User = Depends(require_role("clinician", "dietitian", "admin")),
    db: Session = Depends(get_db),
):
    """
    Regenerate governed recommendation drafts for a visit.
    """
    visit = db.query(Visit).filter(Visit.id == visit_id).first()
    if not visit:
        raise HTTPException(status_code=404, detail="Visit not found")

    patient = verify_patient_access(visit.patient_id, current_user, db)
    drafts = generate_draft_recommendations(visit, patient, db)
    return [RecommendationDraftResponse.model_validate(d) for d in drafts]


@router.put("/visits/drafts/{draft_id}", response_model=RecommendationDraftResponse)
def review_draft(
    draft_id: int,
    req: DraftReviewRequest,
    current_user: User = Depends(require_role("clinician", "dietitian", "admin")),
    db: Session = Depends(get_db),
):
    """
    Clinician reviews recommendation draft: approve, edit, or reject.
    CRITICAL: Items that fail the safety governor can never be approved.
    """
    draft = db.query(RecommendationDraft).filter(RecommendationDraft.id == draft_id).first()
    if not draft:
        raise HTTPException(status_code=404, detail="Recommendation draft not found")

    verify_patient_access(draft.patient_id, current_user, db)

    # Safety enforcement: Governor-blocked items can NEVER be approved
    if req.status == "approved":
        if draft.governor_trace and draft.governor_trace.get("blocked"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot approve recommendation draft that failed deterministic safety governor checks.",
            )

    draft.status = req.status
    if req.title is not None:
        draft.title = req.title
    if req.detail is not None:
        draft.detail = req.detail
    if req.clinician_comment is not None:
        draft.clinician_comment = req.clinician_comment
    if req.payload is not None:
        draft.payload = req.payload

    draft.reviewed_at = utcnow()
    db.commit()
    db.refresh(draft)

    return RecommendationDraftResponse.model_validate(draft)


@router.post("/visits/{visit_id}/complete", response_model=VisitResponse)
def complete_visit(
    visit_id: int,
    notes: Optional[str] = None,
    current_user: User = Depends(require_role("clinician", "dietitian", "admin")),
    db: Session = Depends(get_db),
):
    """
    Complete visit, freeze final plan containing only approved/edited items,
    and generate the 4-week actionable CarePlan and Tasks.
    """
    visit = db.query(Visit).filter(Visit.id == visit_id).first()
    if not visit:
        raise HTTPException(status_code=404, detail="Visit not found")

    patient = verify_patient_access(visit.patient_id, current_user, db)

    if notes is not None:
        visit.notes = notes

    # Filter only approved or edited drafts
    approved = [d for d in visit.drafts if d.status in ("approved", "edited")]

    final_plan = {
        "completed_at": utcnow().isoformat(),
        "clinician_id": current_user.id,
        "clinician_name": current_user.full_name,
        "notes": visit.notes or "",
        "approved_recommendations": [
            {
                "id": d.id,
                "category": d.category,
                "title": d.title,
                "detail": d.detail,
                "payload": d.payload,
                "clinician_comment": d.clinician_comment,
                "status": d.status,
            }
            for d in approved
        ],
    }

    visit.final_plan = final_plan
    visit.status = "completed"
    visit.completed_at = utcnow()

    # Generate 4-week actionable care plan and tasks
    generate_care_plan_from_approved(visit, patient, db)

    db.commit()
    db.refresh(visit)

    log_audit_rbac(
        db=db,
        user_id=current_user.id,
        action="complete_visit",
        resource_type="visit",
        resource_id=visit.id,
        patient_id=visit.patient_id,
    )

    return _serialize_visit(visit)


# ============================================================================
# Care Plan & Tasks Endpoints
# ============================================================================

@router.get("/patients/{patient_id}/care-plan", response_model=CarePlanResponse)
def get_patient_care_plan(
    patient_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Retrieve active 4-week Care Plan with real tasks for the patient.
    """
    verify_patient_access(patient_id, current_user, db)

    plan = (
        db.query(CarePlan)
        .filter(CarePlan.patient_id == patient_id, CarePlan.status == "active")
        .order_by(CarePlan.created_at.desc())
        .first()
    )

    if not plan:
        # Fallback to most recent plan if no active
        plan = (
            db.query(CarePlan)
            .filter(CarePlan.patient_id == patient_id)
            .order_by(CarePlan.created_at.desc())
            .first()
        )

    if not plan:
        raise HTTPException(
            status_code=404,
            detail="No care plan available for this patient. Complete a clinical visit to generate one.",
        )

    tasks_schema = [
        CarePlanTaskResponse.model_validate(t)
        for t in sorted(plan.tasks, key=lambda x: x.due_date)
    ]

    return CarePlanResponse(
        id=plan.id,
        patient_id=plan.patient_id,
        visit_id=plan.visit_id,
        title=plan.title,
        status=plan.status,
        created_at=plan.created_at,
        updated_at=plan.updated_at,
        tasks=tasks_schema,
    )


@router.patch("/care-plan/tasks/{task_id}", response_model=CarePlanTaskResponse)
def update_task_status(
    task_id: int,
    req: TaskUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Update status of a care plan task (e.g. check off as completed).
    """
    task = db.query(CarePlanTask).filter(CarePlanTask.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    verify_patient_access(task.patient_id, current_user, db)

    task.status = req.status
    if req.status == "completed":
        task.completed_at = utcnow()
    else:
        task.completed_at = None

    db.commit()
    db.refresh(task)

    log_audit_rbac(
        db=db,
        user_id=current_user.id,
        action="update_task",
        resource_type="care_plan_task",
        resource_id=task.id,
        patient_id=task.patient_id,
    )

    return CarePlanTaskResponse.model_validate(task)
