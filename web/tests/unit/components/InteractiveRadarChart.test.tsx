import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { InteractiveRadarChart, OLQRadarItem } from '../../../src/components/evaluation/InteractiveRadarChart';
import { strings } from '../../../src/constants/strings';

describe('InteractiveRadarChart Component', () => {
  const sampleScores: OLQRadarItem[] = [
    { olq: 'Effective Intelligence', score: 8.5, reasoning: 'Strong problem solving' },
    { olq: 'Reasoning Ability', score: 7.8, reasoning: 'Logical clarity' },
    { olq: 'Organizing Ability', score: 6.5 },
    { olq: 'Social Adjustment', score: 9.0 }
  ];

  it('renders fallback message when no scores are provided', () => {
    render(<InteractiveRadarChart scores={[]} />);
    expect(screen.getByText(strings.radar.noData)).toBeInTheDocument();
  });

  it('renders chart title, subtitle, and canvas elements', () => {
    render(<InteractiveRadarChart scores={sampleScores} />);
    expect(screen.getByText(strings.radar.title)).toBeInTheDocument();
    expect(screen.getByText(strings.radar.subtitle)).toBeInTheDocument();
    expect(screen.getByText(strings.radar.candidateScore)).toBeInTheDocument();
    expect(screen.getByText(strings.radar.benchmarkLabel)).toBeInTheDocument();
  });

  it('displays selection hint initially and shows details when interactive node is clicked', () => {
    const handleSelect = vi.fn();
    render(<InteractiveRadarChart scores={sampleScores} onSelectOLQ={handleSelect} />);

    expect(screen.getByText(strings.radar.selectOlqHint)).toBeInTheDocument();

    const circles = document.querySelectorAll('circle');
    expect(circles.length).toBeGreaterThan(0);

    fireEvent.click(circles[0]);

    expect(screen.getByText('Effective Intelligence')).toBeInTheDocument();
    expect(screen.getByText('8.5 / 10')).toBeInTheDocument();
    expect(screen.getByText('Strong problem solving')).toBeInTheDocument();
    expect(handleSelect).toHaveBeenCalledWith(sampleScores[0]);
  });
});
