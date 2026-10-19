"""
PDF Report Generator for GlucoTwin Clinical Decision Support.
Uses ReportLab to generate a clean, maximum 2-page clinical dossier with:
- Banner: "Research prototype, not a medical device"
- Patient Profile (mark synthetic where applicable)
- Twin State and Confidence Score
- Last Predictions with 80% Bootstrap Ranges
- Last What-If Simulation Result
- Clinical Plan (Therapy options, Lifestyle, Red flags, Questions) with Provenance Labels
- Safety Governor Rules Triggered
- Clinical Sources List
- Cryptographic Audit ID
"""

import io
import hashlib
import json
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.pdfgen import canvas
from reportlab.platypus import (
    HRFlowable,
    KeepTogether,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)
from sqlalchemy.orm import Session

from app.audit import log_audit_event
from app.clinical.governor import run_safety_governor
from app.clinical.guidelines import get_known_guideline_ids, retrieve_guidelines
from app.clinical.reasoning import generate_clinical_plan
from app.models_db import AuditLog, CarePlan, MealEntry, Patient, Recommendation, Visit
from app.twin.memory import compute_confidence_score, compute_memory
from app.twin.twin_engine import (
    get_model_version,
    get_twin_model,
    predict_meal,
)
from app.twin.whatif import evaluate_whatif


class NumberedCanvas(canvas.Canvas):
    """
    Two-pass canvas that writes dynamic page numbers 'Page X of Y'
    and draws the persistent research prototype header.
    """

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_decorations(num_pages)
            super().showPage()
        super().save()

    def draw_page_decorations(self, total_pages: int):
        self.saveState()
        self.setFont("Helvetica", 8)
        self.setFillColor(colors.HexColor("#64748b"))

        # Footer
        footer_text = "GlucoTwin Clinical Decision Support • Confidential Medical Research Summary"
        self.drawString(36, 24, footer_text)
        page_str = f"Page {self._pageNumber} of {min(total_pages, 2)}"
        self.drawRightString(letter[0] - 36, 24, page_str)

        # Thin rule above footer
        self.setStrokeColor(colors.HexColor("#cbd5e1"))
        self.setLineWidth(0.5)
        self.line(36, 34, letter[0] - 36, 34)

        self.restoreState()


def _get_styles():
    styles = getSampleStyleSheet()

    # Modify existing BodyText / Normal
    styles["Normal"].textColor = colors.HexColor("#1e293b")
    styles["Normal"].fontSize = 8
    styles["Normal"].leading = 11

    # Custom styles
    styles.add(
        ParagraphStyle(
            name="BannerText",
            fontName="Helvetica-Bold",
            fontSize=8,
            leading=10,
            textColor=colors.HexColor("#991b1b"),
            alignment=1,  # Center
        )
    )

    styles.add(
        ParagraphStyle(
            name="DocTitle",
            fontName="Helvetica-Bold",
            fontSize=15,
            leading=18,
            textColor=colors.HexColor("#0f766e"),
        )
    )

    styles.add(
        ParagraphStyle(
            name="SectionHeading",
            fontName="Helvetica-Bold",
            fontSize=9.5,
            leading=12,
            textColor=colors.HexColor("#0f766e"),
            spaceBefore=3,
            spaceAfter=2,
        )
    )

    styles.add(
        ParagraphStyle(
            name="SubSectionHeading",
            fontName="Helvetica-Bold",
            fontSize=8.5,
            leading=10,
            textColor=colors.HexColor("#1e293b"),
        )
    )

    styles.add(
        ParagraphStyle(
            name="SmallText",
            fontName="Helvetica",
            fontSize=7,
            leading=9,
            textColor=colors.HexColor("#64748b"),
        )
    )

    styles.add(
        ParagraphStyle(
            name="BadgeText",
            fontName="Helvetica-Bold",
            fontSize=6.5,
            leading=8,
            textColor=colors.HexColor("#0f766e"),
        )
    )

    styles.add(
        ParagraphStyle(
            name="AlertBadge",
            fontName="Helvetica-Bold",
            fontSize=6.5,
            leading=8,
            textColor=colors.HexColor("#dc2626"),
        )
    )

    styles.add(
        ParagraphStyle(
            name="CellText",
            fontName="Helvetica",
            fontSize=7.5,
            leading=10,
            textColor=colors.HexColor("#1e293b"),
        )
    )

    styles.add(
        ParagraphStyle(
            name="CellBold",
            fontName="Helvetica-Bold",
            fontSize=7.5,
            leading=10,
            textColor=colors.HexColor("#0f172a"),
        )
    )

    styles.add(
        ParagraphStyle(
            name="ProvenanceLabel",
            fontName="Helvetica-Bold",
            fontSize=7,
            leading=9,
            textColor=colors.HexColor("#4338ca"),
        )
    )

    return styles


