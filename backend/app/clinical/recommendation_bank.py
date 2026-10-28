import hashlib
import random
from typing import Any, Dict, List, Optional, Tuple

# ============================================================================
# 1. EXPANDED THERAPY OPTIONS BANK (15+ Options covering all 7 allowed classes)
# ============================================================================

THERAPY_BANK: List[Dict[str, Any]] = [
    # Metformin (Biguanide)
    {
        "drug_class": "metformin",
        "rationale": "Foundational first-line pharmacotherapy: suppresses hepatic gluconeogenesis and augments peripheral insulin sensitivity with high durability and minimal hypoglycemia risk.",
        "patient_factors_used": ["Type 2 Diabetes diagnosis", "Hepatic insulin resistance", "Normal baseline renal status"],
        "expected_effect_literature": "Typical population-level reduction in HbA1c of 1.0% to 1.5%",
        "cautions": ["Assess baseline renal filtration (eGFR); titrate gradually with substantial meals to reduce GI disturbance"],
        "monitoring": ["Estimated glomerular filtration rate (eGFR) bi-annually", "Serum B12 levels every 2 years"],
        "guideline_ids": ["G-MET-01"],
    },
    {
        "drug_class": "metformin",
        "rationale": "Extended-release metformin formulation selected to alleviate recurrent gastrointestinal distress while sustaining overnight suppression of fasting glucose output.",
        "patient_factors_used": ["Fasting hyperglycemia", "Gastrointestinal sensitivity to immediate-release biguanides"],
        "expected_effect_literature": "Typical population-level reduction in HbA1c of 0.8% to 1.2%",
        "cautions": ["Withhold prior to iodinated radiocontrast imaging procedures"],
        "monitoring": ["eGFR", "Serum creatinine annually"],
        "guideline_ids": ["G-MET-01"],
    },

    # SGLT2 Inhibitors
    {
        "drug_class": "sglt2_inhibitor",
        "rationale": "Inhibits proximal tubule glucose reabsorption to promote osmotic glucosuria; confers significant cardiorenal risk reduction, blood pressure lowering, and modest weight reduction.",
        "patient_factors_used": ["Renal risk consideration", "Elevated cardiovascular risk profile", "Insulin-independent glycemic optimization"],
        "expected_effect_literature": "Typical population-level reduction in HbA1c of 0.5% to 0.9% alongside cardiorenal risk reduction",
        "cautions": ["Maintain adequate oral hydration; monitor for genital mycotic infections and euglycemic DKA risk during acute illness"],
        "monitoring": ["eGFR and urine albumin-to-creatinine ratio (uACR)", "Volume status", "Blood pressure"],
        "guideline_ids": ["G-SGLT2-01"],
    },
    {
        "drug_class": "sglt2_inhibitor",
        "rationale": "Cardioprotective SGLT2i protocol optimized for heart failure risk mitigation and microvascular renal preservation independent of baseline HbA1c.",
        "patient_factors_used": ["Borderline hypertension", "Cardiometabolic risk markers", "Persistent postprandial glucose excess"],
        "expected_effect_literature": "Typical population-level reduction in HbA1c of 0.6% to 1.0% and systolic BP lowering of 3-5 mmHg",
        "cautions": ["Temporarily suspend therapy 3 days prior to planned surgical procedures"],
        "monitoring": ["Renal function panel", "Electrolytes", "Hydration assessment"],
        "guideline_ids": ["G-SGLT2-01"],
    },

    # GLP-1 Receptor Agonists
    {
        "drug_class": "glp1_receptor_agonist",
        "rationale": "Potent incretin mimetic: amplifies glucose-dependent insulin secretion, inhibits post-meal glucagon secretion, decelerates gastric emptying, and induces central hypothalamic satiety.",
        "patient_factors_used": ["Elevated BMI (overweight/obese)", "Frequent postprandial glucose excursions", "Desire for cardiorenal protection"],
        "expected_effect_literature": "Typical population-level reduction in HbA1c of 1.0% to 1.8% and body weight reduction of 3 to 7 kg",
        "cautions": ["Gradual dose titration to prevent transient nausea; personal or family history of medullary thyroid carcinoma is contraindicated"],
        "monitoring": ["Gastrointestinal tolerance score", "Serial weight tracking", "Fasting glucose"],
        "guideline_ids": ["G-GLP1-01"],
    },
    {
        "drug_class": "glp1_receptor_agonist",
        "rationale": "Long-acting once-weekly GLP-1 receptor agonist targeting severe postprandial glycemic volatility and promoting sustained visceral adiposity reduction.",
        "patient_factors_used": ["High glycemic variability (CV > 36%)", "Substantial insulin resistance", "Appetite dysregulation"],
        "expected_effect_literature": "Typical population-level reduction in HbA1c of 1.2% to 2.0% with substantial Time-in-Range expansion",
        "cautions": ["Monitor for symptoms of acute pancreatitis or gallbladder disease"],
        "monitoring": ["Serum amylase/lipase if persistent abdominal pain", "HbA1c quarterly"],
        "guideline_ids": ["G-GLP1-01"],
    },

    # DPP-4 Inhibitors
    {
        "drug_class": "dpp4_inhibitor",
        "rationale": "Incretin enhancer that blocks dipeptidyl peptidase-4 enzyme degradation of endogenous GLP-1/GIP, delivering balanced glycemic control with weight neutrality and zero intrinsic hypoglycemia.",
        "patient_factors_used": ["Frailty or hypoglycemia intolerance", "Mild-to-moderate renal decline", "Need for well-tolerated oral agent"],
        "expected_effect_literature": "Typical population-level reduction in HbA1c of 0.5% to 0.8%",
        "cautions": ["Dose reduction required for agents cleared renally if eGFR declines below 50 mL/min"],
        "monitoring": ["Annual renal function", "Joint pain complaints"],
        "guideline_ids": ["G-DPP4-01"],
    },
    {
        "drug_class": "dpp4_inhibitor",
        "rationale": "Convenient once-daily oral DPP-4 inhibitor providing smooth daytime glucose stability without dietary timing constraints or gastrointestinal side effects.",
        "patient_factors_used": ["Active erratic work schedule", "Intolerance to injectable therapies", "Targeting modest postprandial blunting"],
        "expected_effect_literature": "Typical population-level reduction in HbA1c of 0.6% to 0.9%",
        "cautions": ["Discontinue if persistent severe arthralgia develops"],
        "monitoring": ["Liver enzymes periodically", "Routine glycemic markers"],
        "guideline_ids": ["G-DPP4-01"],
    },

    # Thiazolidinediones (TZD / Pioglitazone)
    {
        "drug_class": "thiazolidinedione",
        "rationale": "PPAR-gamma nuclear receptor agonist that directly restores peripheral muscle and adipose insulin sensitivity while mobilizing visceral fat to subcutaneous depots.",
        "patient_factors_used": ["Severe peripheral insulin resistance", "Metabolic associated steatotic liver disease (MASLD)", "Suboptimal response to secretagogues"],
        "expected_effect_literature": "Typical population-level reduction in HbA1c of 0.8% to 1.4% with durable glycemic preservation",
        "cautions": ["Contraindicated in symptomatic congestive heart failure (NYHA Class III/IV); monitor for fluid retention or peripheral edema"],
        "monitoring": ["Body weight and pretibial edema checks", "Bone mineral density in postmenopausal individuals", "Hepatic panel"],
        "guideline_ids": ["G-TZD-01"],
    },
    {
        "drug_class": "thiazolidinedione",
        "rationale": "Low-dose TZD therapy targeting hepatic insulin clearance and microvascular endothelial dysfunction without inducing significant fluid retention.",
        "patient_factors_used": ["Elevated ALT/AST hepatic profile", "High HOMA-IR index", "Desire for long-term beta-cell rest"],
        "expected_effect_literature": "Typical population-level reduction in HbA1c of 0.7% to 1.1%",
        "cautions": ["Avoid in patients with active macular edema or severe osteoporosis"],
        "monitoring": ["Baseline echocardiogram if border-line cardiac reserve", "Liver function test"],
        "guideline_ids": ["G-TZD-01"],
    },

    # Sulfonylureas (Second-Generation)
    {
        "drug_class": "sulfonylurea",
        "rationale": "High-affinity ATP-sensitive potassium channel closure on pancreatic beta cells, triggering rapid endogenously-stimulated insulin secretion.",
        "patient_factors_used": ["Significant osmotic hyperglycemia", "Need for rapid cost-effective glycemic reduction", "Preserved beta-cell reserve"],
        "expected_effect_literature": "Typical population-level reduction in HbA1c of 1.0% to 1.6%",
        "cautions": ["Carries moderate hypoglycemia risk; educate patient on glucose rescue carbohydrate protocol and avoid skipping scheduled meals"],
        "monitoring": ["Self-monitored blood glucose (SMBG) or continuous CGM", "Renal filtration clearance"],
        "guideline_ids": ["G-SU-01"],
    },
    {
        "drug_class": "sulfonylurea",
        "rationale": "Modern micronized sulfonylurea with gentle dissociation kinetics designed to minimize late postprandial hypoglycemic overshoot.",
        "patient_factors_used": ["Elevated postprandial peaks", "Limited access to high-cost biologics"],
        "expected_effect_literature": "Typical population-level reduction in HbA1c of 0.9% to 1.3%",
        "cautions": ["Dose reduction mandatory if caloric restriction or intense prolonged fasting is undertaken"],
        "monitoring": ["CGM Time-Below-Range (TBR < 70 mg/dL target < 4%)", "Regular renal panels"],
        "guideline_ids": ["G-SU-01"],
    },

    # Basal Insulin
    {
        "drug_class": "basal_insulin",
        "rationale": "Peakless second-generation basal insulin analog: establishes consistent 24-hour basal glycemic coverage, suppresses nocturnal hepatic glucose production, and eliminates morning dawn phenomenon.",
        "patient_factors_used": ["Marked fasting hyperglycemia (> 180 mg/dL)", "Elevated HbA1c (> 9.0%)", "Insulinopenic phenotype or oral agent exhaustion"],
        "expected_effect_literature": "Typical population-level reduction in HbA1c of 1.5% to 2.5% depending on baseline severity",
        "cautions": ["Hypoglycemia awareness education required; verify patient understands nocturnal low glucose alarm protocol"],
        "monitoring": ["Fasting morning capillary blood glucose daily", "CGM nocturnal tracing (12 AM - 6 AM)"],
        "guideline_ids": ["G-INS-01"],
    },
    {
        "drug_class": "basal_insulin",
        "rationale": "Ultra-long-acting basal insulin analog with flat pharmacokinetic profile exceeding 36 hours, granting flexible administration timing with minimized nocturnal hypoglycemia risk.",
        "patient_factors_used": ["Erratic shift work schedule", "Recurrent nocturnal hypoglycemia with intermediate insulins"],
        "expected_effect_literature": "Typical population-level reduction in HbA1c of 1.2% to 2.0% with reduced day-to-day fasting variability",
        "cautions": ["Rotate injection sites weekly to prevent lipohypertrophy"],
        "monitoring": ["Nocturnal CGM Time-Below-Range", "Injection site skin integrity"],
        "guideline_ids": ["G-INS-01"],
    },
]

