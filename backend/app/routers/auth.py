from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.auth import create_access_token, get_current_user, hash_password, verify_password
from app.db import get_db
from app.models_db import Patient, User
from app.schemas import TokenResponse, UserLogin, UserRegister, UserResponse


router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register(req: UserRegister, db: Session = Depends(get_db)):
    """Register a new user account and return an access token."""
    existing = db.query(User).filter(User.email == req.email.strip().lower()).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user with this email address already exists",
        )

    user = User(
        email=req.email.strip().lower(),
        password_hash=hash_password(req.password),
        full_name=req.full_name.strip(),
        role=req.role,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    # If the user is a patient, link or create a starter Patient record
    patient_id = None
    if user.role == "patient":
        patient = Patient(
            user_id=user.id,
            display_name=user.full_name,
            is_synthetic=False,
            source="new",
            age=45,
            sex="Other",
            bmi=27.0,
            hba1c_pct=6.5,
            fasting_glucose_mgdl=110.0,
            hypoglycemia_history=False,
            kidney_flag=False,
            current_meds=[],
        )
        db.add(patient)
        db.commit()
        db.refresh(patient)
        patient_id = patient.id

    token = create_access_token(data={"sub": str(user.id), "email": user.email, "role": user.role})

    return TokenResponse(
        access_token=token,
        token_type="bearer",
        user=UserResponse(
            id=user.id,
            email=user.email,
            full_name=user.full_name,
            role=user.role,
            created_at=user.created_at,
            patient_id=patient_id,
        ),
    )


@router.post("/login", response_model=TokenResponse)
def login(req: UserLogin, db: Session = Depends(get_db)):
    """Authenticate with email and password and return an access token."""
    user = db.query(User).filter(User.email == req.email.strip().lower()).first()
    if not user or not verify_password(req.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = create_access_token(data={"sub": str(user.id), "email": user.email, "role": user.role})
    patient_id = user.patient.id if user.patient else None

    return TokenResponse(
        access_token=token,
        token_type="bearer",
        user=UserResponse(
            id=user.id,
            email=user.email,
            full_name=user.full_name,
            role=user.role,
            created_at=user.created_at,
            patient_id=patient_id,
        ),
    )


@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    """Return the currently authenticated user's profile and linked patient ID."""
    patient_id = current_user.patient.id if current_user.patient else None
    return UserResponse(
        id=current_user.id,
        email=current_user.email,
        full_name=current_user.full_name,
        role=current_user.role,
        created_at=current_user.created_at,
        patient_id=patient_id,
    )


@router.get("/providers", response_model=List[UserResponse])
def get_available_providers(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List clinicians and dietitians available for care-team requests."""
    providers = (
        db.query(User)
        .filter(User.role.in_(["clinician", "dietitian"]))
        .order_by(User.full_name)
        .all()
    )
    return [
        UserResponse(
            id=p.id,
            email=p.email,
            full_name=p.full_name,
            role=p.role,
            created_at=p.created_at,
            patient_id=None,
        )
        for p in providers
    ]
