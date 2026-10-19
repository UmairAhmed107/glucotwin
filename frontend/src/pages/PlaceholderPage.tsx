import React from 'react';
import { SectionCard } from '../components/Cards';
import { ProvenanceBadge, ProvenanceKind } from '../components/ProvenanceBadge';
import { Sparkles, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface PlaceholderPageProps {
  title: string;
  phase: string;
  description: string;
  provenanceKind?: ProvenanceKind;
  features?: string[];
}

export const PlaceholderPage: React.FC<PlaceholderPageProps> = ({
  title,
  phase,
  description,
  provenanceKind = 'TWIN_PREDICTED',
  features = [],
}) => {
  const navigate = useNavigate();

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <span className="text-xs font-mono font-semibold uppercase text-teal-400 bg-teal-500/10 px-2 py-0.5 rounded border border-teal-500/20">
            {phase}
          </span>
          <h2 className="text-xl font-bold tracking-tight text-slate-100 mt-2">
            {title}
          </h2>
        </div>
        <ProvenanceBadge kind={provenanceKind} />
      </div>

      <SectionCard
        title="Module Architecture & Capabilities"
        subtitle={description}
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-300 leading-relaxed">
            This module backend API endpoints are fully operational. The frontend interactive workspace will be assembled in {phase} per the roadmap.
          </p>

          {features.length > 0 && (
            <div className="space-y-2 border-t border-slate-800 pt-3">
              <span className="text-xs font-semibold text-slate-200">
                Key Engine Capabilities:
              </span>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-400">
                {features.map((feat, idx) => (
                  <li key={idx} className="flex items-start gap-2 bg-[#0B1220] p-2.5 rounded-lg border border-slate-800">
                    <Sparkles className="w-3.5 h-3.5 text-teal-400 shrink-0 mt-0.5" />
                    <span>{feat}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="pt-3 border-t border-slate-800 flex justify-end">
            <button
              onClick={() => navigate('/')}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg flex items-center gap-1.5 transition-colors"
            >
              <span>Return to Twin Overview</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </SectionCard>
    </div>
  );
};