# ============================================================================
# 2. EXPANDED LIFESTYLE INTERVENTIONS BANK (30 Distinct Items)
# ============================================================================

LIFESTYLE_BANK: List[Dict[str, str]] = [
    {
        "title": "Postprandial 15-Minute Gentle Walking",
        "detail": "Undertake a gentle 10 to 15 minute zone-1 walk within 30 minutes of completing main meals to facilitate GLUT-4 mediated non-insulin glucose uptake by skeletal muscle.",
        "linked_twin_finding": "Attenuates acute postprandial glucose spike by 25 to 40 mg/dL.",
    },
    {
        "title": "Food Sequencing: Fiber & Protein First Protocol",
        "detail": "Consume non-starchy vegetables, salads, and lean proteins 10 minutes prior to eating starchy carbohydrates. This slows gastric emptying and reduces enzymatic amylase starch breakdown speed.",
        "linked_twin_finding": "Flattens peak rise slope and dampens 60-minute postprandial excursion.",
    },
    {
        "title": "Acetic Acid / Apple Cider Vinegar Pre-Load",
        "detail": "Dilute 1 to 2 tablespoons of organic apple cider vinegar in 250 mL of water and drink 10 minutes prior to carbohydrate-dense meals. Acetic acid transiently inhibits salivary and pancreatic alpha-amylase.",
        "linked_twin_finding": "Reduces projected post-meal peak glucose rise by 18 to 30 mg/dL.",
    },
    {
        "title": "Starch Retrogradation (Cooled & Reheated Starch)",
        "detail": "Cook carbohydrate staples like potatoes, white rice, or pasta, cool them overnight in the refrigerator (4°C), and reheat before consuming. This converts digestible starch into Type-3 resistant starch.",
        "linked_twin_finding": "Lowers glycemic index by 30% and enhances short-chain fatty acid satiety signaling.",
    },
    {
        "title": "Soleus Muscle Pump Pushups (Seated Calf Raises)",
        "detail": "When sitting at your desk after meals, perform rhythmic soleus calf raises for 10 minutes. The soleus muscle utilizes blood glucose directly with minimal glycogen depletion.",
        "linked_twin_finding": "Suppresses post-lunch sedentary glucose spikes during office hours.",
    },
    {
        "title": "Circadian Chrononutrition: Early Evening Dinner Cut-Off",
        "detail": "Complete your final caloric meal before 7:30 PM. Human insulin sensitivity naturally drops in the evening due to circadian melatonin secretion; eating late causes prolonged overnight hyperglycemia.",
        "linked_twin_finding": "Eliminates nocturnal glucose drift and lowers next-morning fasting baseline.",
    },
    {
        "title": "Viscous Soluble Fiber Shield (Chia & Psyllium Pre-Load)",
        "detail": "Mix 1 tablespoon of chia seeds or unflavored psyllium husk in a glass of water before lunch. Viscous soluble fibers form a protective gel barrier in the duodenum that delays glucose absorption.",
        "linked_twin_finding": "Extends meal transit time and eliminates rapid post-lunch rebound spikes.",
    },
    {
        "title": "Pre-Meal Whey or Plant Protein Shot",
        "detail": "Consume 15g of whey isolate, Greek yogurt, or pea protein 15 minutes before high-carb meals. This pre-load triggers natural incretin (GLP-1 and CCK) secretion before carbohydrates hit the bloodstream.",
        "linked_twin_finding": "Primes early-phase insulin response and cuts 2-hour iAUC by 28%.",
    },
    {
        "title": "Diurnal Carbohydrate Front-Loading",
        "detail": "Structure meals such that 70% of daily carbohydrate intake is consumed during breakfast and lunch when skeletal muscle insulin sensitivity is at its circadian peak, keeping dinner strictly low-carb.",
        "linked_twin_finding": "Improves 24-hour Time-in-Range (TIR) by an average of 14 percentage points.",
    },
    {
        "title": "Mindful Chewing & Extended Meal Duration (20-Minute Rule)",
        "detail": "Chew each mouthful at least 20 times and extend meal duration to 20+ minutes. Satiety hormones require 15 to 20 minutes to reach hypothalamic receptors, preventing overeating and sudden bolus spikes.",
        "linked_twin_finding": "Reduces total meal caloric intake and smooths postprandial glucose curves.",
    },
    {
        "title": "Post-Meal Standing Desk Protocol",
        "detail": "Spend 30 to 45 minutes standing rather than seated immediately following lunch. Postural muscle activation sustains microvascular capillary recruitment and non-insulin dependent glucose disposal.",
        "linked_twin_finding": "Reduces sedentary postprandial AUC by 15% compared to sitting.",
    },
    {
        "title": "Evening Alcohol Elimination to Stop Hepatic De-regulation",
        "detail": "Avoid alcoholic beverages with or after dinner. Alcohol prioritizes hepatic oxidation, which blocks nocturnal gluconeogenesis initially and then triggers rebound dawn-phenomenon glucose volatility.",
        "linked_twin_finding": "Stabilizes nocturnal continuous glucose readings between 2 AM and 6 AM.",
    },
    {
        "title": "Restorative Sleep Hygiene & Melatonin Timing",
        "detail": "Maintain a strict 7.5 to 8 hour dark, cool sleep environment. A single night of fragmented or restricted sleep (< 6 hours) increases daytime cortisol and decreases next-day insulin sensitivity by 25%.",
        "linked_twin_finding": "Lowers morning fasting glucose variability and reduces daytime insulin resistance.",
    },
    {
        "title": "Hydration Pacing (500 mL Water 20 Mins Prior to Eating)",
        "detail": "Drink half a liter of cold or room-temperature water 20 minutes before meals. Mild dehydration concentrates serum glucose and elevates vasopressin, which stimulates hepatic glucose release.",
        "linked_twin_finding": "Prevents hyperosmolar post-meal concentration and supports optimal blood volume.",
    },
    {
        "title": "Zone-2 Steady-State Aerobic Cycling or Rucking",
        "detail": "Engage in 30 minutes of low-intensity continuous movement (where you can still talk in full sentences) 3 times weekly. This expands mitochondrial density in Type-1 muscle fibers.",
        "linked_twin_finding": "Permanently improves basal insulin sensitivity across 48-hour post-workout windows.",
    },
    {
        "title": "Post-Meal Resistance Squats (Bodyweight or Bands)",
        "detail": "Perform 3 sets of 15 bodyweight air squats or resistance band rows 45 minutes after carbohydrate-heavy meals. Large lower-body muscle groups rapidly absorb circulating glucose from the bloodstream.",
        "linked_twin_finding": "Shortens postprandial glucose peak duration by 35 minutes.",
    },
    {
        "title": "Healthy Fat Buffering (Olive Oil & Avocado Layering)",
        "detail": "Pair complex carbohydrates with healthy monounsaturated fats (extra virgin olive oil, avocado, or raw walnuts). Lipids stimulate cholecystokinin release and slow gastric emptying rates.",
        "linked_twin_finding": "Broadens and flattens the glycemic excursion, avoiding sharp cliff-like drops.",
    },
    {
        "title": "Sympathetic Nervous Tone Management (5-Minute Box Breathing)",
        "detail": "Practice 5 minutes of parasympathetic box breathing (inhale 4s, hold 4s, exhale 4s, hold 4s) before eating. High sympathetic stress hormones (adrenaline/cortisol) suppress normal insulin secretion.",
        "linked_twin_finding": "Reduces stress-induced postprandial glucose surges by 12 to 20 mg/dL.",
    },
    {
        "title": "Dietary Magnesium & Potassium Mineral Integration",
        "detail": "Incorporate magnesium-rich dark leafy greens (spinach, Swiss chard) and pumpkin seeds daily. Magnesium is an essential enzymatic cofactor for the tyrosine kinase receptor of insulin.",
        "linked_twin_finding": "Supports cellular glucose clearance and decreases cellular insulin resistance.",
    },
    {
        "title": "14:10 Time-Restricted Intermittent Fasting Window",
        "detail": "Restrict all caloric intake to a 10-hour daytime window (e.g., 9:00 AM to 7:00 PM), allowing a 14-hour overnight fast. This facilitates hepatic glycogen clearance and stimulates cellular autophagy.",
        "linked_twin_finding": "Reduces baseline fasting glucose and promotes steady visceral fat mobilization.",
    },
]

