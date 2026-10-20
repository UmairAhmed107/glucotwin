"""
Messaging Router for GlucoTwin Care Team Communication.
Provides threads and messages between a patient and their active care team members,
with unread message counts and optional contextual linking to a visit, alert, or scenario.
"""

from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.auth import get_current_user, log_audit_event, verify_patient_access
from app.db import get_db
from app.models_db import (
    Alert,
    CareTeamLink,
    Message,
    MessageThread,
    Patient,
    SavedScenario,
    User,
    Visit,
    utcnow,
)
from app.schemas import (
    MessageCreate,
    MessageResponse,
    ThreadCreate,
    ThreadDetailResponse,
    ThreadResponse,
)

router = APIRouter(prefix="/messages", tags=["Care Team Messaging"])


def _check_thread_access(thread: MessageThread, user: User, db: Session) -> Patient:
    """Verifies that the user has permission to access the thread's patient."""
    return verify_patient_access(thread.patient_id, user, db)


def _compute_unread_count(messages: List[Message], user_id: int) -> int:
    """Count messages sent by others that have not been read by the user."""
    unread = 0
    for m in messages:
        if m.sender_id != user_id and user_id not in (m.read_by or []):
            unread += 1
    return unread


def _format_message(m: Message, current_user_id: int) -> MessageResponse:
    sender_name = m.sender.full_name if m.sender else "System"
    sender_role = m.sender.role if m.sender else "system"
    is_read = current_user_id in (m.read_by or []) or m.sender_id == current_user_id
    return MessageResponse(
        id=m.id,
        thread_id=m.thread_id,
        sender_id=m.sender_id,
        sender_name=sender_name,
        sender_role=sender_role,
        content=m.content,
        is_read=is_read,
        created_at=m.created_at,
    )