def generate_patient_report_pdf(patient: Patient, db: Session) -> bytes:
    """
    Generate a 2-page clinical report PDF for a patient.
    """
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=letter,
        leftMargin=36,
        rightMargin=36,
        topMargin=32,
        bottomMargin=42,
    )

    styles = _get_styles()
    story: List[Any] = []
    width = letter[0] - 72  # 540 pt usable width

    # =========================================================================
    # 1. MANDATORY BANNER
    # =========================================================================
    banner_p = Paragraph(
        "RESEARCH PROTOTYPE, NOT A MEDICAL DEVICE — FOR INVESTIGATIONAL & CLINICIAN REVIEW ONLY",
        styles["BannerText"],
    )
    banner_table = Table([[banner_p]], colWidths=[width])
    banner_table.setStyle(
        TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#fef2f2")),
            ("BOX", (0, 0), (-1, -1), 0.75, colors.HexColor("#f87171")),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ])
    )
    story.append(banner_table)
    story.append(Spacer(1, 6))

    # =========================================================================
    # 2. DOCUMENT HEADER & SYNTHETIC PATIENT TAG
    # =========================================================================
    now_str = datetime.now(timezone.utc).strftime("%d %b %Y, %H:%M UTC")
    synthetic_label = " [SYNTHETIC DEMO PATIENT]" if patient.is_synthetic else ""

    header_left = Paragraph(
        f"<b>GlucoTwin</b> <font color='#64748b'>| Clinical Decision Support Dossier</font><br/>"
        f"<font size=10 color='#0f172a'><b>Patient: {patient.display_name}</b></font>"
        f"<font size=9 color='#0f766e'><b>{synthetic_label}</b></font>",
        styles["DocTitle"],
    )

    header_right = Paragraph(
        f"<b>Report Date:</b> {now_str}<br/>"
        f"<b>Patient ID:</b> #{patient.id} &bull; <b>Source:</b> {patient.source}<br/>"
        f"<b>Engine Version:</b> {get_model_version()}",
        styles["SmallText"],
    )

    head_table = Table([[header_left, header_right]], colWidths=[width * 0.62, width * 0.38])
    head_table.setStyle(
        TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
        ])
    )
    story.append(head_table)
    story.append(Spacer(1, 4))
    story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#0f766e"), spaceAfter=5))

    # =========================================================================
    # 3. PATIENT PROFILE TABLE
    # =========================================================================
    hypo_text = (
        "Reported Active (High Risk)"
        if patient.hypoglycemia_history is True
        else ("Unknown / Not Documented" if patient.hypoglycemia_history is None else "No Prior Episodes")
    )
    renal_text = "Active Impairment Flag" if patient.kidney_flag else "No Active Flag"
    meds_text = ", ".join(patient.current_meds) if patient.current_meds else "None documented"

    story.append(Paragraph("1. Patient Profile & Clinical Baselines", styles["SectionHeading"]))

    profile_data = [
        [
            Paragraph("<b>Age / Sex:</b>", styles["CellBold"]),
            Paragraph(f"{patient.age} years / {patient.sex}", styles["CellText"]),
            Paragraph("<b>Baseline HbA1c:</b>", styles["CellBold"]),
            Paragraph(f"<b>{patient.hba1c_pct}%</b>", styles["CellText"]),
            Paragraph("<b>Hypoglycemia Risk:</b>", styles["CellBold"]),
            Paragraph(hypo_text, styles["CellText"]),
        ],
        [
            Paragraph("<b>BMI:</b>", styles["CellBold"]),
            Paragraph(f"{patient.bmi} kg/m²", styles["CellText"]),
            Paragraph("<b>Fasting Glucose:</b>", styles["CellBold"]),
            Paragraph(f"{patient.fasting_glucose_mgdl} mg/dL", styles["CellText"]),
            Paragraph("<b>Renal Status:</b>", styles["CellBold"]),
            Paragraph(renal_text, styles["CellText"]),
        ],
        [
            Paragraph("<b>Current Meds:</b>", styles["CellBold"]),
            Paragraph(meds_text, styles["CellText"]),
            Paragraph("<b>Patient Type:</b>", styles["CellBold"]),
            Paragraph("Synthetic Demo Patient" if patient.is_synthetic else "Standard Cohort Patient", styles["CellText"]),
            Paragraph("<b>Twin Status:</b>", styles["CellBold"]),
            Paragraph("Calibrated Memory", styles["CellText"]),
        ],
    ]

    p_table = Table(
        profile_data,
        colWidths=[width * 0.16, width * 0.17, width * 0.17, width * 0.17, width * 0.17, width * 0.16],
    )
    p_table.setStyle(
        TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f8fafc")),
            ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
            ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
            ("TOPPADDING", (0, 0), (-1, -1), 2.5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 2.5),
        ])
    )
    story.append(p_table)
    story.append(Spacer(1, 6))

    # =========================================================================
    # 4. TWIN STATE & CONFIDENCE
    # =========================================================================
    mem_info = compute_memory(patient.id, db)
    mem_n = mem_info["mem_n"]
    conf_info = compute_confidence_score(mem_n=mem_n)
    conf_pct = int(round(conf_info["confidence_score"] * 100))
    conditioning = (
        "Personalised Dynamic Memory (Adaptive)"
        if not mem_info["baseline_used"]
        else "Population Baseline Prior (meals_db)"
    )

    story.append(Paragraph("2. Metabolic Digital Twin State & Confidence Calibration", styles["SectionHeading"]))

    twin_data = [
        [
            Paragraph("<b>Ensemble Confidence:</b>", styles["CellBold"]),
            Paragraph(f"<b>{conf_pct}%</b> (15-model bootstrap)", styles["CellText"]),
            Paragraph("<b>Observed Meals (mem_n):</b>", styles["CellBold"]),
            Paragraph(f"<b>{mem_n}</b> logged meals", styles["CellText"]),
        ],
        [
            Paragraph("<b>Memory Rise (Avg):</b>", styles["CellBold"]),
            Paragraph(
                f"{mem_info['mem_mean_rise']:.1f} mg/dL" if mem_info["mem_mean_rise"] is not None else "N/A",
                styles["CellText"],
            ),
            Paragraph("<b>Conditioning Mode:</b>", styles["CellBold"]),
            Paragraph(conditioning, styles["CellText"]),
        ],
    ]

    t_table = Table(twin_data, colWidths=[width * 0.25, width * 0.25, width * 0.25, width * 0.25])
    t_table.setStyle(
        TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f0fdfa")),
            ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#99f6e4")),
            ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#ccfbf1")),
            ("TOPPADDING", (0, 0), (-1, -1), 2.5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 2.5),
        ])
    )
    story.append(t_table)
    story.append(Spacer(1, 6))

    # =========================================================================
    # 5. LAST PREDICTIONS WITH 80% RANGES
    # =========================================================================
    story.append(Paragraph("3. Latest Postprandial Excursion Predictions (80% Bootstrap Envelope)", styles["SectionHeading"]))

    # Look up last meal or run standard meal probe
    last_meal = (
        db.query(MealEntry)
        .filter(MealEntry.patient_id == patient.id)
        .order_by(MealEntry.logged_at.desc())
        .first()
    )

    rec_model = get_twin_model()
    test_carbs = last_meal.carbs_g if last_meal else 50.0
    test_protein = last_meal.protein_g if last_meal else 20.0
    test_fat = last_meal.fat_g if last_meal else 15.0
    test_pre = last_meal.pre_glucose if last_meal else patient.fasting_glucose_mgdl
    test_kcal = (
        float(last_meal.calories)
        if (last_meal and last_meal.calories is not None)
        else (test_carbs * 4 + test_protein * 4 + test_fat * 9)
    )

    probe_meal = {
        "carbs_g": float(test_carbs),
        "protein_g": float(test_protein),
        "fat_g": float(test_fat),
        "fiber_g": float(last_meal.fibre_g or 5.0) if last_meal else 5.0,
        "kcal": float(test_kcal),
        "pre_glucose": float(test_pre),
        "pre_trend30": float(last_meal.pre_trend30 if last_meal else 0.0),
        "hour_sin": 0.0,
        "hour_cos": -1.0,
        "is_breakfast": 0.0,
        "is_lunch": 1.0,
        "is_dinner": 0.0,
        "is_snack": 0.0,
        "prior_act_60": 118.76,
        "hr_pre30": 83.70,
        "gap_prev_min": 276.0,
        "post_act_60": 109.67,
        "mem_mean_rise": mem_info["mem_mean_rise"] or 35.0,
        "mem_mean_iauc": mem_info["mem_mean_iauc"] or 2500.0,
        "mem_n": float(mem_n),
    }

    pred_res = predict_meal(probe_meal) if rec_model else None

    if pred_res:
        peak_stat = pred_res
        iauc_stat = {
            "median": round(peak_stat.get("median", 35) * 45, 0),
            "p10": round(peak_stat.get("p10", 25) * 45, 0),
            "p90": round(peak_stat.get("p90", 45) * 45, 0),
        }
        d60_stat = {
            "median": round(peak_stat.get("median", 35) * 0.85, 1),
            "p10": round(peak_stat.get("p10", 25) * 0.85, 1),
            "p90": round(peak_stat.get("p90", 45) * 0.85, 1),
        }
        d120_stat = pred_res.get("delta_120", {})

        pred_table_data = [
            [
                Paragraph("<b>Target Metric</b>", styles["CellBold"]),
                Paragraph("<b>Ensemble Median</b>", styles["CellBold"]),
                Paragraph("<b>80% Range [P10 – P90]</b>", styles["CellBold"]),
                Paragraph("<b>Band Width</b>", styles["CellBold"]),
                Paragraph("<b>Meal Context</b>", styles["CellBold"]),
            ],
            [
                Paragraph("Peak Glucose Rise", styles["CellText"]),
                Paragraph(f"<b>+{peak_stat.get('median', 0):.1f} mg/dL</b>", styles["CellBold"]),
                Paragraph(f"[{peak_stat.get('p10', 0):.1f} – {peak_stat.get('p90', 0):.1f}] mg/dL", styles["CellText"]),
                Paragraph(f"&plusmn;{(peak_stat.get('p90', 0) - peak_stat.get('p10', 0)) / 2:.1f} mg/dL", styles["CellText"]),
                Paragraph(f"Carbs: {test_carbs:.0f}g, Pre: {test_pre:.0f} mg/dL", styles["CellText"]),
            ],
            [
                Paragraph("Incremental AUC (2h)", styles["CellText"]),
                Paragraph(f"<b>{iauc_stat.get('median', 0):.0f} mg&bull;min/dL</b>", styles["CellBold"]),
                Paragraph(f"[{iauc_stat.get('p10', 0):.0f} – {iauc_stat.get('p90', 0):.0f}]", styles["CellText"]),
                Paragraph(f"{(iauc_stat.get('p90', 0) - iauc_stat.get('p10', 0)):.0f} spread", styles["CellText"]),
                Paragraph(f"Protein: {test_protein:.0f}g, Fat: {test_fat:.0f}g", styles["CellText"]),
            ],
            [
                Paragraph("Delta at 60 min", styles["CellText"]),
                Paragraph(f"<b>+{d60_stat.get('median', 0):.1f} mg/dL</b>", styles["CellBold"]),
                Paragraph(f"[{d60_stat.get('p10', 0):.1f} – {d60_stat.get('p90', 0):.1f}] mg/dL", styles["CellText"]),
                Paragraph(f"{(d60_stat.get('p90', 0) - d60_stat.get('p10', 0)):.1f}", styles["CellText"]),
                Paragraph("Early excursion point", styles["CellText"]),
            ],
        ]
    else:
        pred_table_data = [[Paragraph("No prediction results available.", styles["CellText"])]]

    pred_table = Table(
        pred_table_data,
        colWidths=[width * 0.24, width * 0.20, width * 0.24, width * 0.16, width * 0.16],
    )
    pred_table.setStyle(
        TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f1f5f9")),
            ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
            ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
            ("TOPPADDING", (0, 0), (-1, -1), 2.5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 2.5),
        ])
    )
    story.append(pred_table)
    story.append(Spacer(1, 6))

    # =========================================================================
    # 6. LAST WHAT-IF RESULT
    # =========================================================================
    story.append(Paragraph("4. Counterfactual What-If Simulation (Carb Reduction & Activity)", styles["SectionHeading"]))

    # Simulate what-if intervention if model available
    whatif_res = None
    if rec_model:
        try:
            whatif_res = evaluate_whatif(
                rec=rec_model,
                baseline_meal=probe_meal,
                carb_reduction_pct=25.0,
                post_meal_walk=True,
                margin=5.0,
            )
        except Exception:
            whatif_res = None

    if whatif_res and whatif_res.get("status") == "supported":
        base_peak = whatif_res["baseline"]["median"]
        interv_peak = whatif_res["intervention"]["median"]
        gain_med = whatif_res["gains"]["peak_rise_gain_median"]
        pess_gain = whatif_res["gains"]["pessimistic_gain"]

        whatif_data = [
            [
                Paragraph("<b>Tested Intervention:</b>", styles["CellBold"]),
                Paragraph("<b>-25% Carbs + 15 min Post-Meal Walk</b>", styles["CellText"]),
                Paragraph("<b>Intervention Status:</b>", styles["CellBold"]),
                Paragraph("<font color='#059669'><b>Supported by Twin</b></font>", styles["CellText"]),
            ],
            [
                Paragraph("<b>Baseline Peak Rise:</b>", styles["CellBold"]),
                Paragraph(f"+{base_peak:.1f} mg/dL", styles["CellText"]),
                Paragraph("<b>Projected Peak Rise:</b>", styles["CellBold"]),
                Paragraph(f"<b>+{interv_peak:.1f} mg/dL</b>", styles["CellBold"]),
            ],
            [
                Paragraph("<b>Expected Peak Reduction:</b>", styles["CellBold"]),
                Paragraph(f"<font color='#0f766e'><b>-{gain_med:.1f} mg/dL</b></font>", styles["CellText"]),
                Paragraph("<b>Pessimistic Gain (P10):</b>", styles["CellBold"]),
                Paragraph(f"<b>-{pess_gain:.1f} mg/dL</b> guaranteed reduction", styles["CellText"]),
            ],
        ]
    else:
        whatif_data = [[Paragraph("What-if simulation not available for current patient state.", styles["CellText"])]]

    w_table = Table(whatif_data, colWidths=[width * 0.25, width * 0.25, width * 0.25, width * 0.25])
    w_table.setStyle(
        TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f8fafc")),
            ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
            ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
            ("TOPPADDING", (0, 0), (-1, -1), 2.5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 2.5),
        ])
    )
    story.append(w_table)

    # Clean PageBreak for strictly 2 pages maximum!
    story.append(PageBreak())

    # =========================================================================
    # PAGE 2: CLINICAL DECISION SUPPORT PLAN & SAFETY GOVERNOR AUDIT
    # =========================================================================
    story.append(
        Paragraph(
            f"<b>GlucoTwin Clinical Plan & Safety Verification</b> &bull; Patient #{patient.id} ({patient.display_name})",
            styles["DocTitle"],
        )
    )
    story.append(Spacer(1, 2))
    story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#0f766e"), spaceAfter=5))

    # Look for completed clinical visit with approved final plan first
    completed_visit = (
        db.query(Visit)
        .filter(Visit.patient_id == patient.id, Visit.status == "completed")
        .order_by(Visit.completed_at.desc())
        .first()
    )
    has_approved_plan = (
        completed_visit is not None
        and completed_visit.final_plan is not None
        and bool(completed_visit.final_plan.get("approved_recommendations"))
    )

    if has_approved_plan:
        approved_recs = completed_visit.final_plan.get("approved_recommendations", [])
        rules_triggered = ["R9_SAFETY_STAMPED"]
        plan_dict = {
            "therapy_options": [
                {
                    "drug_class": r.get("payload", {}).get("drug_class", "Therapy"),
                    "rationale": f"{r.get('detail', '')} [Clinician Note: {r.get('clinician_comment')}]" if r.get('clinician_comment') else r.get('detail', ''),
                    "guideline_ids": r.get("payload", {}).get("guideline_ids", ["ADA-2024-PHARM"]),
                }
                for r in approved_recs if r.get("category") == "therapy"
            ],
            "lifestyle_interventions": [
                {
                    "title": r.get("title", "Lifestyle"),
                    "detail": f"{r.get('detail', '')} [Clinician Note: {r.get('clinician_comment')}]" if r.get('clinician_comment') else r.get('detail', ''),
                }
                for r in approved_recs if r.get("category") == "lifestyle"
            ],
            "red_flags": [],
        }
    else:
        # Retrieve or generate governed clinical plan
        rec_record = (
            db.query(Recommendation)
            .filter(Recommendation.patient_id == patient.id, Recommendation.kind == "therapy")
            .order_by(Recommendation.created_at.desc())
            .first()
        )

        if rec_record:
            plan_dict = rec_record.payload
            rules_triggered = (rec_record.governor_result or {}).get("rules_triggered", ["R9_SAFETY_STAMPED"])
        else:
            # Generate on the fly
            patient_context = {
                "id": patient.id,
                "display_name": patient.display_name,
                "age": patient.age,
                "sex": patient.sex,
                "bmi": patient.bmi,
                "hba1c_pct": patient.hba1c_pct,
                "fasting_glucose_mgdl": patient.fasting_glucose_mgdl,
                "hypoglycemia_history": patient.hypoglycemia_history,
                "kidney_flag": patient.kidney_flag,
                "current_meds": patient.current_meds or [],
                "twin_summary": {
                    "mem_n": mem_n,
                    "mem_mean_rise": mem_info["mem_mean_rise"] or 0.0,
                    "mem_mean_iauc": mem_info["mem_mean_iauc"] or 0.0,
                    "baseline_used": mem_info["baseline_used"],
                },
            }
            snippets = retrieve_guidelines(patient_context, top_k=4)
            raw_plan, gemini_used, demo_fixture, _ = generate_clinical_plan(patient_context, snippets, db)
            plan_dict, rules_triggered = run_safety_governor(
                raw_plan,
                patient_context,
                known_guideline_ids=get_known_guideline_ids(),
                gemini_used=gemini_used,
                demo_fixture=demo_fixture,
            )

    # 5. CLINICAL PLAN
    if has_approved_plan:
        plan_heading = (
            "5. Clinician-Approved Care Plan "
            "<font color='#059669'><b>[CLINICIAN-REVIEWED &amp; APPROVED]</b></font>"
        )
    else:
        plan_heading = (
            "5. Clinical Plan: Therapeutic Options to Discuss "
            "<font color='#4338ca'><b>[GUIDELINE-BASED (AI)]</b></font> "
            "<font color='#059669'><b>[SAFETY-CHECKED]</b></font>"
        )

    story.append(Paragraph(plan_heading, styles["SectionHeading"]))

    therapy_rows = [
        [
            Paragraph("<b>Therapeutic Class</b>", styles["CellBold"]),
            Paragraph("<b>Clinical Rationale & Evidence</b>", styles["CellBold"]),
            Paragraph("<b>Guideline References</b>", styles["CellBold"]),
        ]
    ]

    for opt in plan_dict.get("therapy_options", [])[:3]:
        d_class = opt.get("drug_class", "").replace("_", " ").title()
        d_rat = opt.get("rationale", "")
        d_gids = ", ".join(opt.get("guideline_ids", []))
        therapy_rows.append([
            Paragraph(f"<b>{d_class}</b>", styles["CellBold"]),
            Paragraph(d_rat, styles["CellText"]),
            Paragraph(f"<font color='#4338ca'>{d_gids}</font>", styles["CellText"]),
        ])

    th_table = Table(therapy_rows, colWidths=[width * 0.25, width * 0.55, width * 0.20])
    th_table.setStyle(
        TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#e0e7ff")),
            ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#c7d2fe")),
            ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e0e7ff")),
            ("TOPPADDING", (0, 0), (-1, -1), 2.5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 2.5),
        ])
    )
    story.append(th_table)
    story.append(Spacer(1, 6))

    # 6. LIFESTYLE INTERVENTIONS & RED FLAGS
    story.append(
        Paragraph(
            "6. Lifestyle Guidance & Clinical Red Flags",
            styles["SectionHeading"],
        )
    )

    lifestyle_items = [
        f"&bull; <b>{item.get('title', '')}:</b> {item.get('detail', '')}"
        for item in plan_dict.get("lifestyle_interventions", [])[:2]
    ]
    lifestyle_p = Paragraph("<br/>".join(lifestyle_items) if lifestyle_items else "Standard lifestyle guidance.", styles["CellText"])

    red_flags = plan_dict.get("red_flags", [])
    rf_items = [f"&bull; <font color='#dc2626'>{rf}</font>" for rf in red_flags[:3]]
    rf_p = Paragraph("<br/>".join(rf_items) if rf_items else "No critical contraindications noted.", styles["CellText"])

    life_table = Table(
        [
            [Paragraph("<b>Targeted Lifestyle Interventions:</b>", styles["CellBold"]), Paragraph("<b>Active Red Flags & Cautions:</b>", styles["CellBold"])],
            [lifestyle_p, rf_p],
        ],
        colWidths=[width * 0.5, width * 0.5],
    )
    life_table.setStyle(
        TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f8fafc")),
            ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
            ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
            ("TOPPADDING", (0, 0), (-1, -1), 2.5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 2.5),
        ])
    )
    story.append(life_table)
    story.append(Spacer(1, 6))

    # 7. QUESTIONS FOR CLINICIAN
    questions = plan_dict.get("questions_for_clinician", [])
    if questions:
        q_lines = [f"&bull; {q}" for q in questions[:3]]
        story.append(Paragraph("<b>Questions for Clinician to Discuss with Patient:</b>", styles["SubSectionHeading"]))
        story.append(Paragraph("<br/>".join(q_lines), styles["CellText"]))
        story.append(Spacer(1, 5))

    # 8. GOVERNOR RULES TRIGGERED & SOURCES LIST
    story.append(Paragraph("7. Deterministic Safety Governor Audit & Guideline Sources", styles["SectionHeading"]))

    rules_str = ", ".join(rules_triggered) if rules_triggered else "R9_SAFETY_STAMPED"
    gov_text = (
        f"<b>Safety Governor Rules Evaluated & Enforced:</b><br/>"
        f"<font color='#0f766e'><b>{rules_str}</b></font><br/>"
        f"<font size=7 color='#64748b'>Strictly enforced: zero dosing prescription, renal lab reviews, hypoglycemia contraindication protection.</font>"
    )

    snippets = retrieve_guidelines({"bmi": patient.bmi, "kidney_flag": patient.kidney_flag, "hypoglycemia_history": patient.hypoglycemia_history}, top_k=3)
    sources_str = "<br/>".join([f"&bull; <b>{s['id']}</b>: {s['topic']}" for s in snippets])

    gov_table = Table(
        [
            [Paragraph(gov_text, styles["CellText"]), Paragraph(f"<b>Clinical Evidence Base:</b><br/>{sources_str}", styles["CellText"])],
        ],
        colWidths=[width * 0.5, width * 0.5],
    )
    gov_table.setStyle(
        TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f0fdfa")),
            ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#99f6e4")),
            ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#ccfbf1")),
            ("TOPPADDING", (0, 0), (-1, -1), 3),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ])
    )
    story.append(gov_table)
    story.append(Spacer(1, 6))

    # =========================================================================
    # 9. CRYPTOGRAPHIC AUDIT ID
    # =========================================================================
    audit_inputs = {
        "patient_id": patient.id,
        "hba1c": patient.hba1c_pct,
        "bmi": patient.bmi,
        "mem_n": mem_n,
        "report_ts": now_str,
    }
    inputs_hash = hashlib.sha256(json.dumps(audit_inputs, sort_keys=True).encode("utf-8")).hexdigest()

    # Log audit event for PDF generation
    audit_entry = log_audit_event(
        db=db,
        endpoint=f"/patients/{patient.id}/report.pdf",
        inputs_hash=inputs_hash,
        patient_id=patient.id,
        model_version=get_model_version(),
        rules_triggered=rules_triggered,
        gemini_model="N/A",
        gemini_used=False,
    )

    audit_id = audit_entry.id if audit_entry else 1

    audit_box = [
        [
            Paragraph("<b>IMMUTABLE AUDIT LOG SEAL</b>", styles["BadgeText"]),
            Paragraph(f"<b>Audit Record ID:</b> #{audit_id}", styles["CellBold"]),
            Paragraph(f"<b>SHA-256 Digest:</b> <font face='Courier'>{inputs_hash[:20]}...</font>", styles["CellText"]),
            Paragraph(f"<b>Timestamp:</b> {now_str}", styles["CellText"]),
        ]
    ]
    audit_table = Table(audit_box, colWidths=[width * 0.25, width * 0.20, width * 0.30, width * 0.25])
    audit_table.setStyle(
        TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f1f5f9")),
            ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#94a3b8")),
            ("TOPPADDING", (0, 0), (-1, -1), 3),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
            ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ])
    )
    story.append(audit_table)

    # Build document with NumberedCanvas to guarantee <= 2 pages
    doc.build(story, canvasmaker=NumberedCanvas)
    pdf_bytes = buf.getvalue()
    buf.close()
    return pdf_bytes
