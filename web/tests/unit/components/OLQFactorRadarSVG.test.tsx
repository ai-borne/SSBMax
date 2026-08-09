import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { OLQFactorRadarSVG } from '../../../src/components/practice/OLQFactorRadarSVG';

describe('OLQFactorRadarSVG Component', () => {
  it('renders radar container and inline SVG chart', () => {
    render(<OLQFactorRadarSVG />);

    expect(screen.getByTestId('olq-radar-svg')).toBeInTheDocument();
    expect(screen.getByTestId('svg-chart-element')).toBeInTheDocument();
    expect(screen.getByTestId('radar-view-toggle')).toHaveTextContent('Expand 15 OLQs');
  });

  it('toggles between 4 Core Factors view and 15 OLQ view', () => {
    render(<OLQFactorRadarSVG />);

    const toggleBtn = screen.getByTestId('radar-view-toggle');
    fireEvent.click(toggleBtn);

    expect(toggleBtn).toHaveTextContent('4 Core Factors');

    fireEvent.click(toggleBtn);
    expect(toggleBtn).toHaveTextContent('Expand 15 OLQs');
  });

  it('computes factor averages correctly when custom scores are provided', () => {
    render(
      <OLQFactorRadarSVG
        scores={{
          effectiveIntelligence: 90,
          reasoningAbility: 90,
          organizingAbility: 90,
          powerOfExpression: 90
        }}
      />
    );

    expect(screen.getByText('90%')).toBeInTheDocument();
  });
});
