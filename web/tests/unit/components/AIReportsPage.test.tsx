import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { AIReportsPage } from '../../../src/components/reports/AIReportsPage';
import { strings } from '../../../src/constants/strings';

describe('AIReportsPage Component', () => {
  it('renders sample demo report by default when no user reports exist', () => {
    render(<AIReportsPage />);

    expect(screen.getByRole('heading', { level: 1, name: strings.reportsPage.title })).toBeInTheDocument();
    expect(screen.getByText(strings.reportsPage.sampleBanner)).toBeInTheDocument();
    expect(screen.getByText(strings.reportsPage.sampleBadge)).toBeInTheDocument();
    expect(screen.getByText(strings.radar.title)).toBeInTheDocument();
    expect(screen.getByText(strings.dossier.title)).toBeInTheDocument();
    expect(screen.getByText(strings.olq.scoreCardTitle)).toBeInTheDocument();
  });

  it('renders guest auth banner and handles sign in action', () => {
    const handleSignIn = vi.fn();
    render(<AIReportsPage isGuest={true} onSignIn={handleSignIn} />);

    expect(screen.getByText(strings.reportsPage.guestBanner)).toBeInTheDocument();
    const signInBtn = screen.getByText(strings.reportsPage.signInAction);
    fireEvent.click(signInBtn);
    expect(handleSignIn).toHaveBeenCalledTimes(1);
  });

  it('triggers onStartTest when practice test action buttons are clicked', () => {
    const handleStartTest = vi.fn();
    render(<AIReportsPage onStartTest={handleStartTest} />);

    const startBtns = screen.getAllByText(strings.reportsPage.startTest);
    expect(startBtns.length).toBeGreaterThan(0);
    fireEvent.click(startBtns[0]);
    expect(handleStartTest).toHaveBeenCalledTimes(1);
  });

  it('renders user reports when provided and toggles sample mode', () => {
    const mockUserReports = {
      olqScores: [
        { olq: 'EFFECTIVE_INTELLIGENCE', score: 9.0, reasoning: 'Outstanding logical reasoning.' }
      ],
      dossier: {
        candidateId: 'USER-123',
        assessedDate: '2026-08-08',
        recommendationStatus: 'RECOMMENDED' as const,
        executiveSummary: 'Custom user dossier overview.',
        keyStrengths: ['High analytical skills'],
        areasOfConcern: [],
        suggestedProbes: []
      }
    };

    render(<AIReportsPage userReports={mockUserReports} />);

    expect(screen.getByText('Custom user dossier overview.')).toBeInTheDocument();
    
    // Toggle sample report mode
    const toggleBtn = screen.getByText(strings.reportsPage.toggleSample);
    fireEvent.click(toggleBtn);
    expect(screen.getByText(strings.reportsPage.toggleUser)).toBeInTheDocument();
  });
});
