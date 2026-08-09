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

  it('navigates across the 4 core tabs (home, study, tests, settings)', () => {
    render(<App />);

    // Click SSB Tests link on PublicHeader
    fireEvent.click(screen.getByTestId('public-nav-tests'));
    expect(screen.getByTestId('practice-tests-page')).toBeInTheDocument();

    // Click Study nav
    fireEvent.click(screen.getByTestId('nav-item-study'));
    expect(screen.getByTestId('study-material-page')).toBeInTheDocument();

    // Click Settings nav
    fireEvent.click(screen.getByTestId('nav-item-settings'));
    expect(screen.getByTestId('settings-page')).toBeInTheDocument();

    // Click Home nav
    fireEvent.click(screen.getByTestId('nav-item-home'));
    expect(screen.getByTestId('hero-section')).toBeInTheDocument();
  });

  it('launches full-screen test runner and hides header/footer, then exits back to app layout', async () => {
    render(<App />);

    // Go to tests page from PublicHeader
    fireEvent.click(screen.getByTestId('public-nav-tests'));

    // Launch free OIR test
    const launchOIRBtn = screen.getByTestId('launch-test-oir');
    fireEvent.click(launchOIRBtn);

    // Header and navigation should be hidden in test mode
    expect(screen.queryByTestId('brand-logo')).not.toBeInTheDocument();
    expect(screen.queryByTestId('nav-item-home')).not.toBeInTheDocument();

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
