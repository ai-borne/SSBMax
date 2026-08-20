import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { InteractiveSandbox, evaluateResponseLocally } from '../../../src/components/landing/InteractiveSandbox';
import { strings } from '../../../src/constants/strings';

describe('InteractiveSandbox Component & Local Evaluator', () => {
  it('should accurately evaluate responses using client-side heuristic engine (< 50ms)', () => {
    const highOfficerRes = evaluateResponseLocally('Immediately took charge, delegated tasks, and organized emergency action');
    expect(highOfficerRes.factorScore).toBe(8.8);
    expect(highOfficerRes.isOfficerGrade).toBe(true);
    expect(highOfficerRes.matchedOlqs).toContain('Initiative (OLQ-6)');

    const moderateRes = evaluateResponseLocally('Informed authorities and waited for help');
    expect(moderateRes.factorScore).toBe(6.8);
    expect(moderateRes.isOfficerGrade).toBe(false);

    const passiveRes = evaluateResponseLocally('Nothing');
    expect(passiveRes.factorScore).toBe(5.2);
    expect(passiveRes.isOfficerGrade).toBe(false);
  });

  it('renders interactive sandbox widget with prompt pills and preset chips', () => {
    render(<InteractiveSandbox />);

    expect(screen.getByTestId('interactive-sandbox')).toBeInTheDocument();
    expect(screen.getByText(strings.landing.sandboxTitle)).toBeInTheDocument();
    expect(screen.getByTestId('chip-officer')).toBeInTheDocument();
    expect(screen.getByTestId('chip-average')).toBeInTheDocument();
  });

  it('auto-fills text input and runs instant evaluation when 1-tap preset chip is clicked', async () => {
    render(<InteractiveSandbox />);

    const chipOfficer = screen.getByTestId('chip-officer');
    fireEvent.click(chipOfficer);

    await waitFor(() => {
      expect(screen.getByTestId('sandbox-result-card')).toBeInTheDocument();
    });

    expect(screen.getByText('Factor I & III High Command Output')).toBeInTheDocument();
  });

  it('runs local analysis on custom text input', async () => {
    render(<InteractiveSandbox />);

    const input = screen.getByTestId('sandbox-text-input');
    fireEvent.change(input, { target: { value: 'Immediately took charge and led the team to complete the mission' } });

    const analyzeBtn = screen.getByTestId('analyze-olq-btn');
    fireEvent.click(analyzeBtn);

    await waitFor(() => {
      expect(screen.getByTestId('sandbox-result-card')).toBeInTheDocument();
    });

    expect(screen.getByText('8.8 / 10')).toBeInTheDocument();
  });

  it('supports light and dark theme adaptive styling and SSOT headers', () => {
    render(<InteractiveSandbox />);
    const sandboxEl = screen.getByTestId('interactive-sandbox');
    
    // Check adaptive background & text classes (not hardcoded bg-slate-900 alone)
    expect(sandboxEl.className).toContain('bg-white');
    expect(sandboxEl.className).toContain('dark:bg-slate-900');
    expect(screen.getByText(strings.landing.sandboxSrtPromptHeader)).toBeInTheDocument();
    expect(screen.getByText(strings.landing.sandboxPresetHeader)).toBeInTheDocument();

    const promptCard = screen.getByTestId('active-situation-prompt');
    expect(promptCard.className).toContain('dark:bg-slate-800/90');
    expect(promptCard.className).toContain('dark:border-slate-700/80');
  });
});

