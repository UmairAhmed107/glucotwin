"""
FHIR-Style Interoperability Export Router for GlucoTwin.
Provides:
- GET /export/fhir/{patient_id}: Simplified FHIR Release 4 (R4) JSON Bundle.
"""

from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.auth import get_current_user, log_audit_event, verify_patient_access
from app.db import get_db
from app.models_db import GlucoseReading, Medication, Patient, User, utcnow

router = APIRouter(prefix="/export", tags=["FHIR Interoperability Export"])


@router.get("/fhir/{patient_id}")
def export_patient_fhir_bundle(
    patient_id: int,
    current_user: Optional[User] = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """
    Simplified FHIR Release 4 (R4) JSON Bundle export for patient clinical data.

    CLINICAL INTEROPERABILITY DISCLAIMER:
    State clearly: This is a simplified subset of the HL7 FHIR R4 standard designed
    for clinical interoperability demonstration and digital twin exchange.
    It is not a full certified HL7 FHIR server implementation.

    Contains:
    - Patient resource (demographics, synthetic flag)
    - Observation resources:
      * HbA1c (LOINC 4548-4)
      * eGFR (LOINC 33914-3)
      * Fasting Glucose (LOINC 1558-6)
      * CGM Glucose Readings (LOINC 2339-0)
    - MedicationStatement resources (current anti-diabetic and chronic medications)
    """
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Patient {patient_id} not found")

    if current_user:
        verify_patient_access(patient_id, current_user, db)

    now_iso = utcnow().isoformat()
    bundle_id = f"glucotwin-bundle-patient-{patient.id}"

    gender = "other"
    if patient.sex.upper().startswith("M"):
        gender = "male"
    elif patient.sex.upper().startswith("F"):
        gender = "female"

    entries: List[Dict[str, Any]] = []

    # 1. Patient Resource
    patient_resource = {
        "resourceType": "Patient",
        "id": str(patient.id),
        "identifier": [
            {
                "system": "http://glucotwin.org/identifiers/patient",
                "value": str(patient.id),
            }
        ],
        "active": True,
        "name": [
            {
                "use": "official",
                "text": patient.display_name,
            }
        ],
        "gender": gender,
        "extension": [
            {
                "url": "http://glucotwin.org/fhir/StructureDefinition/synthetic-data",
                "valueBoolean": patient.is_synthetic,
            },
            {
                "url": "http://glucotwin.org/fhir/StructureDefinition/bmi",
                "valueDecimal": float(patient.bmi),
            },
            {
                "url": "http://glucotwin.org/fhir/StructureDefinition/age-years",
                "valueInteger": int(patient.age),
            },
        ],
    }
    entries.append({
        "fullUrl": f"urn:uuid:patient-{patient.id}",
        "resource": patient_resource,
    })

    # 2. Observation: HbA1c
    hba1c_obs = {
        "resourceType": "Observation",
        "id": f"obs-hba1c-{patient.id}",
        "status": "final",
        "category": [
            {
                "coding": [
                    {
                        "system": "http://terminology.hl7.org/CodeSystem/observation-category",
                        "code": "laboratory",
                        "display": "Laboratory",
                    }
                ]
            }
        ],
        "code": {
            "coding": [
                {
                    "system": "http://loinc.org",
                    "code": "4548-4",
                    "display": "Hemoglobin A1c/Hemoglobin.total in Blood",
                }
            ],
            "text": "HbA1c",
        },
        "subject": {"reference": f"Patient/{patient.id}"},
        "effectiveDateTime": now_iso,
        "valueQuantity": {
            "value": float(patient.hba1c_pct),
            "unit": "%",
            "system": "http://unitsofmeasure.org",
            "code": "%",
        },
    }
    entries.append({
        "fullUrl": f"urn:uuid:obs-hba1c-{patient.id}",
        "resource": hba1c_obs,
    })

    # 3. Observation: eGFR
    egfr_val = 45.0 if patient.kidney_flag else 90.0
    egfr_obs = {
        "resourceType": "Observation",
        "id": f"obs-egfr-{patient.id}",
        "status": "final",
        "category": [
            {
                "coding": [
                    {
                        "system": "http://terminology.hl7.org/CodeSystem/observation-category",
                        "code": "laboratory",
                        "display": "Laboratory",
                    }
                ]
            }
        ],
        "code": {
            "coding": [
                {
                    "system": "http://loinc.org",
                    "code": "33914-3",
                    "display": "Glomerular filtration rate/1.73 sq M.predicted",
                }
            ],
            "text": "eGFR (Estimated Glomerular Filtration Rate)",
        },
        "subject": {"reference": f"Patient/{patient.id}"},
        "effectiveDateTime": now_iso,
        "valueQuantity": {
            "value": egfr_val,
            "unit": "mL/min/1.73m2",
            "system": "http://unitsofmeasure.org",
            "code": "mL/min/1.73m2",
        },
        "interpretation": [
            {
                "coding": [
                    {
                        "system": "http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation",
                        "code": "A" if patient.kidney_flag else "N",
                        "display": "Abnormal (Renal impairment alert)" if patient.kidney_flag else "Normal",
                    }
                ]
            }
        ],
    }
    entries.append({
        "fullUrl": f"urn:uuid:obs-egfr-{patient.id}",
        "resource": egfr_obs,
    })

    # 4. Observation: Fasting Glucose
    fasting_obs = {
        "resourceType": "Observation",
        "id": f"obs-fasting-glucose-{patient.id}",
        "status": "final",
        "category": [
            {
                "coding": [
                    {
                        "system": "http://terminology.hl7.org/CodeSystem/observation-category",
                        "code": "laboratory",
                        "display": "Laboratory",
                    }
                ]
            }
        ],
        "code": {
            "coding": [
                {
                    "system": "http://loinc.org",
                    "code": "1558-6",
                    "display": "Fasting glucose [Mass/volume] in Serum or Plasma",
                }
            ],
            "text": "Fasting Blood Glucose",
        },
        "subject": {"reference": f"Patient/{patient.id}"},
        "effectiveDateTime": now_iso,
        "valueQuantity": {
            "value": float(patient.fasting_glucose_mgdl),
            "unit": "mg/dL",
            "system": "http://unitsofmeasure.org",
            "code": "mg/dL",
        },
    }
    entries.append({
        "fullUrl": f"urn:uuid:obs-fasting-glucose-{patient.id}",
        "resource": fasting_obs,
    })

    # 5. Observations: Recent Glucose Readings (CGM / Fingerstick)
    recent_readings = (
        db.query(GlucoseReading)
        .filter(GlucoseReading.patient_id == patient.id)
        .order_by(GlucoseReading.ts.desc())
        .limit(50)
        .all()
    )
    for r in recent_readings:
        entries.append({
            "fullUrl": f"urn:uuid:obs-glucose-{r.id}",
            "resource": {
                "resourceType": "Observation",
                "id": f"obs-glucose-{r.id}",
                "status": "final",
                "category": [
                    {
                        "coding": [
                            {
                                "system": "http://terminology.hl7.org/CodeSystem/observation-category",
                                "code": "vital-signs",
                                "display": "Vital Signs",
                            }
                        ]
                    }
                ],
                "code": {
                    "coding": [
                        {
                            "system": "http://loinc.org",
                            "code": "2339-0",
                            "display": "Glucose [Mass/volume] in Blood",
                        }
                    ],
                    "text": "Glucose reading",
                },
                "subject": {"reference": f"Patient/{patient.id}"},
                "effectiveDateTime": r.ts.isoformat(),
                "valueQuantity": {
                    "value": float(r.value_mgdl),
                    "unit": "mg/dL",
                    "system": "http://unitsofmeasure.org",
                    "code": "mg/dL",
                },
            },
        })

    # 6. MedicationStatement Resources
    meds = db.query(Medication).filter(Medication.patient_id == patient.id).all()
    if meds:
        for med in meds:
            entries.append({
                "fullUrl": f"urn:uuid:med-{med.id}",
                "resource": {
                    "resourceType": "MedicationStatement",
                    "id": f"med-{med.id}",
                    "status": "active" if med.is_active else "completed",
                    "medicationCodeableConcept": {
                        "text": med.name,
                    },
                    "subject": {"reference": f"Patient/{patient.id}"},
                    "effectiveDateTime": med.created_at.isoformat(),
                    "dosage": [
                        {
                            "text": med.dosage,
                            "timing": {
                                "code": {
                                    "text": med.schedule,
                                }
                            },
                        }
                    ],
                },
            })
    else:
        # Fallback to current_meds list from patient profile
        for idx, med_name in enumerate(patient.current_meds or [], start=1):
            entries.append({
                "fullUrl": f"urn:uuid:med-profile-{idx}",
                "resource": {
                    "resourceType": "MedicationStatement",
                    "id": f"med-profile-{idx}",
                    "status": "active",
                    "medicationCodeableConcept": {
                        "text": str(med_name),
                    },
                    "subject": {"reference": f"Patient/{patient.id}"},
                    "effectiveDateTime": now_iso,
                },
            })

    if current_user:
        log_audit_event(
            db=db,
            user_id=current_user.id,
            action="export_fhir",
            resource_type="fhir_bundle",
            resource_id=str(patient.id),
            patient_id=patient.id,
        )

    return {
        "resourceType": "Bundle",
        "id": bundle_id,
        "type": "collection",
        "timestamp": now_iso,
        "total": len(entries),
        "entry": entries,
    }
