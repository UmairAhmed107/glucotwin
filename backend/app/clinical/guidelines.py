import os
import re
from pathlib import Path
from typing import Any, Dict, List, Optional
from app.config import settings


_SNIPPET_CACHE: Optional[List[Dict[str, str]]] = None


def load_all_snippets(guidelines_dir: Optional[Path] = None) -> List[Dict[str, str]]:
    """
    Load and parse all guideline markdown files from the guidelines directory.
    Extracts front matter (id, topic, source_note) and body text.
    """
    global _SNIPPET_CACHE
    if _SNIPPET_CACHE is not None and guidelines_dir is None:
        return _SNIPPET_CACHE

    directory = guidelines_dir or settings.guidelines_dir
    snippets: List[Dict[str, str]] = []

    if not directory.exists():
        # Fallback to backend/guidelines or workspace/guidelines
        alt_dirs = [
            Path(__file__).resolve().parent.parent.parent / "guidelines",
            Path(__file__).resolve().parent.parent.parent.parent / "guidelines",
        ]
        for alt in alt_dirs:
            if alt.exists():
                directory = alt
                break

    if not directory.exists():
        return []

    for file_path in sorted(directory.glob("*.md")):
        if file_path.name.lower() == "readme.md":
            continue

        try:
            content = file_path.read_text(encoding="utf-8")
        except Exception:
            continue

        match = re.match(r"^---\s*\n(.*?)\n---\s*\n(.*)$", content, re.DOTALL)
        meta: Dict[str, str] = {}
        if match:
            front_matter_raw = match.group(1)
            body = match.group(2).strip()
            for line in front_matter_raw.splitlines():
                if ":" in line:
                    key, val = line.split(":", 1)
                    meta[key.strip()] = val.strip()
        else:
            body = content.strip()

        snippet_id = meta.get("id", file_path.stem)
        topic = meta.get("topic", snippet_id)
        source_note = meta.get("source_note", "paraphrased educational summary")

        snippets.append({
            "id": snippet_id,
            "topic": topic,
            "source_note": source_note,
            "text": body,
        })

    if guidelines_dir is None:
        _SNIPPET_CACHE = snippets

    return snippets


def get_known_guideline_ids(guidelines_dir: Optional[Path] = None) -> List[str]:
    """Return all known guideline snippet IDs."""
    snippets = load_all_snippets(guidelines_dir)
    return [s["id"] for s in snippets]


def retrieve_guidelines(
    patient_data: Dict[str, Any],
    top_k: int = 4,
    guidelines_dir: Optional[Path] = None,
) -> List[Dict[str, str]]:
    """
    Retrieve top 3-5 guideline snippets by simple keyword overlap with patient's findings.
    Returns list of dicts with id, topic, text.
    """
    snippets = load_all_snippets(guidelines_dir)
    if not snippets:
        return []

    # Build weighted keyword queries from patient clinical & twin context
    query_keywords: List[str] = [
        "diabetes", "glucose", "lifestyle", "monitoring"
    ]

    # Clinical factors
    if patient_data.get("kidney_flag"):
        query_keywords.extend(["kidney", "renal", "filtration", "sglt2", "nephroprotective", "egfr"])

    hypo_hist = patient_data.get("hypoglycemia_history")
    if hypo_hist is True:
        query_keywords.extend(["hypoglycaemia", "hypoglycemia", "secretagogues", "sulfonylureas", "insulin"])
    elif hypo_hist is False:
        query_keywords.extend(["sulfonylureas", "insulin", "secretagogues"])

    bmi = patient_data.get("bmi")
    if bmi is not None and bmi >= 25.0:
        query_keywords.extend(["weight", "obesity", "glp-1", "lifestyle", "satiety"])

    hba1c = patient_data.get("hba1c_pct")
    if hba1c is not None:
        if hba1c >= 8.5:
            query_keywords.extend(["insulin", "basal", "combination", "potent"])
        else:
            query_keywords.extend(["metformin", "first-line", "dpp-4", "monotherapy"])

    fasting = patient_data.get("fasting_glucose_mgdl")
    if fasting is not None and fasting >= 160.0:
        query_keywords.extend(["basal", "fasting", "gluconeogenesis", "hepatic"])

    current_meds = patient_data.get("current_meds", [])
    if isinstance(current_meds, list):
        for med in current_meds:
            if isinstance(med, str):
                query_keywords.extend(med.lower().replace("_", " ").split())

    # Twin findings
    twin_summary = patient_data.get("twin_summary", {})
    if isinstance(twin_summary, dict):
        if twin_summary.get("mem_mean_rise", 0) > 30:
            query_keywords.extend(["post-meal", "postprandial", "carbohydrate", "walk", "activity"])
        if twin_summary.get("worst_meals"):
            query_keywords.extend(["carbohydrate", "timing", "spikes", "fiber"])

    # Score each snippet by keyword occurrences
    scored_snippets = []
    for snippet in snippets:
        content_text = f"{snippet['topic']} {snippet['text']}".lower()
        score = 0
        for kw in query_keywords:
            if kw.lower() in content_text:
                score += 1
        scored_snippets.append((score, snippet))

    # Sort descending by score
    scored_snippets.sort(key=lambda x: x[0], reverse=True)

    # Return top 3-5
    k = max(3, min(top_k, 5, len(scored_snippets)))
    selected = [
        {
            "id": item[1]["id"],
            "topic": item[1]["topic"],
            "text": item[1]["text"],
        }
        for item in scored_snippets[:k]
    ]

    return selected
