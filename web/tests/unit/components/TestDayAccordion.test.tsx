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
});
