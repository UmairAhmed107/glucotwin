# GlucoTwin: Detailed Phase Prompts for Antigravity

Use together with `GlucoTwin_Build_Spec.md` (keep it in the repo root as `SPEC.md`). Run the phases **in order, one per Antigravity session**. After each phase, run the tests and only move on when the acceptance checklist passes.

## Decisions that override the spec

- D1. **Patient-mode summary:** included, but generated in the **same single Gemini call** as the clinical plan (extra field `patient_summary`), not a second call. This saves free-tier quota.
- D2. **CGMacros demographics:** assume the dataset ships a bio file (usually `bio.csv`) with age, gender, BMI, HbA1c, fasting glucose. CGMacros participants get real profiles from it. Hypoglycaemia history for them is **`unknown`** (tri-state: `true` / `false` / `unknown`). The Governor treats `unknown` conservatively (see Phase 3).
- D3. **Gemini model:** read from env `GEMINI_MODEL`. Use a fast, cheap Flash-class model from Google AI Studio's current list. Never hardcode a model name in code.
- D4. **Laptop only:** no hosting. Docker is optional; provide `run_dev.sh` and `run_dev.ps1` that start backend and frontend directly.
- D5. English only.

## Global rules (paste at the top of EVERY phase prompt)

```
GLOBAL RULES FOR THIS PROJECT (GlucoTwin):
1. Read SPEC.md and model_manifest.json first. Follow them. If something is missing or ambiguous, add a clearly marked `# TODO(USER)` and list it in your final message instead of guessing.
2. Never invent model internals, feature names, or metrics. Feature names come from model_manifest.json only.
3. Provenance is mandatory: every recommendation object carries provenance = TWIN_PREDICTED | GUIDELINE_AI | PROJECTION, and safety_checked boolean.
4. Gemini never generates twin predictions. Twin numbers come only from the pickled models.
5. No dosing, no "prescribe" language anywhere in output. Therapy suggestions are drug CLASSES to discuss with a clinician.
6. English only. Laptop deployment. SQLite. No external services other than the Gemini API.
7. Write tests for everything you add. Run them. Fix failures before finishing.
8. At the end, output: files created/changed, how to run, tests run and results, open TODO(USER) items.
```

---

## Phase 0: Colab prep (you do this, before Antigravity)

Run this in the **same Colab notebook** where `MealRecommender` was defined, then download `model_manifest.json` and put it in `backend/models/` along with the three pkl files and the CGMacros bio file.

```python
import json, inspect, pickle, sklearn, numpy as np, pandas as pd

rec = pickle.load(open('twin_recommender.pkl', 'rb'))
meals = pd.read_pickle('meals_db.pkl')
shanghai = pd.read_pickle('shanghai_clinical.pkl')

def short(v):
    try:
        if isinstance(v, (list, tuple, dict, np.ndarray, pd.Series)):
            return repr(v)[:2000]
        if isinstance(v, (int, float, str, bool)) or v is None:
            return v
        return f"<{type(v).__name__}>"
    except Exception as e:
        return f"<unreprable: {e}>"

try:
    cls_src = inspect.getsource(type(rec))
except Exception as e:
    cls_src = f"COULD NOT EXTRACT: {e}. Copy the class cell manually."

public_methods = {}
for name, fn in inspect.getmembers(type(rec), predicate=inspect.isfunction):
    if not name.startswith('_') or name == '__init__':
        try:
            public_methods[name] = str(inspect.signature(fn))
        except Exception:
            public_methods[name] = "?"

ensemble = getattr(rec, 'models', None) or getattr(rec, 'ensemble', None)
first = ensemble[0] if isinstance(ensemble, (list, tuple)) and ensemble else None

