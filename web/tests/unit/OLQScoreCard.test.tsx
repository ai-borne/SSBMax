import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { OLQScoreCard } from '../../src/components/evaluation/OLQScoreCard';
import { strings } from '../../src/constants/strings';

describe('OLQScoreCard', () => {
  it('renders fallback when olqScores array is empty', () => {
    render(<OLQScoreCard olqScores={[]} />);
    expect(screen.getByText(strings.olq.noScores)).toBeInTheDocument();
  });

  it('renders scores organized into factors with insights and confidence', () => {
    const scores = [
      { olq: 'EFFECTIVE_INTELLIGENCE', score: 4.5, reasoning: 'Practical approach demonstrated' },
      { olq: 'SOCIAL_ADJUSTMENT', score: 3.0, reasoning: 'High adaptability shown' },
      { olq: 'INITIATIVE', score: 5.0, reasoning: 'Proactive responses' },
      { olq: 'COURAGE', score: 2.5, reasoning: 'Brave decisions' }
    ];
    const keyInsights = ['Demonstrates strong leadership potential.'];

    render(
      <OLQScoreCard
        olqScores={scores}
        overallConfidence={85}
        keyInsights={keyInsights}
        suggestedFollowUp="How did you handle conflict during sports?"
      />
    );

    expect(screen.getByText(strings.olq.scoreCardTitle)).toBeInTheDocument();
    expect(screen.getByText(`${strings.olq.overallConfidence}: 85%`)).toBeInTheDocument();
    expect(screen.getByText('EFFECTIVE INTELLIGENCE')).toBeInTheDocument();
    expect(screen.getByText('SOCIAL ADJUSTMENT')).toBeInTheDocument();
    expect(screen.getByText('INITIATIVE')).toBeInTheDocument();
    expect(screen.getByText('COURAGE')).toBeInTheDocument();
    expect(screen.getByText('Demonstrates strong leadership potential.')).toBeInTheDocument();
    expect(screen.getByText('How did you handle conflict during sports?')).toBeInTheDocument();
  });
});
