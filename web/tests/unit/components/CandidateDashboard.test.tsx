import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { CandidateDashboard } from '../../../src/components/dashboard/CandidateDashboard';
import { strings } from '../../../src/constants/strings';

describe('CandidateDashboard Component', () => {
  it('renders candidate command center layout with cards and meta indicators', () => {
    render(<CandidateDashboard />);

    expect(screen.getByTestId('candidate-dashboard')).toBeInTheDocument();
    expect(screen.getByTestId('meta-board')).toHaveTextContent(strings.diagnostic.boardArmy);
    expect(screen.getByTestId('meta-entry')).toHaveTextContent(strings.diagnostic.entryCds);
    expect(screen.getByTestId('stage1-card')).toBeInTheDocument();
    expect(screen.getByTestId('stage2-card')).toBeInTheDocument();
  });

  it('opens diagnostic modal when edit profile button is clicked', () => {
    render(<CandidateDashboard />);

    const editBtn = screen.getByTestId('edit-diagnostic-btn');
    fireEvent.click(editBtn);

    expect(screen.getByTestId('diagnostic-modal')).toBeInTheDocument();
  });

  it('triggers test launch callbacks when simulator buttons are clicked', () => {
    const handleLaunchTest = vi.fn();
    render(<CandidateDashboard onLaunchTest={handleLaunchTest} />);

    const oirBtn = screen.getByTestId('launch-oir-btn');
    fireEvent.click(oirBtn);
    expect(handleLaunchTest).toHaveBeenCalledWith('oir');

    const ppdtBtn = screen.getByTestId('launch-ppdt-btn');
    fireEvent.click(ppdtBtn);
    expect(handleLaunchTest).toHaveBeenCalledWith('ppdt');

    const psychBtn = screen.getByTestId('launch-psych-btn');
    fireEvent.click(psychBtn);
    expect(handleLaunchTest).toHaveBeenCalledWith('psychology');
  });

  it('triggers onViewReports when view full report button is clicked', () => {
    const handleViewReports = vi.fn();
    render(<CandidateDashboard onViewReports={handleViewReports} />);

    const reportsBtn = screen.getByTestId('view-reports-btn');
    fireEvent.click(reportsBtn);

    expect(handleViewReports).toHaveBeenCalledTimes(1);
  });

  it('applies Level 2 elevation styling to Stage 1 and Stage 2 cards', () => {
    render(<CandidateDashboard />);

    const stage1Card = screen.getByTestId('stage1-card');
    expect(stage1Card.className).toContain('dark:bg-slate-800/90');
    expect(stage1Card.className).toContain('dark:border-slate-700/80');

    const stage2Card = screen.getByTestId('stage2-card');
    expect(stage2Card.className).toContain('dark:bg-slate-800/90');
    expect(stage2Card.className).toContain('dark:border-slate-700/80');
  });
});
