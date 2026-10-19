import { describe, it, expect } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { ProvenanceBadge } from '../components/ProvenanceBadge';
import { ConfidenceRing } from '../components/ConfidenceRing';

describe('ProvenanceBadge Component', () => {
  it('renders TWIN-PREDICTED badge with correct label and icon', () => {
    render(<ProvenanceBadge kind="TWIN_PREDICTED" />);
    expect(screen.getByText('TWIN-PREDICTED')).toBeInTheDocument();
  });

  it('renders GUIDELINE-BASED (AI) badge', () => {
    render(<ProvenanceBadge kind="GUIDELINE_AI" />);
    expect(screen.getByText('GUIDELINE-BASED (AI)')).toBeInTheDocument();
  });

  it('renders PROJECTION badge', () => {
    render(<ProvenanceBadge kind="PROJECTION" />);
    expect(screen.getByText('PROJECTION')).toBeInTheDocument();
  });

  it('renders SAFETY-CHECKED badge', () => {
    render(<ProvenanceBadge kind="SAFETY_CHECKED" />);
    expect(screen.getByText('SAFETY-CHECKED')).toBeInTheDocument();
  });

  it('renders DEMO FIXTURE badge', () => {
    render(<ProvenanceBadge kind="DEMO_FIXTURE" />);
    expect(screen.getByText('DEMO FIXTURE')).toBeInTheDocument();
  });

  it('displays tooltip on hover explaining badge meaning', () => {
    render(<ProvenanceBadge kind="TWIN_PREDICTED" />);
    const badge = screen.getByRole('note');
    fireEvent.mouseEnter(badge);

    const tooltip = screen.getByRole('tooltip');
    expect(tooltip).toBeInTheDocument();
    expect(tooltip).toHaveTextContent(/15-model metabolic bootstrap ensemble/i);
  });
});