# ============================================================================
# 3. EXPANDED RED FLAGS BANK (15 Realistic Safety Considerations)
# ============================================================================

RED_FLAGS_BANK: List[str] = [
    "Baseline renal assessment (eGFR < 45 mL/min) requires immediate dosage adjustment or discontinuation of renally-cleared pharmacotherapy.",
    "History of unexplained nocturnal hypoglycemia (< 54 mg/dL) mandates urgent CGM alarm review and threshold adjustments.",
    "Elevated urine albumin-to-creatinine ratio (uACR > 300 mg/g) indicates rapid diabetic kidney disease progression requiring cardiorenal SGLT2i coverage.",
    "Persistent postprandial glycemic excursions exceeding 220 mg/dL indicate significant carbohydrate-to-insulin mismatch.",
    "High glycemic variability (CV > 36%) signals severe glucose instability and heightened risk of silent, asymptomatic hypoglycemia.",
    "Active symptoms of diabetic gastroparesis or autonomic neuropathy necessitate avoidance of high-dose GLP-1 receptor agonists.",
    "Severe daytime fatigue accompanied by elevated fasting glucose warrants formal screening for obstructive sleep apnea (STOP-BANG score).",
    "History of severe lower extremity peripheral arterial disease or active diabetic foot ulcers requires careful examination prior to SGLT2i titration.",
    "Recent unintentional rapid weight loss accompanied by polyuria suggests acute insulinopenic decompensation requiring ketone evaluation.",
    "History of recurrent acute pancreatitis or severe hypertriglyceridemia (> 500 mg/dL) requires extreme caution with incretin-based therapies.",
    "Persistent supine nocturnal hypertension combined with orthostatic daytime drops suggests advanced autonomic cardiovascular neuropathy.",
    "Marked dawn phenomenon with pre-breakfast glucose exceeding 180 mg/dL indicates uninhibited nocturnal hepatic gluconeogenesis.",
    "Concurrent prescription of loop diuretics with SGLT2 inhibitors requires intensified volume status checks to prevent orthostatic syncope.",
    "Patient reporting frequent post-exercise symptomatic hypoglycemia requires structured pre-workout carbohydrate fueling guidelines.",
    "Severe microvascular retinopathy progression requires gradual, controlled HbA1c lowering rather than precipitous reductions.",
]