manifest = {
    "sklearn_version": sklearn.__version__,
    "pandas_version": pd.__version__,
    "numpy_version": np.__version__,
    "class_name": type(rec).__name__,
    "class_source": cls_src,
    "attributes": {k: short(v) for k, v in vars(rec).items()},
    "public_methods": public_methods,
    "first_model_feature_names": list(getattr(first, 'feature_names_in_', [])) if first is not None else None,
    "meals_db": {"shape": list(meals.shape), "columns": {c: str(t) for c, t in meals.dtypes.items()},
                 "head": json.loads(meals.head(3).to_json(orient='records'))},
    "shanghai_clinical": {"shape": list(shanghai.shape), "columns": {c: str(t) for c, t in shanghai.dtypes.items()},
                          "head": json.loads(shanghai.head(3).to_json(orient='records'))},
}
json.dump(manifest, open('model_manifest.json', 'w'), indent=2, default=str)
print("saved model_manifest.json")
```

If `class_source` says "COULD NOT EXTRACT", copy the `MealRecommender` class cell by hand into `backend/app/twin/twin_engine.py`.

Also export your validation numbers to `backend/metrics/validation.json` using this shape (leave out anything you did not actually compute; the UI shows only what exists):

```json
{
  "sklearn_version": "x.y.z",
  "trained_on": {"dataset": "cgmacros", "participants": 45, "meals": 1200},
  "grouped_cv": {
    "peak_rise": {"baseline_mae": 0.0, "twin_mae": 0.0, "baseline_rmse": 0.0, "twin_rmse": 0.0},
    "iauc_2h":   {"baseline_mae": 0.0, "twin_mae": 0.0, "baseline_rmse": 0.0, "twin_rmse": 0.0}
  },
  "error_vs_memory": [{"mem_n": 0, "mae": 0.0, "n": 0}, {"mem_n": 1, "mae": 0.0, "n": 0}],
  "interval_calibration": [{"nominal": 0.8, "empirical": 0.0}],
  "limitations": ["45 participants", "meal windows isolated by 2h", "no medication effects learned"]
}
```

If you are unsure how to compute any of these, paste your training and evaluation cell here and I will write the export code.

---

## Phase 1: Project scaffold, database, patients and data entry

```
[GLOBAL RULES]

TASK: Create the backend foundation and the patients/data-entry API.

