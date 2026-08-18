import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TestGridSection } from '../../../src/components/landing/TestGridSection';
import { strings } from '../../../src/constants/strings';
import { SSB_5_DAY_TIMELINE } from '../../../src/constants/ssbSelectionProcess';

describe('TestGridSection Component', () => {
  it('renders the 4-stage teaser overview, not the functional test launcher', () => {
    render(<TestGridSection onExploreTestsClick={vi.fn()} />);

    expect(screen.getByTestId('test-grid-section')).toBeInTheDocument();
    expect(screen.getByText(strings.landing.featureTitle)).toBeInTheDocument();
    expect(screen.getByTestId('grid-stage-day-1')).toBeInTheDocument();
    expect(screen.getByTestId('grid-stage-day-2')).toBeInTheDocument();
    expect(screen.getByTestId('grid-stage-day-3-4')).toBeInTheDocument();
    expect(screen.getByTestId('grid-stage-day-5')).toBeInTheDocument();
    // No per-test launch buttons -- those bypass eligibility gating and live only on
    // PracticeTestsPage (SSB Tests tab).
    expect(screen.queryByTestId('start-btn-oir')).not.toBeInTheDocument();
  });

  it('funnels into the SSB Tests tab via a single CTA instead of launching a test directly', () => {
    const handleExplore = vi.fn();
    render(<TestGridSection onExploreTestsClick={handleExplore} />);

    fireEvent.click(screen.getByTestId('grid-cta-button'));

    expect(handleExplore).toHaveBeenCalledTimes(1);
  });

  it('applies Level 2 card elevation styling to child stage cards', () => {
    render(<TestGridSection onExploreTestsClick={vi.fn()} />);

    const card = screen.getByTestId('grid-stage-day-1');
    expect(card.className).toContain('dark:bg-slate-800/90');
    expect(card.className).toContain('dark:border-slate-700/80');
  });

  it('sources every card from SSB_5_DAY_TIMELINE instead of a second hand-typed test list', () => {
    // Guards against re-introducing a duplicate catalog that can drift from the real one
    // PracticeTestsPage's day accordions read (root CLAUDE.md SSOT rule).
    render(<TestGridSection onExploreTestsClick={vi.fn()} />);

    for (const day of SSB_5_DAY_TIMELINE) {
      expect(screen.getByText(day.title)).toBeInTheDocument();
      expect(screen.getByText(day.subtitle)).toBeInTheDocument();
    }
  });
});