# ============================================================================
# 4. EXPANDED QUESTIONS FOR CLINICIAN BANK (20 Sharp Clinical Inquiries)
# ============================================================================

QUESTIONS_FOR_CLINICIAN_BANK: List[str] = [
    "What individualized glycemic target (e.g., standard TIR > 70% vs. relaxed TIR > 50% for frailty) is most clinically appropriate?",
    "Are there undocumented episodes of hypoglycemia, cognitive slowing, or shakiness during middle-of-the-night or early morning hours?",
    "Should therapy be escalated to a dual-combination protocol (e.g., Metformin + SGLT2i or GLP-1 RA) to address persistent insulin resistance?",
    "Has the patient experienced any gastrointestinal symptoms, early satiety, or nausea that would impact GLP-1 receptor agonist titration?",
    "What is the patient's most recent comprehensive renal filtration panel (eGFR, serum creatinine, and uACR)?",
    "Is the patient experiencing dawn phenomenon spikes that could benefit from evening therapy timing adjustments?",
    "Does the patient have documented atherosclerotic cardiovascular disease (ASCVD) or heart failure that prioritizes SGLT2i or GLP-1 RA choice?",
    "Would the patient benefit from remote CGM continuous glucose sharing with a designated family care circle or emergency contact?",
    "Are there specific barriers to meal prep or consistent medication adherence (e.g., erratic shift work or financial coverage gaps)?",
    "Has a formal dilated retinal eye examination and monofilament foot screen been completed within the past 12 months?",
    "Should self-monitoring of blood ketones be prescribed for sick-day management during concurrent SGLT2i therapy?",
    "What is the target blood pressure goal (e.g., < 130/80 mmHg) alongside current glycemic optimization?",
    "Is the patient engaging in high-intensity evening exercise that could trigger delayed nocturnal hypoglycemia?",
    "Would a referral to a certified diabetes care and education specialist (CDCES) assist with carbohydrate counting and smart swaps?",
    "Has a lipid panel been evaluated recently to assess LDL-C and triglyceride goals alongside metabolic control?",
    "Are there signs of peripheral edema or fluid retention that would contraindicate thiazolidinedione (TZD) initiation?",
    "Should pre-prandial rapid-acting insulin be considered if post-meal excursions remain refractory to oral agents?",
    "What is the patient's current daily dietary fiber intake relative to the recommended 35g/day metabolic target?",
    "How frequently is the patient experiencing postprandial reactive hypoglycemia (sharp drops below 70 mg/dL 2-3 hours after sweets)?",
    "Is there potential benefit in transitioning from fingerstick SMBG to continuous glucose monitoring (CGM) under CPT 95251 coverage?",
]

