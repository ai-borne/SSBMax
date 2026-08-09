import React from 'react';
import { strings } from '../../constants/strings';

export interface PsychologistDossierData {
  candidateId?: string;
  assessedDate?: string;
  recommendationStatus: 'RECOMMENDED' | 'BORDERLINE' | 'NOT_RECOMMENDED';
  executiveSummary: string;
  keyStrengths: string[];
  areasOfConcern: string[];
  suggestedProbes: string[];
}

export interface PsychologistDossierProps {
  dossier?: PsychologistDossierData;
}

export const PsychologistDossier: React.FC<PsychologistDossierProps> = ({ dossier }) => {
  if (!dossier) {
    return (
      <div className="p-6 text-center rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] text-[var(--color-text-muted)]">
        {strings.dossier.noData}
      </div>
    );
  }

  const getStatusBadge = (status: PsychologistDossierData['recommendationStatus']) => {
    switch (status) {
      case 'RECOMMENDED':
        return (
          <span className="px-3 py-1 rounded-md text-xs font-extrabold uppercase bg-emerald-500/20 text-[var(--color-success)] border border-emerald-500/30">
            {strings.dossier.statusRecommended}
          </span>
        );
      case 'BORDERLINE':
        return (
          <span className="px-3 py-1 rounded-md text-xs font-extrabold uppercase bg-amber-500/20 text-[var(--color-warning)] border border-amber-500/30">
            {strings.dossier.statusBorderline}
          </span>
        );
      case 'NOT_RECOMMENDED':
      default:
        return (
          <span className="px-3 py-1 rounded-md text-xs font-extrabold uppercase bg-rose-500/20 text-[var(--color-danger)] border border-rose-500/30">
            {strings.dossier.statusNotRecommended}
          </span>
        );
    }
  };

  return (
    <div className="w-full space-y-6 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-6 shadow-sm relative overflow-hidden">
      {/* Classification Header Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-4 border-b border-[var(--color-border)]">
        <div>
          <span className="text-[10px] tracking-widest font-mono font-bold uppercase text-[var(--color-warning)] block mb-1">
            {strings.dossier.classification}
          </span>
          <h3 className="text-xl font-bold text-[var(--color-text-primary)]">
            {strings.dossier.title}
          </h3>
        </div>
        <div>{getStatusBadge(dossier.recommendationStatus)}</div>
      </div>

      {/* Metadata Row */}
      <div className="flex flex-wrap gap-6 text-xs text-[var(--color-text-secondary)] bg-[var(--color-bg-elevated)] p-3 rounded-lg border border-[var(--color-border-subtle)]">
        {dossier.candidateId && (
          <div>
            <span className="font-semibold text-[var(--color-text-muted)]">
              {strings.dossier.candidateIdLabel}:{' '}
            </span>
            <span className="font-mono text-[var(--color-text-primary)]">{dossier.candidateId}</span>
          </div>
        )}
        {dossier.assessedDate && (
          <div>
            <span className="font-semibold text-[var(--color-text-muted)]">
              {strings.dossier.assessedDateLabel}:{' '}
            </span>
            <span className="font-mono text-[var(--color-text-primary)]">{dossier.assessedDate}</span>
          </div>
        )}
      </div>

      {/* Executive Overview */}
      <section className="space-y-2">
        <h4 className="text-sm font-bold uppercase tracking-wider text-[var(--color-accent)]">
          {strings.dossier.summaryTitle}
        </h4>
        <p className="text-sm leading-relaxed text-[var(--color-text-secondary)] bg-[var(--color-bg-elevated)] p-4 rounded-lg border border-[var(--color-border-subtle)]">
          {dossier.executiveSummary}
        </p>
      </section>

      {/* Grid for Strengths & Concerns */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Key Strengths */}
        <section className="p-4 rounded-lg bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] space-y-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--color-success)] flex items-center gap-1">
            <span>✓</span> {strings.dossier.strengthsTitle}
          </h4>
          <ul className="space-y-1.5 list-disc pl-4 text-xs text-[var(--color-text-secondary)]">
            {dossier.keyStrengths.map((strength, i) => (
              <li key={i}>{strength}</li>
            ))}
          </ul>
        </section>

        {/* Areas of Concern */}
        <section className="p-4 rounded-lg bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] space-y-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--color-danger)] flex items-center gap-1">
            <span>⚠</span> {strings.dossier.concernsTitle}
          </h4>
          <ul className="space-y-1.5 list-disc pl-4 text-xs text-[var(--color-text-secondary)]">
            {dossier.areasOfConcern.map((concern, i) => (
              <li key={i}>{concern}</li>
            ))}
          </ul>
        </section>
      </div>

      {/* Suggested Probes */}
      {dossier.suggestedProbes.length > 0 && (
        <section className="p-4 rounded-lg bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] space-y-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--color-warning)] flex items-center gap-1">
            <span>🔍</span> {strings.dossier.probesTitle}
          </h4>
          <ul className="space-y-1.5 list-disc pl-4 text-xs text-[var(--color-text-secondary)]">
            {dossier.suggestedProbes.map((probe, i) => (
              <li key={i}>{probe}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
};
