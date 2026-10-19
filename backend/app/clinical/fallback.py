from typing import Any, Dict, Optional


def get_fallback_plan(patient_data: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """
    Generate a conservative fixed fallback clinical plan.
    Used when critical data is missing or reasoning fails.
    """
    return {
        "therapy_options": [],
        "lifestyle_interventions": [
            {
                "title": "Post-Meal Light Physical Activity",
                "detail": "Engage in a 10 to 15 minute gentle walk following main meals to facilitate non-insulin glucose uptake.",
                "linked_twin_finding": "Reduces acute postprandial glycemic rises.",
            },
            {
                "title": "Dietary Fiber and Unrefined Carbohydrates",
                "detail": "Prioritize high-fiber legumes, vegetables, and whole grains while moderating portion sizes and timing.",
                "linked_twin_finding": None,
            },
        ],
        "red_flags": [
            "Conservative fallback plan: discuss therapy review with your clinician before any medication changes."
        ],
        "questions_for_clinician": [
            "Discuss therapy review with your clinician to establish individualized glycemic targets.",
            "Review kidney function (eGFR), liver parameters, and recent HbA1c testing.",
        ],
        "missing_information": [
            "Complete recent laboratory values, hypoglycemia event logs, and updated clinician assessment required."
        ],
        "patient_summary": "Focus on balanced meals that include vegetables, dietary fiber, and healthy protein sources. Taking a gentle 10 to 15 minute walk after meals can help smooth your daily glucose responses. Keep a daily log of your readings and discuss any therapy adjustments with your clinician for personalized care.",
        "fallback": True,
        "demo_fixture": False,
    }