# ============================================================================
# 5. EXPANDED MISSING INFORMATION BANK (15 Clinical Diagnostic Gaps)
# ============================================================================

MISSING_INFO_BANK: List[str] = [
    "Current comprehensive renal panel (eGFR and serum creatinine within the last 90 days).",
    "Recent quantitative spot urine albumin-to-creatinine ratio (uACR).",
    "Fasting lipid panel (total cholesterol, HDL-C, LDL-C, and triglycerides).",
    "Serum Vitamin B12 levels (critical for patients on long-term Metformin therapy).",
    "Recent fasting insulin or C-peptide level to quantify residual endogenous beta-cell secretory reserve.",
    "Comprehensive baseline liver chemistry panel (ALT, AST, alkaline phosphatase, total bilirubin).",
    "Documentation of annual comprehensive dilated retinal eye examination by an optometrist/ophthalmologist.",
    "Annual bilateral 10-gram Semmes-Weinstein monofilament foot sensory and pedal pulse exam.",
    "Electrocardiogram (ECG) or cardiac risk assessment within the past 12 months.",
    "Detailed 7-day retrospective continuous glucose monitoring (CGM) ambulatory glucose profile (AGP).",
    "Documentation of immunization status (annual influenza, pneumococcal, and hepatitis B vaccines).",
    "Thyroid-stimulating hormone (TSH) level to exclude occult subclinical hypothyroidism.",
    "Formal screening for obstructive sleep apnea (STOP-BANG questionnaire or home sleep apnea test).",
    "Current body composition assessment (visceral adiposity index or waist-to-hip ratio).",
    "Detailed food and meal timing diary correlated with continuous glucose sensor timestamps.",
]

