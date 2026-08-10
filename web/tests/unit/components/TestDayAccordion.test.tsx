import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TestDayAccordion } from '../../../src/components/practice/TestDayAccordion';
import { SSB_5_DAY_TIMELINE, getDayOverview } from '../../../src/constants/ssbSelectionProcess';

describe('TestDayAccordion Component', () => {
  const day34Overview = getDayOverview('3-4') || SSB_5_DAY_TIMELINE[2];

  it('should render accordion header with ARIA expanded and controls attributes', () => {
    render(
      <TestDayAccordion
        dayOverview={day34Overview}
        onStartTest={vi.fn()}
      />
    );

    const toggleBtn = screen.getByTestId('accordion-toggle-3-4');
    expect(toggleBtn).toBeInTheDocument();
    expect(toggleBtn).toHaveAttribute('aria-expanded', 'true');
    expect(toggleBtn).toHaveAttribute('aria-controls', 'day-content-3-4');
    expect(screen.getByTestId('accordion-content-3-4')).toBeInTheDocument();
  });

  it('should toggle accordion expanded state and collapse content when header is clicked', () => {
    render(
      <TestDayAccordion
        dayOverview={day34Overview}
        defaultExpanded={true}
        onStartTest={vi.fn()}
      />
    );

    const toggleBtn = screen.getByTestId('accordion-toggle-3-4');
    expect(screen.getByTestId('accordion-content-3-4')).toBeInTheDocument();

    fireEvent.click(toggleBtn);
    expect(toggleBtn).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByTestId('accordion-content-3-4')).not.toBeInTheDocument();
  });

  it('should render all 8 GTO test cards for Day 3-4 when expanded', () => {
    render(
      <TestDayAccordion
        dayOverview={day34Overview}
        userTier="officer"
        onStartTest={vi.fn()}
      />
    );

    const gtoIds = ['gd', 'gpe', 'pgt', 'hgt', 'iot', 'command_task', 'snake_race', 'fgt'];
    gtoIds.forEach((id) => {
      expect(screen.getByTestId(`test-simulator-card-${id}`)).toBeInTheDocument();
    });
  });

  it('should trigger onStartTest when an unlocked test launcher button is clicked', () => {
    const onStartTest = vi.fn();
    render(
      <TestDayAccordion
        dayOverview={day34Overview}
        userTier="officer"
        onStartTest={onStartTest}
      />
    );

    const gdLaunchBtn = screen.getByTestId('launch-button-gd');
    fireEvent.click(gdLaunchBtn);

    expect(onStartTest).toHaveBeenCalledWith('gd');
  });

  it('should trigger onUnlockTier when a locked test button is clicked by a cadet tier user', () => {
    const onUnlockTier = vi.fn();
    render(
      <TestDayAccordion
        dayOverview={day34Overview}
        userTier="cadet"
        onStartTest={vi.fn()}
        onUnlockTier={onUnlockTier}
      />
    );

    const pgtLaunchBtn = screen.getByTestId('launch-button-pgt');
    fireEvent.click(pgtLaunchBtn);

    expect(onUnlockTier).toHaveBeenCalledWith('officer');
  });

  it('should enforce touch target min-height on accordion header button', () => {
    render(
      <TestDayAccordion
        dayOverview={day34Overview}
        onStartTest={vi.fn()}
      />
    );

    const toggleBtn = screen.getByTestId('accordion-toggle-3-4');
    expect(toggleBtn.className).toContain('min-h-[56px]');
  });

  it('should apply Level 1 elevation to accordion container and Level 2 elevation to simulator cards', () => {
    render(
      <TestDayAccordion
        dayOverview={day34Overview}
        userTier="officer"
        onStartTest={vi.fn()}
      />
    );

    const accordion = screen.getByTestId('test-day-accordion-3-4');
    expect(accordion.className).toContain('dark:bg-slate-900');
    expect(accordion.className).toContain('dark:border-slate-800');

    const card = screen.getByTestId('test-simulator-card-gd');
    expect(card.className).toContain('dark:bg-slate-800/90');
    expect(card.className).toContain('dark:border-slate-700/80');
    expect(card.className).toContain('shadow-[var(--card-shadow)]');
  });

  // Phase 3 — Day colour-coded accordion border tests
  it('should apply indigo day-accent border to Day 1 accordion', () => {
    const day1 = getDayOverview('1')!;
    const { getByTestId } = render(
      <TestDayAccordion dayOverview={day1} onStartTest={vi.fn()} />
    );
    const accordion = getByTestId('test-day-accordion-1');
    expect(accordion.className).toContain('border-l-4');
    expect(accordion.className).toContain('border-l-day1');
  });

  it('should apply violet day-accent border to Day 2 accordion', () => {
    const day2 = getDayOverview('2')!;
    const { getByTestId } = render(
      <TestDayAccordion dayOverview={day2} onStartTest={vi.fn()} />
    );
    const accordion = getByTestId('test-day-accordion-2');
    expect(accordion.className).toContain('border-l-day2');
  });

  it('should apply teal day-accent border to Day 3-4 accordion', () => {
    const day34 = getDayOverview('3-4')!;
    const { getByTestId } = render(
      <TestDayAccordion dayOverview={day34} onStartTest={vi.fn()} />
    );
    const accordion = getByTestId('test-day-accordion-3-4');
    expect(accordion.className).toContain('border-l-day34');
  });

  it('should apply gold day-accent border to Day 5 accordion', () => {
    const day5 = getDayOverview('5')!;
    const { getByTestId } = render(
      <TestDayAccordion dayOverview={day5} onStartTest={vi.fn()} />
    );
    const accordion = getByTestId('test-day-accordion-5');
    expect(accordion.className).toContain('border-l-day5');
  });

  // Phase 4 — Badge Colour Coding & Most Popular Badge Tests
  it('should apply emerald badge style to CADET FREE tier test card', () => {
    const day1 = getDayOverview('1')!;
    render(<TestDayAccordion dayOverview={day1} userTier="cadet" onStartTest={vi.fn()} />);
    const oirCard = screen.getByTestId('test-simulator-card-oir');
    const badge = oirCard.querySelector('[data-testid="tier-badge"]');
    expect(badge?.className).toContain('text-emeraldToken');
  });

  it('should apply gold badge style to OFFICER tier test card', () => {
    const day1 = getDayOverview('1')!;
    render(<TestDayAccordion dayOverview={day1} userTier="officer" onStartTest={vi.fn()} />);
    const ppdtCard = screen.getByTestId('test-simulator-card-ppdt');
    const badge = ppdtCard.querySelector('[data-testid="tier-badge"]');
    expect(badge?.className).toContain('text-gold');
  });

  it('should render clean tier badge on PPDT card without redundant badges', () => {
    const day1 = getDayOverview('1')!;
    render(<TestDayAccordion dayOverview={day1} userTier="officer" onStartTest={vi.fn()} />);
    expect(screen.getByTestId('test-simulator-card-ppdt')).toHaveTextContent('OFFICER (PRO)');
  });
});