1. Create the repo structure from SPEC.md section 5 (backend/, frontend/ placeholder, guidelines/, metrics/, models/). Add a root README.md placeholder, .env.example (GEMINI_API_KEY, GEMINI_MODEL, MOCK_GEMINI=true, DATABASE_URL=sqlite:///./glucotwin.db), and .gitignore (models/*.pkl, .env, *.db).

2. backend/requirements.txt: fastapi, uvicorn[standard], pydantic>=2, sqlalchemy>=2, pandas, numpy, scikit-learn (PIN to the sklearn_version in models/model_manifest.json), joblib, google-generativeai, reportlab, python-dotenv, pytest, httpx. Read the version from the manifest; do not guess.

3. Implement config.py (pydantic-settings reading .env), db.py (SQLAlchemy engine, session dependency, create_all on startup), models_db.py with tables exactly as SPEC section 6: patients, meal_entries, glucose_readings, twin_state, recommendations, audit_log. Change: patients.hypoglycemia_history is a nullable boolean meaning true/false/unknown.

4. Implement schemas.py (Pydantic v2) with strict validation and sensible bounds:
   - age 18-100, bmi 12-60, hba1c_pct 4-18, fasting_glucose_mgdl 50-500
   - carbs_g/protein_g/fat_g/fibre_g >= 0 and <= 400/200/200/100
   - pre_glucose 40-500, pre_trend30 between -100 and 100 (mg/dL per 30 min)
   - timestamps timezone-aware

5. Implement the data loaders (app/data_loader.py): load meals_db.pkl, shanghai_clinical.pkl and the CGMacros bio file once at startup into memory. If the bio file is missing, log a warning and disable "load CGMacros participant" cleanly (endpoint returns 503 with a helpful message).

6. Routers:
   - GET /health: status, models_loaded (false in this phase), sklearn_version running vs manifest.
   - GET /system/models: reads models/model_manifest.json and returns name, class, versions, dataset sizes.
   - POST /patients: three modes via a `mode` field: "new" (manual profile), "cgmacros" (participant id; profile from bio file; hypoglycemia_history = null), "shanghai_profile" (pick a row; copy age, sex, bmi, hba1c, fasting glucose, hypoglycemia flag). Always set is_synthetic=true for shanghai_profile and "new" demo seeds; cgmacros-sourced patients have source="cgmacros".
   - GET /patients, GET /patients/{id} (profile + twin_state).
   - GET /data/cgmacros-participants and GET /data/shanghai-profiles for dropdowns (return id plus short summary only; never dump full tables).
   - POST /patients/{id}/meals and POST /patients/{id}/readings: store entries. Do NOT compute twin memory yet (Phase 2); leave a clearly named hook function recompute_twin_state(patient_id) that currently returns without error.
   - GET /patients/{id}/timeline: merged chronological list of meals and readings.

7. Add audit.py with a helper log_audit(patient_id, endpoint, inputs, model_version, rules_triggered, gemini_used) writing to audit_log (hash the inputs).

8. Consistent error format: {"error": {"code": "...", "message": "...", "details": {...}}}. 404 for unknown patient, 422 for validation.

TESTS (pytest, in backend/tests/): create patient in each mode (use tiny fixture dataframes, not the real pkl files), validation rejections, meal and reading logging, timeline ordering, missing-bio-file behaviour.

ACCEPTANCE: `uvicorn app.main:app` starts; /docs lists all endpoints; pytest passes; creating and listing patients works through /docs.
```

---

## Phase 2: Twin engine, memory, predict, what-if and meal tools

```
[GLOBAL RULES]

TASK: Integrate the real pickled MealRecommender and build all twin-based endpoints.

PRE-CHECK: Open models/model_manifest.json. Use class_source, attributes, public_methods and first_model_feature_names to write app/twin/twin_engine.py. Put the MealRecommender class source there exactly as in the manifest (if class_source says COULD NOT EXTRACT, stop and ask me to paste it). Import the class before unpickling. Load once at startup as a singleton. Compare running sklearn version with manifest and log a clear warning on mismatch. Set models_loaded=true in /health.

1. twin/memory.py
   - compute_memory(patient_id): running means mem_mean_rise, mem_mean_iauc and count mem_n computed from the patient's PRIOR meals that have observed outcomes (observed_peak_rise, observed_iauc_2h). Same convention as meals_db (exclude the current meal).
   - For a brand-new patient (mem_n = 0) use population means computed from meals_db and set flag baseline_used=true.
   - For a patient linked to a CGMacros participant, seed memory from that participant's existing meals in meals_db, so the twin starts personalised.
   - Implement recompute_twin_state(patient_id) and call it after every meal log. Store in twin_state including confidence_score.
   - confidence_score formula: 0.6 * (1 - exp(-mem_n/5)) + 0.4 * (1 - normalised_band_width), clipped to [0,1]. Return the components too so the UI can show a tooltip.

2. twin/bounds.py: use the recommender's lo/hi to check inputs. If any feature is outside, return a structured out_of_range result listing each feature, its value, and the allowed range. Do not predict in that case.

3. Endpoints (routers/twin.py), all return provenance = TWIN_PREDICTED and a model_version string built from the manifest:
   - POST /patients/{id}/predict: input meal macros, time_of_day (hour float), pre_glucose, pre_trend30. Build the exact feature row the model expects (hour_sin/hour_cos from time_of_day; memory features from twin_state). Output per target (peak_rise, iauc_2h, delta_60, delta_120): median, p10, p90, min, max across the 15 ensemble members, plus confidence_score and baseline_used.
   - POST /patients/{id}/whatif: body has the meal plus interventions {carb_reduction_pct, post_meal_walk}. Use the recommender's own what-if logic if it exposes one (check public_methods); otherwise implement it exactly as described in the manifest attributes, with calories recomputed at 4/4/9 kcal/g. Return baseline vs intervention per target, per-member gains, median gain, pessimistic_gain (p10 of gains) and label supported/not_supported using the recommender's margin.
   - POST /patients/{id}/compare-meals: 2-4 candidate meals, ranked by median predicted peak_rise with bands.
   - GET /patients/{id}/best-time: for a given meal, sweep time_of_day 0-23.5 in 0.5h steps; return predicted peak_rise median and band per slot, and the best/worst slots.
   - POST /patients/{id}/daily-plan: list of meals with times; return per-meal prediction; flag the worst meal; return a warning list for meals closer than 120 minutes (model assumption).
   - GET /patients/{id}/cohort-position: percentile of the patient's mem_mean_rise and mem_mean_iauc among the 45 participants in meals_db (use each participant's final memory values).
   - GET /twin-learning/{participant_id}: for a CGMacros participant, return real data showing prediction error or band width versus mem_n computed from their meals in meals_db (use leave-participant-out logic only if the recommender supports it; otherwise return observed values vs mem_n and say so in a `note` field).

4. Every endpoint writes an audit_log row.