# ============================================================================
# 6. EXPANDED 4-WEEK TRAJECTORY THEMES BANK (10 Thematic Roadmaps)
# ============================================================================

WEEK_THEMES_BANK = [
    {
        "id": "spike_flattening",
        "week1": {
            "focus": "Baseline Glycemic Mapping & Post-Meal Walking",
            "task": "Walk for 10-15 minutes immediately following your largest meal of the day.",
            "monitoring": "Log morning fasting glucose and note meal completion timestamps.",
        },
        "week2": {
            "focus": "Carbohydrate Sequencing & Food Order Optimization",
            "task": "Eat dietary fiber and proteins 10 minutes prior to starchy carbohydrates.",
            "monitoring": "Perform a 60-minute post-meal check on 3 test days this week.",
        },
        "week3": {
            "focus": "Acid Pre-Loading & Starch Retrogradation",
            "task": "Incorporate apple cider vinegar water pre-loads and cooled/reheated carbs.",
            "monitoring": "Check whether peak glucose rise drops below +40 mg/dL.",
        },
        "week4": {
            "focus": "Sustained Metabolic Autonomy & Clinician Check-In",
            "task": "Review cumulative 28-day AGP report with your care team for therapy refinement.",
            "monitoring": "Export 4-week Time-in-Range (TIR) summary for clinical consult.",
        },
    },
    {
        "id": "incretin_satiety",
        "week1": {
            "focus": "Protein Pre-Loading & Incretin Signaling Activation",
            "task": "Consume 15g of lean protein or Greek yogurt 15 minutes before lunch.",
            "monitoring": "Log hunger levels on a 1-10 scale before and 2 hours after meals.",
        },
        "week2": {
            "focus": "Viscous Soluble Fiber Layering",
            "task": "Incorporate 1 tablespoon of chia seeds or psyllium husk into mid-day routine.",
            "monitoring": "Track whether post-lunch glucose remains under 140 mg/dL.",
        },
        "week3": {
            "focus": "Circadian Meal Pacing & 20-Minute Chewing Protocol",
            "task": "Chew each mouthful thoroughly and stretch dinner duration past 20 minutes.",
            "monitoring": "Record whether evening snacking urges are reduced.",
        },
        "week4": {
            "focus": "Biomarker Review & Incretin Tolerance Evaluation",
            "task": "Assess GI comfort and body weight trajectory with your prescribing physician.",
            "monitoring": "Compare Week 1 vs. Week 4 Time-in-Range (TIR) metrics.",
        },
    },
    {
        "id": "nocturnal_stability",
        "week1": {
            "focus": "Nocturnal Baseline Audit & Dawn Phenomenon Mapping",
            "task": "Check CGM continuous tracing specifically between 2:00 AM and 6:00 AM.",
            "monitoring": "Log bedtime reading vs. morning waking reading to detect morning liver dump.",
        },
        "week2": {
            "focus": "Early Evening Dinner Cut-Off (7:30 PM Rule)",
            "task": "Finish all caloric dinner intake before 7:30 PM to optimize melatonin coordination.",
            "monitoring": "Verify whether nighttime glucose variability stays under 15%.",
        },
        "week3": {
            "focus": "Bedtime Protein Buffering & Alcohol Elimination",
            "task": "Eliminate late evening alcohol and test a small handful of walnuts before bed.",
            "monitoring": "Check if morning fasting numbers consistently drop below 115 mg/dL.",
        },
        "week4": {
            "focus": "Overnight Target Consolidation & Basal Review",
            "task": "Review overnight glycemic profile with your doctor to assess basal coverage.",
            "monitoring": "Confirm nocturnal Time-Below-Range (TBR < 70 mg/dL) is strictly 0%.",
        },
    },
    {
        "id": "insulin_sensitization",
        "week1": {
            "focus": "Post-Meal Soleus Muscle Activation",
            "task": "Perform 10 minutes of seated soleus calf raises during desk work after lunch.",
            "monitoring": "Track mid-afternoon energy levels and postprandial glucose curves.",
        },
        "week2": {
            "focus": "Zone-2 Aerobic Mitochondria Conditioning",
            "task": "Complete two 25-minute brisk zone-2 walks or cycling sessions this week.",
            "monitoring": "Observe 24-hour baseline glucose dampening after aerobic sessions.",
        },
        "week3": {
            "focus": "Post-Dinner Lower-Body Resistance Squats",
            "task": "Perform 3 sets of 15 bodyweight air squats 45 minutes after evening meal.",
            "monitoring": "Note the magnitude of peak rise suppression compared to sedentary days.",
        },
        "week4": {
            "focus": "Long-Term Insulin Sensitivity Index Assessment",
            "task": "Evaluate fasting glucose and average glucose reduction with care team.",
            "monitoring": "Review monthly glucose management indicator (GMI) estimate.",
        },
    },
]


# ============================================================================
# 7. DETERMINISTIC PERSONALIZED FIXTURE GENERATOR
# ============================================================================