@router.get("/threads", response_model=List[ThreadResponse])
def list_threads(
    patient_id: Optional[int] = Query(None, description="Optional patient filter"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> List[ThreadResponse]:
    """
    List message threads accessible to the user.
    - Patient: only threads for their own patient profile.
    - Clinician / Dietitian: threads for patients with active care-team link.
    - Admin: all threads or filtered by patient_id.
    """
    query = db.query(MessageThread)

    if current_user.role == "patient":
        patient = db.query(Patient).filter(Patient.user_id == current_user.id).first()
        if not patient:
            return []
        query = query.filter(MessageThread.patient_id == patient.id)
    elif current_user.role in ("clinician", "dietitian"):
        if patient_id is not None:
            verify_patient_access(patient_id, current_user, db)
            query = query.filter(MessageThread.patient_id == patient_id)
        else:
            # All patients in active care team
            active_links = (
                db.query(CareTeamLink.patient_id)
                .filter(
                    CareTeamLink.provider_user_id == current_user.id,
                    CareTeamLink.status == "active",
                )
                .all()
            )
            patient_ids = [p[0] for p in active_links]
            query = query.filter(MessageThread.patient_id.in_(patient_ids))
    elif current_user.role == "admin":
        if patient_id is not None:
            query = query.filter(MessageThread.patient_id == patient_id)

    threads = query.order_by(MessageThread.updated_at.desc()).all()

    result: List[ThreadResponse] = []
    for t in threads:
        unread_count = _compute_unread_count(t.messages, current_user.id)
        last_msg = t.messages[-1].content if t.messages else None
        last_msg_at = t.messages[-1].created_at if t.messages else t.created_at
        creator_name = t.creator.full_name if t.creator else None
        patient_name = t.patient.display_name if t.patient else f"Patient #{t.patient_id}"

        result.append(
            ThreadResponse(
                id=t.id,
                patient_id=t.patient_id,
                patient_name=patient_name,
                title=t.title,
                topic_type=t.topic_type,
                topic_id=t.topic_id,
                topic_title=t.topic_title,
                created_by=t.created_by,
                creator_name=creator_name,
                unread_count=unread_count,
                last_message=last_msg,
                last_message_at=last_msg_at,
                created_at=t.created_at,
                updated_at=t.updated_at,
            )
        )

    return result


@router.post("/threads", response_model=ThreadDetailResponse, status_code=status.HTTP_201_CREATED)
def create_thread(
    payload: ThreadCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ThreadDetailResponse:
    """
    Create a new message thread for a patient and care team.
    Optionally links to a visit, alert, or simulation scenario.
    """
    patient = verify_patient_access(payload.patient_id, current_user, db)

    # Optional topic title resolution if not explicitly given
    topic_title = payload.topic_title
    if payload.topic_type and payload.topic_id and not topic_title:
        if payload.topic_type == "visit":
            visit = db.query(Visit).filter(Visit.id == int(payload.topic_id)).first()
            if visit:
                topic_title = f"Visit scheduled {visit.scheduled_at.strftime('%b %d, %Y')}"
        elif payload.topic_type == "alert":
            alert = db.query(Alert).filter(Alert.id == int(payload.topic_id)).first()
            if alert:
                topic_title = f"Alert: {alert.rule_key} ({alert.severity.upper()})"
        elif payload.topic_type == "scenario":
            scen = db.query(SavedScenario).filter(SavedScenario.id == int(payload.topic_id)).first()
            if scen:
                topic_title = f"Scenario: {scen.name}"

    now = utcnow()
    thread = MessageThread(
        patient_id=patient.id,
        title=payload.title,
        topic_type=payload.topic_type,
        topic_id=str(payload.topic_id) if payload.topic_id else None,
        topic_title=topic_title,
        created_by=current_user.id,
        created_at=now,
        updated_at=now,
    )
    db.add(thread)
    db.flush()

    messages_list: List[MessageResponse] = []
    if payload.initial_message and payload.initial_message.strip():
        msg = Message(
            thread_id=thread.id,
            sender_id=current_user.id,
            content=payload.initial_message.strip(),
            read_by=[current_user.id],
            created_at=now,
        )
        db.add(msg)
        db.flush()
        messages_list.append(_format_message(msg, current_user.id))

    db.commit()
    db.refresh(thread)

    log_audit_event(
        db=db,
        user_id=current_user.id,
        action="create",
        resource_type="message_thread",
        resource_id=thread.id,
        patient_id=patient.id,
    )

    creator_name = current_user.full_name
    return ThreadDetailResponse(
        id=thread.id,
        patient_id=thread.patient_id,
        patient_name=patient.display_name,
        title=thread.title,
        topic_type=thread.topic_type,
        topic_id=thread.topic_id,
        topic_title=thread.topic_title,
        created_by=thread.created_by,
        creator_name=creator_name,
        unread_count=0,
        last_message=messages_list[-1].content if messages_list else None,
        last_message_at=messages_list[-1].created_at if messages_list else thread.created_at,
        created_at=thread.created_at,
        updated_at=thread.updated_at,
        messages=messages_list,
    )


@router.get("/threads/{thread_id}", response_model=ThreadDetailResponse)
def get_thread_detail(
    thread_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ThreadDetailResponse:
    """Retrieve full thread message history."""
    thread = db.query(MessageThread).filter(MessageThread.id == thread_id).first()
    if not thread:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Thread {thread_id} not found")

    _check_thread_access(thread, current_user, db)

    unread_count = _compute_unread_count(thread.messages, current_user.id)
    formatted_messages = [_format_message(m, current_user.id) for m in thread.messages]

    return ThreadDetailResponse(
        id=thread.id,
        patient_id=thread.patient_id,
        patient_name=thread.patient.display_name if thread.patient else None,
        title=thread.title,
        topic_type=thread.topic_type,
        topic_id=thread.topic_id,
        topic_title=thread.topic_title,
        created_by=thread.created_by,
        creator_name=thread.creator.full_name if thread.creator else None,
        unread_count=unread_count,
        last_message=formatted_messages[-1].content if formatted_messages else None,
        last_message_at=formatted_messages[-1].created_at if formatted_messages else thread.created_at,
        created_at=thread.created_at,
        updated_at=thread.updated_at,
        messages=formatted_messages,
    )


@router.post("/threads/{thread_id}/messages", response_model=MessageResponse, status_code=status.HTTP_201_CREATED)
def post_message(
    thread_id: int,
    payload: MessageCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MessageResponse:
    """Send a new message into an active discussion thread."""
    thread = db.query(MessageThread).filter(MessageThread.id == thread_id).first()
    if not thread:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Thread {thread_id} not found")

    _check_thread_access(thread, current_user, db)

    if not payload.content.strip():
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Message cannot be empty")

    now = utcnow()
    msg = Message(
        thread_id=thread.id,
        sender_id=current_user.id,
        content=payload.content.strip(),
        read_by=[current_user.id],
        created_at=now,
    )
    thread.updated_at = now
    db.add(msg)
    db.commit()
    db.refresh(msg)

    log_audit_event(
        db=db,
        user_id=current_user.id,
        action="create",
        resource_type="message",
        resource_id=msg.id,
        patient_id=thread.patient_id,
    )

    return _format_message(msg, current_user.id)


@router.post("/threads/{thread_id}/read", status_code=status.HTTP_200_OK)
def mark_thread_read(
    thread_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Mark all unread messages in thread as read for current user."""
    thread = db.query(MessageThread).filter(MessageThread.id == thread_id).first()
    if not thread:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Thread {thread_id} not found")

    _check_thread_access(thread, current_user, db)

    updated = False
    for m in thread.messages:
        reads = list(m.read_by or [])
        if current_user.id not in reads:
            reads.append(current_user.id)
            m.read_by = reads
            updated = True

    if updated:
        db.commit()

    return {"status": "ok", "thread_id": thread_id, "unread_count": 0}


@router.get("/unread-count")
def get_unread_count(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get total unread message count across all accessible threads."""
    threads = list_threads(current_user=current_user, db=db)
    total_unread = sum(t.unread_count for t in threads)
    return {"unread_count": total_unread}