TESTS: memory computation (including exclusion of current meal and baseline fallback), bounds guard, calorie math (4/4/9), predict returns monotonic percentiles (p10<=median<=p90), whatif label logic at the margin boundary, daily-plan overlap warnings, cohort percentile on a tiny fixture.

ACCEPTANCE: With real pkl files in place, predict and whatif return sane values for a seeded CGMacros-linked patient; an absurd input (e.g. carbs_g=900) returns out_of_range with details; pytest passes.
```

---

## Phase 3: Clinical Reasoning Engine and Safety Governor

```
[GLOBAL RULES]

TASK: Build the Gemini-based clinical plan and the deterministic Safety Governor.

1. guidelines/: create 8-10 short markdown snippets (each 80-150 words, paraphrased in your own words, never copied verbatim from any guideline) covering: metformin as common first-line option; SGLT2 inhibitors and kidney/heart considerations; GLP-1 receptor agonists and weight; DPP-4 inhibitors; sulfonylureas and hypoglycaemia risk; insulin and hypoglycaemia risk; thiazolidinediones considerations; lifestyle and post-meal activity; carbohydrate quality and meal timing; glucose monitoring and review. Each file has front matter: id (e.g. G-MET-01), topic, source_note ("paraphrased summary; verify against current ADA/ICMR guidance"). Add a README.md in guidelines/ stating these are paraphrased educational summaries for a research prototype.

2. clinical/guidelines.py: load snippets; retrieve top 3-5 by simple keyword overlap with the patient's findings (no vector DB). Return id, topic, text.

3. clinical/prompts.py: SYSTEM_PROMPT exactly as in SPEC section 8.3 plus: "Also produce patient_summary: 4-6 plain-language sentences for the patient, no jargon, no numbers about their future glucose, no doses." Build the user message from a patient JSON (demographics, HbA1c, fasting glucose, hypoglycaemia_history as true/false/unknown, kidney_flag, current medication classes, twin summary: mem_n, mem_mean_rise, worst meals, best time of day) plus retrieved snippets with ids.

4. clinical/reasoning.py: call Gemini via google-generativeai using GEMINI_API_KEY and GEMINI_MODEL from env. Request JSON output (response mime type JSON if supported by the library version). Validate with Pydantic (schema in SPEC 8.2 plus patient_summary). Retry once with exponential backoff on API error or schema failure. Cache by SHA-256 of the full request in SQLite (table llm_cache) so repeated clicks do not burn quota. If MOCK_GEMINI=true or the API fails twice, use a canned schema-valid fixture stamped "demo_fixture": true; surface that flag in the API response and later in the UI.

5. clinical/governor.py: implement these as separate pure functions, each returning (cleaned_plan, triggered_rule_ids):
   R1 schema validity (else fallback)
   R2 drug_class must be in the allowed list; remove others
   R3 reject/remove any item whose text matches dosing language: regex for \b\d+(\.\d+)?\s?(mg|mcg|g|units?|iu|ml)\b, "twice daily", "once daily", "start (with|on)", "prescribe", "take \d"
   R4 hypoglycemia_history == true: remove sulfonylurea and basal_insulin; cap carb-reduction advice at 30%; add red flag
   R4b hypoglycemia_history == "unknown" (null): do not remove, but demote sulfonylurea/basal_insulin to the end, add a caution "hypoglycaemia history unknown; confirm with the patient", and add a question for the clinician
   R5 kidney_flag == true: demote metformin and sglt2_inhibitor and add caution "kidney function must be reviewed before considering"; do not delete (document this choice in the code docstring)
   R6 missing HbA1c or age: return fallback plan
   R7 every guideline_id must exist in the loaded snippets; remove options with unknown ids
   R8 strip any sentence containing patient-specific numeric glucose predictions (regex such as "your (glucose|blood sugar)[^.]*\d")
   R9 stamp output: provenance=GUIDELINE_AI, safety_checked=true, rules_triggered=[...], gemini_used, demo_fixture
   Also apply R3 and R8 to patient_summary.

6. clinical/fallback.py: conservative fixed plan (lifestyle, monitoring, "discuss therapy review with your clinician"), provenance GUIDELINE_AI, flagged fallback=true.

