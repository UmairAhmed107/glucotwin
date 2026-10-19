// Mapping of Safety Governor Rules (R1–R9, R4b) to plain-English explanations

export interface GovernorRuleExplanation {
  id: string;
  ruleCode: string;
  title: string;
  summary: string;
  clinicalRationale: string;
  severity: 'critical' | 'warning' | 'info';
}

export const GOVERNOR_RULES_MAP: Record<string, GovernorRuleExplanation> = {
  R1: {
    id: 'R1',
    ruleCode: 'R1_INVALID_SCHEMA',
    title: 'Clinical Schema Integrity',
    summary: 'Ensures generated plan complies strictly with the clinical schema structure.',
    clinicalRationale: 'Prevents malformed model outputs from displaying; automatically falls back to curated evidence templates.',
    severity: 'info',
  },
  R1_INVALID_SCHEMA: {
    id: 'R1_INVALID_SCHEMA',
    ruleCode: 'R1',
    title: 'Clinical Schema Fallback',
    summary: 'Invalid schema detected from language model; reverted to verified fallback plan.',
    clinicalRationale: 'Protects patients and clinicians from incomplete or malformed AI text.',
    severity: 'warning',
  },
  R2: {
    id: 'R2',
    ruleCode: 'R2_DISALLOWED_DRUG_CLASS',
    title: 'Permitted Anti-Hyperglycemic Classes Only',
    summary: 'Restricts drug classes strictly to the 7 guideline-established anti-hyperglycemic options.',
    clinicalRationale: 'Suppresses unapproved, investigational, or off-label pharmaceutical recommendations.',
    severity: 'warning',
  },
  R2_DISALLOWED_DRUG_CLASS: {
    id: 'R2_DISALLOWED_DRUG_CLASS',
    ruleCode: 'R2',
    title: 'Disallowed Drug Class Filtered',
    summary: 'Removed pharmaceutical options outside the 7 permitted guideline classes.',
    clinicalRationale: 'Prevents hallucination of unauthorized therapeutics.',
    severity: 'warning',
  },
  R3: {
    id: 'R3',
    ruleCode: 'R3_DOSING_LANGUAGE_DETECTED',
    title: 'No Prescription or Dosing Language',
    summary: 'Prohibits specific milligram dosages, unit titrations, or prescription orders.',
    clinicalRationale: 'GlucoTwin is a research prototype, not an e-prescribing system. All dosing decisions remain strictly clinician-determined.',
    severity: 'critical',
  },
  R3_DOSING_LANGUAGE_DETECTED: {
    id: 'R3_DOSING_LANGUAGE_DETECTED',
    ruleCode: 'R3',
    title: 'Prescriptive Language Stripped',
    summary: 'Dosing quantities or prescriptive syntax were detected and stripped.',
    clinicalRationale: 'Guarantees that AI-formulated text never simulates a medical prescription.',
    severity: 'critical',
  },
  R4: {
    id: 'R4',
    ruleCode: 'R4_HYPOGLYCEMIA_PROTECTION',
    title: 'Hypoglycemia History Protection (Active)',
    summary: 'Patient has reported hypoglycemia history: sulfonylurea and basal insulin options are suppressed; dietary carb reduction capped at 30%.',
    clinicalRationale: 'Directly mitigates iatrogenic severe hypoglycemia risks in patients with demonstrated vulnerability.',
    severity: 'critical',
  },
  R4_HYPOGLYCEMIA_PROTECTION: {
    id: 'R4_HYPOGLYCEMIA_PROTECTION',
    ruleCode: 'R4',
    title: 'Hypoglycemia Safety Guard Fired',
    summary: 'Sulfonylurea and insulin suppressed; carbohydrate restriction capped at 30%; red flag raised.',
    clinicalRationale: 'Severe hypoglycemia is a life-threatening acute event; high-risk secretagogues are withheld.',
    severity: 'critical',
  },
  R4b: {
    id: 'R4b',
    ruleCode: 'R4B_HYPOGLYCEMIA_UNKNOWN_CAUTION',
    title: 'Hypoglycemia History Unknown Caution',
    summary: 'Hypoglycemia history is unrecorded: secretagogues demoted to end of options; caution and clinician question added.',
    clinicalRationale: 'Prompts explicit clinician inquiry into patient hypoglycemia history before considering insulin secretagogues.',
    severity: 'warning',
  },
  R4B_HYPOGLYCEMIA_UNKNOWN_CAUTION: {
    id: 'R4B_HYPOGLYCEMIA_UNKNOWN_CAUTION',
    ruleCode: 'R4b',
    title: 'Hypoglycemia Status Clarification Required',
    summary: 'Added mandatory caution on secretagogues and clinician inquiry prompt regarding unrecorded hypoglycemia history.',
    clinicalRationale: 'Ensures missing data is treated with clinical caution rather than assumed safe.',
    severity: 'warning',
  },
  R5: {
    id: 'R5',
    ruleCode: 'R5_RENAL_REVIEW_REQUIRED',
    title: 'Renal Function Review Warning',
    summary: 'Renal risk flag is active: demotes metformin and SGLT2 inhibitors and appends mandatory renal lab review caution.',
    clinicalRationale: 'Ensures eGFR and creatinine levels are verified prior to initiating or maintaining renally-cleared agents.',
    severity: 'warning',
  },
  R5_RENAL_REVIEW_REQUIRED: {
    id: 'R5_RENAL_REVIEW_REQUIRED',
    ruleCode: 'R5',
    title: 'Renal Lab Review Mandated',
    summary: 'Metformin and SGLT2 inhibitors demoted with caution requiring renal function review.',
    clinicalRationale: 'Prevents lactic acidosis risks or inappropriate dosing in compromised renal function.',
    severity: 'warning',
  },
  R6: {
    id: 'R6',
    ruleCode: 'R6_MISSING_CRITICAL_DATA',
    title: 'Critical Baseline Data Check',
    summary: 'Requires patient age and HbA1c baseline. Missing parameters trigger verified fallback mode.',
    clinicalRationale: 'Targeting glycemic therapy requires accurate baseline glycemic exposure (HbA1c).',
    severity: 'critical',
  },
  R6_MISSING_CRITICAL_DATA: {
    id: 'R6_MISSING_CRITICAL_DATA',
    ruleCode: 'R6',
    title: 'Fallback Activated (Missing HbA1c/Age)',
    summary: 'Plan generated via conservative template due to missing critical demographic/biomarker baseline.',
    clinicalRationale: 'Prevents blind therapy formulation without core glycemic indicators.',
    severity: 'critical',
  },
  R7: {
    id: 'R7',
    ruleCode: 'R7_UNKNOWN_GUIDELINE_ID',
    title: 'Guideline Source Citation Validation',
    summary: 'Every cited guideline identifier must exist in the verified local guideline repository.',
    clinicalRationale: 'Grounds every clinical recommendation strictly in verifiable ADA/ICMR evidence snippets.',
    severity: 'warning',
  },
  R7_UNKNOWN_GUIDELINE_ID: {
    id: 'R7_UNKNOWN_GUIDELINE_ID',
    ruleCode: 'R7',
    title: 'Unverified Guideline Citation Filtered',
    summary: 'Filtered options citing unrecognized or ungrounded guideline identifiers.',
    clinicalRationale: 'Guarantees traceable provenance to local curated guideline files.',
    severity: 'warning',
  },
  R8: {
    id: 'R8',
    ruleCode: 'R8_STRIPPED_PREDICTIVE_TEXT',
    title: 'Predictive Hallucination Filter',
    summary: 'Strips patient-specific numeric glucose predictions from generative text.',
    clinicalRationale: 'Gemini never predicts glucose numbers. Twin predictions originate exclusively from the pickled ML models.',
    severity: 'critical',
  },
  R8_STRIPPED_PREDICTIVE_TEXT: {
    id: 'R8_STRIPPED_PREDICTIVE_TEXT',
    ruleCode: 'R8',
    title: 'Predictive Numeric Text Suppressed',
    summary: 'Language model attempted to predict patient glucose numbers; predictive sentence was removed.',
    clinicalRationale: 'Protects the strict boundary between generative guideline text and trained ML twin recommender models.',
    severity: 'critical',
  },
  R9: {
    id: 'R9',
    ruleCode: 'R9_SAFETY_STAMPED',
    title: 'Safety Governor Audit Stamp',
    summary: 'Final Governor seal confirming all checks passed and stamping GUIDELINE_AI provenance.',
    clinicalRationale: 'Ensures non-repudiable audit logging for research prototype traceability.',
    severity: 'info',
  },
  R9_SAFETY_STAMPED: {
    id: 'R9_SAFETY_STAMPED',
    ruleCode: 'R9',
    title: 'Governor Audit Seal Applied',
    summary: 'Plan successfully validated and stamped with GUIDELINE_AI provenance and safety_checked=true.',
    clinicalRationale: 'Certified through deterministic rule pipeline.',
    severity: 'info',
  },
};

export function getRuleExplanation(ruleId: string): GovernorRuleExplanation {
  const normalized = ruleId.trim().toUpperCase();
  if (GOVERNOR_RULES_MAP[normalized]) {
    return GOVERNOR_RULES_MAP[normalized];
  }
  // Try matching prefix (e.g. R4 from R4_...)
  const prefix = normalized.split('_')[0];
  if (GOVERNOR_RULES_MAP[prefix]) {
    return {
      ...GOVERNOR_RULES_MAP[prefix],
      id: ruleId,
      title: `${GOVERNOR_RULES_MAP[prefix].title} (${ruleId})`,
    };
  }
  return {
    id: ruleId,
    ruleCode: ruleId,
    title: `Safety Rule ${ruleId}`,
    summary: `Deterministic Governor safety enforcement: ${ruleId}`,
    clinicalRationale: 'Rule evaluated during safety pipeline execution.',
    severity: 'info',
  };
}
