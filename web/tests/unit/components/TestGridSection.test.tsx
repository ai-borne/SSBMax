import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TestGridSection } from '../../../src/components/landing/TestGridSection';
import { strings } from '../../../src/constants/strings';

describe('TestGridSection Component', () => {
  it('renders 5-Day SSB coverage grid with test cards and friendly bracketed titles', () => {
    render(<TestGridSection />);

    expect(screen.getByTestId('test-grid-section')).toBeInTheDocument();
    expect(screen.getByText(strings.landing.featureTitle)).toBeInTheDocument();
    expect(screen.getByTestId('grid-card-oir')).toBeInTheDocument();
    expect(screen.getByTestId('grid-card-tat')).toBeInTheDocument();
  });

  it('triggers onStartTestClick callback when start test button is clicked', () => {
    const handleStartTest = vi.fn();
    render(<TestGridSection onStartTestClick={handleStartTest} />);

    const startOirBtn = screen.getByTestId('start-btn-oir');
    fireEvent.click(startOirBtn);

    expect(handleStartTest).toHaveBeenCalledWith('oir');
  });
});
