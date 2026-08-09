import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { App } from '../../../src/App';
import { strings } from '../../../src/constants/strings';
import { ContentRepository } from '../../../src/repositories/ContentRepository';

describe('App Main Component Routing & Full-Screen Test Mode', () => {
  beforeEach(() => {
    localStorage.setItem('theme', 'dark');
    document.documentElement.classList.add('dark');

    vi.spyOn(ContentRepository.prototype, 'getOIRQuestions').mockResolvedValue({
      id: 'batch_0',
      batchIndex: 0,
      totalItems: 1,
      items: [
        {
          id: 'q1',
          questionNumber: 1,
          questionText: 'Sample OIR Question #1',
          options: ['Option A', 'Option B', 'Option C', 'Option D'],
          type: 'VERBAL'
        }
      ]
    });
  });

  afterEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('dark');
    vi.restoreAllMocks();
  });

  it('renders default home section and PublicHeader on initial load', () => {
    render(<App />);

    expect(screen.getByTestId('hero-section')).toBeInTheDocument();
    expect(screen.getByTestId('public-header')).toBeInTheDocument();
    expect(screen.getByTestId('public-brand-logo')).toBeInTheDocument();
  });

  it('navigates to practice, dashboard, study, reports, and pricing tabs', () => {
    render(<App />);

    // Click Practice link on PublicHeader
    fireEvent.click(screen.getByTestId('public-nav-practice'));
    expect(screen.getByTestId('practice-tests-page')).toBeInTheDocument();

    // Click Dashboard nav on Command Header
    fireEvent.click(screen.getByTestId('nav-item-dashboard'));
    expect(screen.getByTestId('candidate-dashboard')).toBeInTheDocument();

    // Click Study nav
    fireEvent.click(screen.getByTestId('nav-item-study'));
    expect(screen.getByTestId('study-material-page')).toBeInTheDocument();

    // Click Reports nav
    fireEvent.click(screen.getByTestId('nav-item-reports'));
    expect(screen.getAllByText(strings.reportsPage.title)[0]).toBeInTheDocument();

    // Click Pricing nav
    fireEvent.click(screen.getByTestId('nav-item-pricing'));
    expect(screen.getByTestId('subscription-page')).toBeInTheDocument();
  });

  it('launches full-screen test runner and hides header/footer, then exits back to app layout', async () => {
    render(<App />);

    // Go to practice page from PublicHeader
    fireEvent.click(screen.getByTestId('public-nav-practice'));

    // Launch free OIR test
    const launchOIRBtn = screen.getByTestId('launch-test-oir');
    fireEvent.click(launchOIRBtn);

    // Header and navigation should be hidden in test mode
    expect(screen.queryByTestId('brand-logo')).not.toBeInTheDocument();
    expect(screen.queryByTestId('nav-item-dashboard')).not.toBeInTheDocument();

    // Wait for loading indicator to finish and exit button to render
    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });

    const exitBtn = screen.getAllByText(strings.exitTest.exitButton)[0];
    fireEvent.click(exitBtn);

    // Click confirm exit modal button
    const confirmExitBtn = screen.getAllByText(strings.exitTest.confirmButton)[1];
    fireEvent.click(confirmExitBtn);

    // Navigation and header should be restored
    await waitFor(() => {
      expect(screen.getByTestId('brand-logo')).toBeInTheDocument();
    });
  });
});