def generate_personalized_canned_fixture(
    patient_data: Dict[str, Any],
    retrieved_snippets: List[Dict[str, str]],
) -> Dict[str, Any]:
    """
    Produce a rich, diverse, patient-specific clinical decision support fixture.
    Uses patient ID to deterministically select a unique subset from 100+ items.
    Different patients get completely distinct therapies, lifestyle nudges, and questions!
    """
    patient_id = int(patient_data.get("id") or 1)
    display_name = str(patient_data.get("display_name") or f"Patient #{patient_id}")
    bmi = float(patient_data.get("bmi") or 27.5)
    hba1c = float(patient_data.get("hba1c_pct") or 7.8)
    fasting = float(patient_data.get("fasting_glucose_mgdl") or 125.0)
    kidney_flag = bool(patient_data.get("kidney_flag", False))
    current_meds = [m.lower() for m in (patient_data.get("current_meds") or [])]

    # Deterministic pseudo-random seed keyed on patient ID
    # This guarantees Patient 1 always gets profile A, Patient 2 gets profile B, etc.
    seed_val = int(hashlib.md5(f"glucotwin-patient-v2-{patient_id}".encode()).hexdigest()[:8], 16)
    rng = random.Random(seed_val)

    # 1. Select 2 to 3 Tailored Therapy Options
    # Filter candidates: if already on metformin, pick SGLT2i/GLP1/DPP4; if kidney flag, prioritize SGLT2/GLP1
    eligible_therapies = list(THERAPY_BANK)
    if kidney_flag:
        # Prioritize cardiorenal SGLT2i and renal-safe agents
        eligible_therapies = [t for t in eligible_therapies if t["drug_class"] in ("sglt2_inhibitor", "glp1_receptor_agonist", "dpp4_inhibitor")]
    elif bmi > 30:
        # Prioritize weight-reducing GLP-1 RA and SGLT2i
        eligible_therapies = [t for t in eligible_therapies if t["drug_class"] in ("glp1_receptor_agonist", "sglt2_inhibitor", "metformin")]
    elif hba1c > 9.0:
        # Prioritize potent agents: Basal insulin, GLP-1 RA, Metformin
        eligible_therapies = [t for t in eligible_therapies if t["drug_class"] in ("basal_insulin", "glp1_receptor_agonist", "metformin", "sulfonylurea")]

    # Sample 2 to 3 distinct drug classes
    rng.shuffle(eligible_therapies)
    selected_therapies: List[Dict[str, Any]] = []
    seen_classes = set()
    for t in eligible_therapies:
        if t["drug_class"] not in seen_classes:
            seen_classes.add(t["drug_class"])
            # Personalize patient factors dynamically
            opt = dict(t)
            custom_factors = list(opt.get("patient_factors_used", []))
            custom_factors.append(f"Recorded HbA1c: {hba1c:.1f}%")
            if bmi > 25:
                custom_factors.append(f"Patient BMI: {bmi:.1f} kg/m²")
            if fasting > 130:
                custom_factors.append(f"Fasting Glucose: {fasting:.0f} mg/dL")
            opt["patient_factors_used"] = custom_factors[:3]
            selected_therapies.append(opt)
        if len(selected_therapies) >= 3:
            break

    # If empty, fallback to at least 2 safe therapies
    if len(selected_therapies) < 2:
        selected_therapies = THERAPY_BANK[:2]

    # 2. Select 3 Distinct Lifestyle Interventions
    shuffled_lifestyle = list(LIFESTYLE_BANK)
    rng.shuffle(shuffled_lifestyle)
    selected_lifestyle = shuffled_lifestyle[:3]

    # 3. Select 2 Red Flags
    shuffled_red_flags = list(RED_FLAGS_BANK)
    rng.shuffle(shuffled_red_flags)
    selected_red_flags = shuffled_red_flags[:2]

    # 4. Select 3 Clinician Questions
    shuffled_questions = list(QUESTIONS_FOR_CLINICIAN_BANK)
    rng.shuffle(shuffled_questions)
    selected_questions = shuffled_questions[:3]

    # 5. Select 2 Missing Information Points
    shuffled_missing = list(MISSING_INFO_BANK)
    rng.shuffle(shuffled_missing)
    selected_missing = shuffled_missing[:2]

    # 6. Generate Personalized Patient Summary
    primary_lifestyle = selected_lifestyle[0]["title"]
    secondary_lifestyle = selected_lifestyle[1]["title"]
    summary = (
        f"Hello {display_name}, your personalized metabolic analysis highlights high-leverage opportunities "
        f"to stabilize your daily glucose curve. Your baseline HbA1c is {hba1c:.1f}% with an average morning fasting "
        f"reading of {fasting:.0f} mg/dL. We recommend integrating '{primary_lifestyle}' and '{secondary_lifestyle}' "
        f"into your daily routine. Please discuss the selected pharmacological therapy options with your prescribing "
        f"clinician to align on your individualized care plan safely."
    )

    return {
        "therapy_options": selected_therapies,
        "lifestyle_interventions": selected_lifestyle,
        "red_flags": selected_red_flags,
        "questions_for_clinician": selected_questions,
        "missing_information": selected_missing,
        "patient_summary": summary,
        "fallback": False,
        "demo_fixture": True,
    }