describe('ConfidenceRing Component', () => {
  it('renders circular progress ring with clamped percentage', () => {
    render(<ConfidenceRing score={0.65} label="Twin Calibration" />);
    const progressbar = screen.getByRole('progressbar');
    expect(progressbar).toBeInTheDocument();
    expect(progressbar).toHaveAttribute('aria-valuenow', '65');
    expect(screen.getByText('65%')).toBeInTheDocument();
    expect(screen.getByText('Twin Calibration')).toBeInTheDocument();
  });

  it('handles score of 0 gracefully', () => {
    render(<ConfidenceRing score={0.0} />);
    expect(screen.getByText('0%')).toBeInTheDocument();
  });

  it('displays formula and components in tooltip on hover', () => {
    render(
      <ConfidenceRing
        score={0.45}
        components={{
          mem_n: 3,
          band_width: 28.5,
          n_component: 0.27,
          band_component: 0.18,
        }}
      />
    );
    const progressbar = screen.getByRole('progressbar');
    fireEvent.mouseEnter(progressbar);

    const tooltip = screen.getByRole('tooltip');
    expect(tooltip).toBeInTheDocument();
    expect(tooltip).toHaveTextContent(/0\.6\*\(/i);
    expect(tooltip).toHaveTextContent(/n = 3/i);
    expect(tooltip).toHaveTextContent(/28\.5 mg\/dL/i);
  });
});

import { CalculationDrawer } from '../components/CalculationDrawer';
import { TwinUpdatedPulse } from '../components/TwinUpdatedPulse';

describe('CalculationDrawer Component', () => {
  it('renders model transparency sections when open', () => {
    render(
      <CalculationDrawer
        isOpen={true}
        onClose={() => {}}
        ensembleSize={15}
        inputs={{ carbs_g: 50, protein_g: 22 }}
        memory={{ mem_n: 3, baseline_used: false, mem_mean_rise: 42.5 }}
        boundsChecked={true}
      />
    );

    expect(screen.getByText('How was this calculated?')).toBeInTheDocument();
    expect(screen.getByText('15 bootstrap models')).toBeInTheDocument();
    expect(screen.getByText('Passed')).toBeInTheDocument();
    expect(screen.getByText('Personalised Memory')).toBeInTheDocument();
    expect(screen.getByText('42.5 mg/dL')).toBeInTheDocument();
  });

  it('renders population baseline state when baseline_used is true', () => {
    render(
      <CalculationDrawer
        isOpen={true}
        onClose={() => {}}
        ensembleSize={15}
        memory={{ mem_n: 0, baseline_used: true }}
      />
    );

    expect(screen.getByText('Population Baseline')).toBeInTheDocument();
  });

  it('does not render content when isOpen is false', () => {
    render(
      <CalculationDrawer
        isOpen={false}
        onClose={() => {}}
        ensembleSize={15}
      />
    );

    expect(screen.queryByText('How was this calculated?')).not.toBeInTheDocument();
  });
});

describe('TwinUpdatedPulse Component', () => {
  it('renders update animation message', () => {
    render(<TwinUpdatedPulse trigger={true} message="Twin updated: memory recalibrated" />);
    expect(screen.getByText('Twin updated: memory recalibrated')).toBeInTheDocument();
  });
});

import { GuidelineDrawer } from '../components/GuidelineDrawer';
import { getRuleExplanation, GOVERNOR_RULES_MAP } from '../constants/governorRules';

describe('GuidelineDrawer Component', () => {
  it('renders guideline snippet content when open', () => {
    const mockSnippet = {
      id: 'G-MET-01',
      topic: 'Metformin First-Line Clinical Evidence',
      text: 'Metformin is widely recommended as initial pharmacological therapy for type 2 diabetes due to demonstrated glycemic efficacy and cardiovascular safety.',
    };

    render(
      <GuidelineDrawer
        isOpen={true}
        onClose={() => {}}
        snippet={mockSnippet}
      />
    );

    expect(screen.getByText('G-MET-01')).toBeInTheDocument();
    expect(screen.getByText('Metformin First-Line Clinical Evidence')).toBeInTheDocument();
    expect(
      screen.getByText(/Metformin is widely recommended as initial pharmacological therapy/i)
    ).toBeInTheDocument();
  });

  it('does not render when isOpen is false', () => {
    const mockSnippet = {
      id: 'G-MET-01',
      topic: 'Metformin Topic',
      text: 'Some guideline text',
    };

    render(
      <GuidelineDrawer
        isOpen={false}
        onClose={() => {}}
        snippet={mockSnippet}
      />
    );

    expect(screen.queryByText('G-MET-01')).not.toBeInTheDocument();
  });
});

describe('Safety Governor Rule Mapping (governorRules.ts)', () => {
  it('maps R1 to R9 and R4b correctly to human-readable explanations', () => {
    const r4 = getRuleExplanation('R4_HYPOGLYCEMIA_PROTECTION');
    expect(r4.severity).toBe('critical');
    expect(r4.title).toContain('Hypoglycemia');
    expect(r4.summary).toContain('Sulfonylurea and insulin suppressed');

    const r4b = getRuleExplanation('R4B_HYPOGLYCEMIA_UNKNOWN_CAUTION');
    expect(r4b.severity).toBe('warning');
    expect(r4b.title).toContain('Hypoglycemia Status Clarification');

    const r3 = getRuleExplanation('R3');
    expect(r3.severity).toBe('critical');
    expect(r3.summary).toContain('Prohibits specific milligram dosages');

    const r5 = getRuleExplanation('R5_RENAL_REVIEW_REQUIRED');
    expect(r5.title).toContain('Renal Lab Review Mandated');

    const r8 = getRuleExplanation('R8_STRIPPED_PREDICTIVE_TEXT');
    expect(r8.title).toContain('Predictive Numeric Text Suppressed');

    const r9 = getRuleExplanation('R9_SAFETY_STAMPED');
    expect(r9.title).toContain('Governor Audit Seal Applied');
  });

  it('guarantees no dosing language exists in explanations', () => {
    // Check that no dosing patterns exist across governor rules explanations
    const dosingRegex = /\b\d+\s*(mg|mcg|units|iu|ml)\b/i;
    Object.values(GOVERNOR_RULES_MAP).forEach((exp) => {
      expect(dosingRegex.test(exp.summary)).toBe(false);
      expect(dosingRegex.test(exp.clinicalRationale)).toBe(false);
    });
  });
});
