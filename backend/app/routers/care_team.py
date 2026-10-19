from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.auth import get_current_user, log_audit_event
from app.db import get_db
from app.models_db import CareTeamLink, Patient, User
from app.schemas import CareTeamLinkCreate, CareTeamLinkResponse, CareTeamStatusUpdate


router = APIRouter(prefix="/care-team", tags=["care-team"])


def _to_link_response(link: CareTeamLink) -> CareTeamLinkResponse:
    provider = link.provider_user
    patient = link.patient
    return CareTeamLinkResponse(
        id=link.id,
        patient_id=link.patient_id,
        provider_user_id=link.provider_user_id,
        provider_name=provider.full_name if provider else None,
        provider_role=provider.role if provider else None,
        patient_name=patient.display_name if patient else None,
        role_in_team=link.role_in_team,
        status=link.status,
        created_at=link.created_at,
    )


@router.get("/my-team", response_model=List[CareTeamLinkResponse])
def get_my_care_team(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Get care team connections:
    - Patient: links for their linked patient profile.
    - Clinician / Dietitian: links for themselves as provider.
    - Admin: all care team links.
    """
    if current_user.role == "patient":
        if not current_user.patient:
            return []
        links = (
            db.query(CareTeamLink)
            .filter(CareTeamLink.patient_id == current_user.patient.id)
            .order_by(CareTeamLink.created_at.desc())
            .all()
        )
    elif current_user.role in ("clinician", "dietitian"):
        links = (
            db.query(CareTeamLink)
            .filter(CareTeamLink.provider_user_id == current_user.id)
            .order_by(CareTeamLink.created_at.desc())
            .all()
        )
    elif current_user.role == "admin":
        links = db.query(CareTeamLink).order_by(CareTeamLink.created_at.desc()).all()
    else:
        links = []

    return [_to_link_response(link) for link in links]


@router.post("/request", response_model=CareTeamLinkResponse, status_code=status.HTTP_201_CREATED)
def request_care_team_link(
    req: CareTeamLinkCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Create a new care team link request.
    - If called by a patient, links their profile to the specified provider.
    - If called by a provider, creates a pending link request for the specified patient.
    """
    if current_user.role == "patient":
        if not current_user.patient:
            raise HTTPException(status_code=400, detail="User does not have an associated patient profile")
        patient_id = current_user.patient.id
        if not req.provider_user_id:
            raise HTTPException(status_code=400, detail="provider_user_id is required")
        provider = db.query(User).filter(User.id == req.provider_user_id).first()
        if not provider or provider.role not in ("clinician", "dietitian"):
            raise HTTPException(status_code=400, detail="Invalid provider specified")
        initial_status = "active"  # When patient initiates, they immediately consent
        role_in_team = provider.role
        provider_id = provider.id
    else:
        # Clinician/dietitian/admin requesting
        if not req.patient_id:
            raise HTTPException(status_code=400, detail="patient_id is required")
        patient = db.query(Patient).filter(Patient.id == req.patient_id).first()
        if not patient:
            raise HTTPException(status_code=404, detail="Patient not found")
        patient_id = patient.id
        provider_id = req.provider_user_id if current_user.role == "admin" and req.provider_user_id else current_user.id
        provider = db.query(User).filter(User.id == provider_id).first()
        if not provider:
            raise HTTPException(status_code=400, detail="Provider not found")
        initial_status = "pending"  # Awaits patient approval
        role_in_team = req.role_in_team or provider.role

    # Check for existing link
    existing = (
        db.query(CareTeamLink)
        .filter(
            CareTeamLink.patient_id == patient_id,
            CareTeamLink.provider_user_id == provider_id,
        )
        .first()
    )
    if existing:
        existing.status = initial_status
        db.commit()
        db.refresh(existing)
        link = existing
    else:
        link = CareTeamLink(
            patient_id=patient_id,
            provider_user_id=provider_id,
            role_in_team=role_in_team,
            status=initial_status,
        )
        db.add(link)
        db.commit()
        db.refresh(link)

    log_audit_event(
        db=db,
        user_id=current_user.id,
        action="request_care_team_link",
        resource_type="care_team_link",
        resource_id=link.id,
        patient_id=patient_id,
    )

    return _to_link_response(link)


@router.post("/{link_id}/approve", response_model=CareTeamLinkResponse)
def approve_care_team_link(
    link_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Patient approves a pending care team link request."""
    link = db.query(CareTeamLink).filter(CareTeamLink.id == link_id).first()
    if not link:
        raise HTTPException(status_code=404, detail="Care team link not found")

    # Only the patient themselves or an admin can approve the link
    if current_user.role == "patient":
        if not current_user.patient or current_user.patient.id != link.patient_id:
            raise HTTPException(status_code=403, detail="Forbidden: You can only approve links for your own care team")
    elif current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Forbidden: Only patients or admins can approve links")

    link.status = "active"
    db.commit()
    db.refresh(link)

    log_audit_event(
        db=db,
        user_id=current_user.id,
        action="approve_care_team_link",
        resource_type="care_team_link",
        resource_id=link.id,
        patient_id=link.patient_id,
    )

    return _to_link_response(link)


@router.post("/{link_id}/revoke", response_model=CareTeamLinkResponse)
def revoke_care_team_link(
    link_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Patient or provider revokes a care team link."""
    link = db.query(CareTeamLink).filter(CareTeamLink.id == link_id).first()
    if not link:
        raise HTTPException(status_code=404, detail="Care team link not found")

    # Allowed if patient owner, the provider in the link, or admin
    is_patient_owner = current_user.patient and current_user.patient.id == link.patient_id
    is_provider = current_user.id == link.provider_user_id
    is_admin = current_user.role == "admin"

    if not (is_patient_owner or is_provider or is_admin):
        raise HTTPException(status_code=403, detail="Forbidden: You cannot modify this care team link")

    link.status = "revoked"
    db.commit()
    db.refresh(link)

    log_audit_event(
        db=db,
        user_id=current_user.id,
        action="revoke_care_team_link",
        resource_type="care_team_link",
        resource_id=link.id,
        patient_id=link.patient_id,
    )

    return _to_link_response(link)
