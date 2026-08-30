import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { App } from '../../../src/App';
import { strings } from '../../../src/constants/strings';
import { ContentRepository } from '../../../src/repositories/ContentRepository';
import { authService } from '../../../src/services/AuthService';

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

  it('renders default home section and unified command header on initial load', () => {
    render(<App />);

    expect(screen.getByTestId('hero-section')).toBeInTheDocument();
    expect(screen.getByTestId('command-header')).toBeInTheDocument();
    expect(screen.getByTestId('brand-logo')).toBeInTheDocument();
    expect(screen.getByTestId('unified-pill-nav')).toBeInTheDocument();
  });

  it('navigates across the 4 core tabs (home, study, tests, settings)', () => {
    render(<App />);

    // Click SSB Tests link on unified nav
    fireEvent.click(screen.getByTestId('nav-item-tests'));
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

    // Go to tests page from unified nav
    fireEvent.click(screen.getByTestId('nav-item-tests'));

    // Launch free OIR test
    const launchOIRBtn = screen.getByTestId('launch-button-oir');
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

  it('triggers Google sign-in when the header "Sign In / Start Free" button is clicked', () => {
    const signInSpy = vi.spyOn(authService, 'signInWithGoogle').mockResolvedValue(undefined as never);

    render(<App />);

    fireEvent.click(screen.getByTestId('sign-in-cta-button'));

    expect(signInSpy).toHaveBeenCalledTimes(1);
  });

  it('shows a working sign-out control in Settings for a signed-in user', () => {
    vi.spyOn(authService, 'getCurrentUser').mockReturnValue({
      uid: 'user_123',
      email: 'cadet@ssbmax.in',
      displayName: 'Cadet Officer',
      photoURL: null
    });
    const signOutSpy = vi.spyOn(authService, 'signOut').mockResolvedValue(undefined);

    render(<App />);

    fireEvent.click(screen.getByTestId('nav-item-settings'));

    expect(screen.getByTestId('account-display-name')).toHaveTextContent('Cadet Officer');
    expect(screen.getByTestId('account-email')).toHaveTextContent('cadet@ssbmax.in');

    fireEvent.click(screen.getByTestId('sign-out-btn'));
    expect(signOutSpy).toHaveBeenCalledTimes(1);
  });

  it('hides the sign-out control in Settings for a guest user', () => {
    render(<App />);

    fireEvent.click(screen.getByTestId('nav-item-settings'));

    expect(screen.queryByTestId('sign-out-btn')).not.toBeInTheDocument();
  });

  it('wires real offline status into OIRTestRunner instead of the isOnline=true default', async () => {
    // Regression: App.tsx never called useOnlineStatus() and never passed isOnline to
    // OIRTestRunner, so the prop's `isOnline = true` default always won -- the offline-queue
    // enqueue branch (OIRTestViewModel.submitTest's isOnline===false path) was unreachable from
    // the real UI no matter the browser's actual connectivity.
    vi.spyOn(window.navigator, 'onLine', 'get').mockReturnValue(false);

    render(<App />);
    fireEvent.click(screen.getByTestId('nav-item-tests'));
    fireEvent.click(screen.getByTestId('launch-button-oir'));

    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });

    expect(screen.getByText(strings.oir.requiresOnline)).toBeInTheDocument();
  });

  it('renders Settings instead of crashing when a stale/invalid dev-tier override is stored', () => {
    // Regression: a corrupted `ssbmax_dev_tier_override` localStorage value (observed live as
    // the string "command") crashed DeveloperSettingsCard and blanked the whole Settings tab.
    localStorage.setItem('ssbmax_dev_tier_override', 'command');

    render(<App />);

    fireEvent.click(screen.getByTestId('nav-item-settings'));

    expect(screen.getByTestId('settings-page')).toBeInTheDocument();
    expect(screen.getByTestId('dev-tier-chip-FOLLOW_REAL')).toHaveAttribute('aria-pressed', 'true');
  });
});
