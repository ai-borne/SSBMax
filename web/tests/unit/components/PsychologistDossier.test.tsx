import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { PsychologistDossier, PsychologistDossierData } from '../../../src/components/evaluation/PsychologistDossier';
import { strings } from '../../../src/constants/strings';

describe('PsychologistDossier Component', () => {
  const sampleDossier: PsychologistDossierData = {
    candidateId: 'SSB-2026-9942',
    assessedDate: '2026-08-08',
    recommendationStatus: 'RECOMMENDED',
    executiveSummary: 'Candidate exhibits high emotional stability, leadership initiative, and rapid decision-making capacity under psychological stress.',
    keyStrengths: [
      'Exceptional clarity of thought during TAT story resolution',
      'High speed of decision in SRT situations'
    ],
    areasOfConcern: [
      'Slight tendency to over-explain simple WAT words'
    ],
    suggestedProbes: [
      'Inquire about team conflict resolution during college project'
    ]
  };

  it('renders fallback when no dossier is provided', () => {
    render(<PsychologistDossier dossier={undefined} />);
    expect(screen.getByText(strings.dossier.noData)).toBeInTheDocument();
  });

  it('renders confidential header, status badge, and metadata correctly', () => {
    render(<PsychologistDossier dossier={sampleDossier} />);

    expect(screen.getByText(strings.dossier.classification)).toBeInTheDocument();
    expect(screen.getByText(strings.dossier.title)).toBeInTheDocument();
    expect(screen.getByText(strings.dossier.statusRecommended)).toBeInTheDocument();
    expect(screen.getByText('SSB-2026-9942')).toBeInTheDocument();
    expect(screen.getByText('2026-08-08')).toBeInTheDocument();
  });

  it('renders summary, strengths, concerns, and probes lists', () => {
    render(<PsychologistDossier dossier={sampleDossier} />);

    expect(screen.getByText(sampleDossier.executiveSummary)).toBeInTheDocument();
    expect(screen.getByText('Exceptional clarity of thought during TAT story resolution')).toBeInTheDocument();
    expect(screen.getByText('Slight tendency to over-explain simple WAT words')).toBeInTheDocument();
    expect(screen.getByText('Inquire about team conflict resolution during college project')).toBeInTheDocument();
  });

  it('renders borderline and not-recommended status badges correctly', () => {
    const { rerender } = render(
      <PsychologistDossier dossier={{ ...sampleDossier, recommendationStatus: 'BORDERLINE' }} />
    );
    expect(screen.getByText(strings.dossier.statusBorderline)).toBeInTheDocument();

    rerender(
      <PsychologistDossier dossier={{ ...sampleDossier, recommendationStatus: 'NOT_RECOMMENDED' }} />
    );
    expect(screen.getByText(strings.dossier.statusNotRecommended)).toBeInTheDocument();
  });
});