7. Endpoints (routers/clinical.py):
   - POST /patients/{id}/clinical-plan: build patient JSON from DB + twin summary, run reasoning, run governor, store in recommendations, write audit_log (gemini_used, model name, rules_triggered). Return plan plus sources (the snippets used) plus the governor trace.
   - GET /patients/{id}/therapy-scenarios: for each permitted therapy option, return a PROJECTION object built ONLY from the plan's expected_effect_literature text, with fields projection_label="Population-literature projection, not a twin prediction" and a range if the text contains one (parse leniently; otherwise range=null). Never pass these to the twin models.
   - POST /patients/{id}/plan: combined 4-week plan. Weeks 1-4, each with: lifestyle focus items (from lifestyle_interventions), twin-based meal advice (from compare-meals and best-time outputs for the patient's typical meals; provenance TWIN_PREDICTED), monitoring tasks, and a clinician review point at week 4. Each item carries its own provenance.

TESTS: one positive and one negative test per governor rule R1-R9 plus R4b; test that dosing text in patient_summary is removed; cache hit avoids a second LLM call (mock the client); MOCK_GEMINI path returns demo_fixture=true; unknown guideline id removal; 4-week plan items all carry provenance.

ACCEPTANCE: With MOCK_GEMINI=true the full clinical flow works offline; with a real key a call returns a governed plan; all tests pass.
```

---

## Phase 4: Frontend foundation

```
[GLOBAL RULES]

TASK: Create the React frontend foundation. Backend runs at http://localhost:8000.

STACK: Vite + React + TypeScript, Tailwind CSS, shadcn/ui, React Router, TanStack Query, Recharts, Framer Motion, lucide-react.

1. Design system (src/theme): dark slate background (#0B1220 range), teal accent (#14B8A6 range), warm amber for warnings, red for danger. Inter font. Chart palette: baseline grey, intervention teal, uncertainty band teal at 15% opacity, projection bands amber hatched. Define CSS variables once; light mode not required.

2. Layout: left sidebar (collapsible) with sections: Overview, Log Data, Prediction, Twin Learning, What-If Lab, Meal Tools, Clinical Plan, Therapy Scenarios, 4-Week Plan, Timeline, Cohort, Validation, Replay, Clinician View. Top bar: patient switcher (searchable select), patient mode / clinician mode toggle, and a permanent banner: "Research prototype, not a medical device." Banner must be visible on every page and in printed reports.

3. Reusable components:
   - ProvenanceBadge (TWIN_PREDICTED, GUIDELINE_AI, PROJECTION, plus SafetyChecked badge and DemoFixture badge); each has a tooltip explaining its meaning in one sentence.
   - StatCard, SectionCard, EmptyState, ErrorState (shows the backend error code/message), LoadingSkeleton.
   - UncertaintyChart: line/area chart showing median line plus p10-p90 band; props for baseline vs intervention overlay.
   - ConfidenceRing: circular progress with tooltip showing the confidence_score components.
   - TwinUpdatedPulse: brief animated highlight that plays when twin state changes.

4. src/api: typed client generated by hand from the FastAPI OpenAPI schema (fetch the /openapi.json and create types), TanStack Query hooks per endpoint, global error handling toast.

5. Pages in this phase:
   - Patient Setup: three tabs (New patient form with validation / Load CGMacros participant / Pick Shanghai-style profile). Shanghai and manual-demo patients show a visible "Synthetic demo patient" tag. After creation, set as active patient (persist active id in localStorage).
   - Twin Overview: profile card, ConfidenceRing, twin memory summary (mem_n, baseline_used shown as "Population baseline" or "Personalised"), recent activity, top alert area (placeholder cards allowed for later phases).
   - Log Data: tabs for Meal and Glucose reading. Meal form includes macros, time, pre-glucose, trend and optional observed outcomes (peak rise, iAUC, deltas). On save: call API, then show a before/after diff of twin state (mem_n, mean rise, confidence) with TwinUpdatedPulse.

6. Every page handles loading, empty, and error states. Keyboard accessible forms; no console errors.

ACCEPTANCE: `npm run dev` works; you can create a patient (all three modes), switch patients, log a meal and see the twin state diff; banner always visible; no TypeScript errors; basic Vitest tests for ProvenanceBadge and the confidence ring rendering.
```

---

## Phase 5: Frontend twin features

```
[GLOBAL RULES]

TASK: Build the twin-based pages using the existing design system and API hooks.

1. Prediction page: form (reuse meal fields) -> call /predict. Show four metric cards (peak rise, iAUC 2h, delta 60, delta 120) each with median and p10-p90 range, an UncertaintyChart where possible, ConfidenceRing, and a "Population baseline"/"Personalised" tag. If the API returns out_of_range, show an amber card listing each offending feature with value and allowed range, and no numbers.

2. Twin Learning page (the key demo page):
   - Left: pick a CGMacros participant; call /twin-learning/{id}; chart error or band width versus mem_n with a clear title and the API's `note` shown under the chart.
   - Right: the active patient's live memory counter and band width, with a "Log 3 sample meals" helper button ONLY for synthetic demo patients that fills 3 realistic meals using values sampled from meals_db rows (call the existing meals endpoint; label them "Sample entries from recorded data").
   - Animate the band narrowing when mem_n changes.

3. What-If Lab: carb reduction slider (0-50, step 5), post-meal walk toggle, meal inputs prefilled from the last meal. Debounce (400 ms) and call /whatif. Show baseline (grey) vs intervention (teal) with bands, median gain, pessimistic gain, and a large badge "Supported" (teal) or "Not supported" (amber) with tooltip explaining the rule. Animate curve transitions with Framer Motion.

4. Meal Tools page with three tabs:
   - Compare meals: add 2-4 candidate meals (name + macros), ranked results with bands and a "best choice" highlight.
   - Best time to eat: chart of predicted peak rise across the day with best and worst slots marked.
   - Daily planner: add meals with times; per-meal cards; worst meal highlighted; overlap warnings displayed as amber notes explaining the 2-hour model assumption.

5. Cohort page: histogram of mem_mean_rise across the 45 participants with the patient marked and percentile text ("more sensitive than X% of participants").

6. All numbers show units (mg/dL, mg/dL*min). Add tooltips explaining each metric in plain words. Add a "How was this calculated?" drawer on Prediction and What-If pages showing: model ensemble size, inputs used, memory values used, bounds check passed.

ACCEPTANCE: Walk the flow: new patient -> predict (wide bands, baseline tag) -> log 3 meals with outcomes -> predict again (narrower bands, personalised tag) -> what-if shows supported/not supported. No layout breakage at 1280px and 1920px widths.
```

---

## Phase 6: Frontend clinical features

```
[GLOBAL RULES]

TASK: Build the clinical pages. Everything here must show provenance badges accurately.

1. Clinical Plan page:
   - "Generate plan" button with a loading state, calling /clinical-plan. Show a banner chip DemoFixture if demo_fixture=true.
   - Sections: Therapy options to discuss with a clinician (cards: drug class, rationale, patient factors used as chips, expected effect from literature labelled "population-level", cautions, monitoring, guideline source chips that open a side drawer with the snippet text); Lifestyle interventions (with linked twin finding when present); Red flags (amber); Questions for your clinician; Missing information.
   - Badges per card: GUIDELINE_AI + SafetyChecked. Footer line: "Options for clinician review. This is not a prescription."
   - "Governor trace" collapsible panel listing triggered rule ids with plain-English explanation of each (map R1-R9, R4b to human text in a constants file).
   - Patient mode: show patient_summary prominently and hide technical cards behind "Show details". Clinician mode: show everything, including governor trace and sources by default.

2. Therapy Scenarios page: for each permitted option from /therapy-scenarios show a PROJECTION card: label text must read "Population-literature projection, not a twin prediction". If a range exists, render a hatched amber range bar (not a curve). If range is null show text only. Add a persistent info panel explaining why therapy effects are not twin-predicted (the models learned meal responses only).

3. 4-Week Plan and Care Pathway page: call /plan. Render a 4-column timeline (Week 1-4) with item cards, each with its own provenance badge; a final "Clinician review" milestone. Add a care-pathway graphic above: Current state -> Interventions -> Monitoring -> Review (simple SVG flow with the patient's current HbA1c and twin confidence in the first node).

4. Timeline page: vertical timeline of meals, glucose readings and generated recommendations with icons, filters by type, and click-through details.

5. Clinician View: dense layout combining profile, twin state, latest predictions, latest clinical plan, governor trace, audit entries for the patient (add GET /patients/{id}/audit in backend if missing), and a "Download report" button (wired in Phase 7).

ACCEPTANCE: With MOCK_GEMINI=true every page renders fully offline; with a real key the plan renders; changing patient to one with hypoglycaemia history true shows sulfonylurea/insulin options absent and a red flag; unknown history shows the caution and question; no text anywhere contains dosing language.
```

---

## Phase 7: Validation page, PDF report, live replay

```
[GLOBAL RULES]

TASK: Add validation, reporting and CGM replay.

1. GET /system/validation reads backend/metrics/validation.json. Frontend Validation page renders ONLY fields present:
   - Table: baseline vs twin MAE/RMSE per target with relative improvement %.
   - Line chart: error vs mem_n (the personalisation curve).
   - Calibration chart: nominal vs empirical coverage with the y=x reference line.
   - Limitations list (from the file).
   - Model Registry card: class, sklearn version, dataset sizes, training date.
   If the file is missing or a section is absent show "Not provided" for that section; never fabricate or fill defaults.

2. PDF report (backend/app/reports/pdf.py with ReportLab): GET /patients/{id}/report.pdf. Content: banner "Research prototype, not a medical device"; patient profile (mark synthetic where applicable); twin state and confidence; last predictions with ranges; last what-if result; clinical plan (therapy options to discuss, lifestyle, red flags, questions) with provenance labels; governor rules triggered; sources list; audit id. Two pages max; clean typography. Add a frontend Download button.

3. CGM replay: backend endpoints POST /replay/{participant_id}/start and GET /replay/{participant_id}/stream (Server-Sent Events) that stream recorded glucose points from the dataset if the CGMacros glucose time series is available in the backend/models folder (look for a configured path in .env REPLAY_DATA_PATH). If not available, return 503 with a clear message and make the page show an explanatory empty state. Replay speed control (1x, 10x, 60x). Page shows a live chart with meal markers, labelled "Replay of recorded data, not live monitoring", with the twin's predicted response drawn for each meal marker as it arrives.

TESTS: validation endpoint with full, partial and missing file; PDF endpoint returns application/pdf and non-trivial size; SSE endpoint yields events for a tiny fixture.

ACCEPTANCE: Validation page matches validation.json exactly; PDF opens and contains the banner and provenance labels; replay runs at three speeds.
```

---

## Phase 8: Packaging, seed data, polish

```
[GLOBAL RULES]

TASK: Make it demo-ready on a laptop.

1. scripts/seed_demo.py: create 3 labelled synthetic demo patients: (a) brand-new "Demo A" with mem_n=0, (b) "Demo B" linked to a CGMacros participant, (c) "Demo C" from a Shanghai-style profile with hypoglycaemia history true. Idempotent (running twice does not duplicate).

2. run_dev.sh and run_dev.ps1: create venv if missing, install requirements, start uvicorn on 8000 and the Vite dev server on 5173, open the browser. Include a clear message if model files or .env are missing.

3. Optional docker-compose.yml with backend and frontend; do not make it required.

4. README.md: overview, architecture diagram (mermaid), setup in 5 steps, env vars, how to export model_manifest.json and validation.json from Colab, the demo script (SPEC section 15), testing commands, and a "Limitations and responsible use" section stating: research prototype, not a medical device; twin trained on meal responses of 45 participants; therapy projections are literature-based and AI-generated; outputs are for clinician review.

5. Polish pass: consistent spacing, hover and focus states, skeleton loaders, empty states with helpful next-step buttons, page titles, favicon, favicon-matched app name "GlucoTwin". Remove all console warnings.

6. Full test run: pytest and Vitest. Fix failures. Provide a final checklist report.

ACCEPTANCE: From a clean clone, following README steps on a laptop gets the app running in under 10 minutes; seed script works; demo script runs end to end without errors.
```

---

## Phase 9 (optional): Final QA checklist

```
[GLOBAL RULES]

TASK: Audit the finished project. Do not add features.

Check and report PASS/FAIL with evidence for each:
1. No page or API response contains dosing language.
2. Every recommendation object includes provenance and safety_checked.
3. Therapy scenarios are never passed through the twin models.
4. Validation page shows only data from validation.json.
5. out_of_range inputs never return predictions.
6. Banner is visible on all pages and in the PDF.
7. MOCK_GEMINI fixtures are visibly labelled everywhere they appear.
8. Hypoglycaemia true/unknown and kidney_flag behaviours match the Governor spec.
9. Secrets are not committed; .env.example is complete.
10. All tests pass.
Fix any FAIL and re-report.
```
