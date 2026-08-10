import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { OLQFactorRadarSVG } from '../../../src/components/practice/OLQFactorRadarSVG';

describe('OLQFactorRadarSVG Component', () => {
  it('renders radar container and inline SVG chart', () => {
    render(<OLQFactorRadarSVG />);

    expect(screen.getByTestId('olq-radar-svg')).toBeInTheDocument();
    expect(screen.getByTestId('svg-chart-element')).toBeInTheDocument();
    expect(screen.getByTestId('radar-view-toggle')).toHaveTextContent('Expand 15-OLQ Micro Breakdown');
  });

  it('toggles between 4 Core Factors view and 15 OLQ view', () => {
    render(<OLQFactorRadarSVG />);

    const toggleBtn = screen.getByTestId('radar-view-toggle');
    fireEvent.click(toggleBtn);

    expect(toggleBtn).toHaveTextContent('View 4 SSB Core Factors');

    fireEvent.click(toggleBtn);
    expect(toggleBtn).toHaveTextContent('Expand 15-OLQ Micro Breakdown');
  });

  // Regression target for docs/plans/CrossPlatform_SSOT §3.4: scores must be keyed by the
  // wire-format SCREAMING_SNAKE OLQ id (matches the AI evaluation function's output), not a
  // camelCase local rendering key that silently drops all real data.
  it('computes factor averages correctly when custom scores are provided', () => {
    render(
      <OLQFactorRadarSVG
        scores={{
          EFFECTIVE_INTELLIGENCE: 90,
          REASONING_ABILITY: 90,
          ORGANIZING_ABILITY: 90,
          POWER_OF_EXPRESSION: 90
        }}
      />
    );

    expect(screen.getByText('90%')).toBeInTheDocument();
  });

  it('applies Level 2 elevation styling to container and Level 3 micro badge styling to view toggle', () => {
    render(<OLQFactorRadarSVG />);

    const container = screen.getByTestId('olq-radar-svg');
    expect(container.className).toContain('dark:bg-slate-800/90');
    expect(container.className).toContain('dark:border-slate-700/80');

    const toggleBtn = screen.getByTestId('radar-view-toggle');
    expect(toggleBtn.className).toContain('dark:bg-slate-700/60');
  });
});