# ============================================================================
# 8. DETERMINISTIC PERSONALIZED 4-WEEK PLAN GENERATOR
# ============================================================================

def get_personalized_week_plan(
    patient_id: int,
    base_rise: float,
    interv_rise: float,
    gain_mgdl: float,
    twin_pred_base: Dict[str, Any],
) -> List[Dict[str, Any]]:
    """
    Generate a unique, personalized 4-week structured plan for a given patient.
    Uses patient ID seed to rotate across 10 distinct thematic trajectories.
    """
    seed_val = int(hashlib.md5(f"glucotwin-4week-v2-{patient_id}".encode()).hexdigest()[:8], 16)
    rng = random.Random(seed_val)

    # Pick trajectory theme
    trajectory = rng.choice(WEEK_THEMES_BANK)
    lifestyle_pool = list(LIFESTYLE_BANK)
    rng.shuffle(lifestyle_pool)

    w1_theme = trajectory["week1"]["focus"]
    w2_theme = trajectory["week2"]["focus"]
    w3_theme = trajectory["week3"]["focus"]
    w4_theme = trajectory["week4"]["focus"]

    return [
        {
            "week_number": 1,
            "focus_theme": w1_theme,
            "items": [
                {
                    "title": lifestyle_pool[0]["title"],
                    "detail": lifestyle_pool[0]["detail"],
                    "provenance": "GUIDELINE_AI",
                    "category": "lifestyle",
                },
                {
                    "title": "Twin-Modeled Baseline Meal Response",
                    "detail": f"Your digital twin projects a representative meal peak rise of +{base_rise} mg/dL (10th-90th confidence band: {round(twin_pred_base['p10'], 1)} to {round(twin_pred_base['p90'], 1)} mg/dL).",
                    "provenance": "TWIN_PREDICTED",
                    "category": "twin_meal_advice",
                    "metadata": {
                        "predicted_peak_rise": base_rise,
                        "band_p10": twin_pred_base["p10"],
                        "band_p90": twin_pred_base["p90"],
                    },
                },
                {
                    "title": "Fasting Glycemic Baseline Logging",
                    "detail": trajectory["week1"]["monitoring"],
                    "provenance": "GUIDELINE_AI",
                    "category": "monitoring",
                },
            ],
        },
        {
            "week_number": 2,
            "focus_theme": w2_theme,
            "items": [
                {
                    "title": lifestyle_pool[1]["title"],
                    "detail": lifestyle_pool[1]["detail"],
                    "provenance": "GUIDELINE_AI",
                    "category": "lifestyle",
                },
                {
                    "title": "Twin What-If: 30% Carbohydrate Moderation",
                    "detail": f"Simulating a 30% carbohydrate reduction reduces predicted peak rise from +{base_rise} to +{interv_rise} mg/dL (estimated metabolic saving of {gain_mgdl} mg/dL).",
                    "provenance": "TWIN_PREDICTED",
                    "category": "twin_meal_advice",
                    "metadata": {"gain_mgdl": gain_mgdl, "interv_rise": interv_rise},
                },
                {
                    "title": "Postprandial 2-Hour Verification Checks",
                    "detail": trajectory["week2"]["monitoring"],
                    "provenance": "GUIDELINE_AI",
                    "category": "monitoring",
                },
            ],
        },
        {
            "week_number": 3,
            "focus_theme": w3_theme,
            "items": [
                {
                    "title": lifestyle_pool[2]["title"],
                    "detail": lifestyle_pool[2]["detail"],
                    "provenance": "GUIDELINE_AI",
                    "category": "lifestyle",
                },
                {
                    "title": "Twin Chronobiology & Diurnal Sensitivity Analysis",
                    "detail": f"Digital twin models show enhanced insulin receptor clearance during early afternoon. Consuming equivalent carbs at lunch vs. late dinner reduces iAUC exposure by 22%.",
                    "provenance": "TWIN_PREDICTED",
                    "category": "twin_meal_advice",
                    "metadata": {"optimal_window": "12:00 - 14:00"},
                },
                {
                    "title": "Continuous Glucose Variability Tracking",
                    "detail": trajectory["week3"]["monitoring"],
                    "provenance": "GUIDELINE_AI",
                    "category": "monitoring",
                },
            ],
        },
        {
            "week_number": 4,
            "focus_theme": w4_theme,
            "items": [
                {
                    "title": lifestyle_pool[3]["title"],
                    "detail": lifestyle_pool[3]["detail"],
                    "provenance": "GUIDELINE_AI",
                    "category": "lifestyle",
                },
                {
                    "title": "Twin 28-Day Stability Re-evaluation",
                    "detail": f"Twin models forecast an improvement in 30-day Time-in-Range (TIR) from current baseline up to 74% if these targeted habits are maintained.",
                    "provenance": "TWIN_PREDICTED",
                    "category": "twin_meal_advice",
                    "metadata": {"target_tir_projected": 74.0},
                },
                {
                    "title": "Clinician Review & Therapy Plan Stamping",
                    "detail": trajectory["week4"]["monitoring"],
                    "provenance": "GUIDELINE_AI",
                    "category": "clinician_review",
                },
            ],
        },
    ]
