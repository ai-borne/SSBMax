import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SettingsPage } from '../../../src/components/settings/SettingsPage';
import { strings } from '../../../src/constants/strings';

describe('SettingsPage Component', () => {
  it('renders settings title, account section with PII warning, appearance card, FAQs, and system diagnostics', () => {
    render(<SettingsPage theme="dark" userName="Cadet Vikram" userEmail="vikram@ssbmax.in" />);

    expect(screen.getByTestId('settings-page')).toBeInTheDocument();
    expect(screen.getByTestId('settings-header-banner')).toBeInTheDocument();
    expect(screen.getByTestId('account-section')).toBeInTheDocument();
    expect(screen.getByTestId('pii-privacy-warning')).toBeInTheDocument();
    expect(screen.getByTestId('pii-privacy-warning')).toHaveTextContent(strings.account.piqPrivacyWarning);
    expect(screen.getByTestId('account-display-name')).toHaveTextContent('Cadet Vikram');
    expect(screen.getByTestId('account-email')).toHaveTextContent('vikram@ssbmax.in');

    expect(screen.getByTestId('current-theme-label')).toHaveTextContent(strings.settings.themeDark);
    expect(screen.getByTestId('faq-section')).toBeInTheDocument();
    expect(screen.getByTestId('legal-section')).toBeInTheDocument();
    expect(screen.getByTestId('app-version-value')).toHaveTextContent('v1.0.0-PRO');
    expect(screen.getByTestId('pwa-status-value')).toHaveTextContent('Active (Workbox SW)');
  });

  it('triggers account action handlers for edit diagnostic, upgrade pass, and sign out', () => {
    const onEditDiagnostic = vi.fn();
    const onUpgrade = vi.fn();
    const onSignOut = vi.fn();

    render(
      <SettingsPage
        isGuest={false}
        isPro={false}
        onEditDiagnostic={onEditDiagnostic}
        onUpgrade={onUpgrade}
        onSignOut={onSignOut}
      />
    );

    fireEvent.click(screen.getByTestId('edit-diagnostic-btn'));
    expect(onEditDiagnostic).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTestId('upgrade-pass-btn'));
    expect(onUpgrade).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTestId('sign-out-btn'));
    expect(onSignOut).toHaveBeenCalledTimes(1);
  });

  it('toggles FAQ accordion expansion and collapsing', () => {
    render(<SettingsPage />);

    // Q0 is expanded by default in FAQSection
    expect(screen.getByTestId('faq-answer-0')).toBeInTheDocument();
    expect(screen.queryByTestId('faq-answer-1')).not.toBeInTheDocument();

    // Click Q1 trigger to expand Q1
    fireEvent.click(screen.getByTestId('faq-trigger-1'));
    expect(screen.getByTestId('faq-answer-1')).toBeInTheDocument();
    expect(screen.queryByTestId('faq-answer-0')).not.toBeInTheDocument();

    // Click Q1 trigger again to collapse
    fireEvent.click(screen.getByTestId('faq-trigger-1'));
    expect(screen.queryByTestId('faq-answer-1')).not.toBeInTheDocument();
  });

  it('triggers onViewPrivacy and onViewTerms handlers', () => {
    const onViewPrivacy = vi.fn();
    const onViewTerms = vi.fn();

    render(<SettingsPage onViewPrivacy={onViewPrivacy} onViewTerms={onViewTerms} />);

    fireEvent.click(screen.getByTestId('view-privacy-btn'));
    expect(onViewPrivacy).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTestId('view-terms-btn'));
    expect(onViewTerms).toHaveBeenCalledTimes(1);
  });

  it('triggers onToggleTheme handler when theme button is clicked', () => {
    const onToggleTheme = vi.fn();
    render(<SettingsPage theme="dark" onToggleTheme={onToggleTheme} />);

    fireEvent.click(screen.getByTestId('toggle-theme-setting'));
    expect(onToggleTheme).toHaveBeenCalledTimes(1);
  });

  it('triggers onClearCache and displays confirmation banner', () => {
    const onClearCache = vi.fn();
    render(<SettingsPage onClearCache={onClearCache} />);

    fireEvent.click(screen.getByTestId('clear-cache-button'));
    expect(onClearCache).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('cache-cleared-banner')).toBeInTheDocument();
    expect(screen.getByTestId('cache-cleared-banner')).toHaveTextContent(strings.settings.cacheCleared);
  });

  it('allows toggling notification settings switches', () => {
    render(<SettingsPage />);

    const emailToggle = screen.getByTestId('toggle-email-alerts');
    fireEvent.click(emailToggle);

    const syncToggle = screen.getByTestId('toggle-sync-alerts');
    fireEvent.click(syncToggle);

    const practiceToggle = screen.getByTestId('toggle-practice-reminders');
    fireEvent.click(practiceToggle);

    expect(emailToggle).toBeInTheDocument();
    expect(syncToggle).toBeInTheDocument();
    expect(practiceToggle).toBeInTheDocument();
  });

  it('renders the developer settings card in dev builds and forwards tier selection', () => {
    const onSelectDevTier = vi.fn();
    render(<SettingsPage devTierOverride="FOLLOW_REAL" onSelectDevTier={onSelectDevTier} />);

    expect(screen.getByTestId('dev-settings-card')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('dev-tier-chip-FORCE_PREMIUM'));
    expect(onSelectDevTier).toHaveBeenCalledWith('FORCE_PREMIUM');
  });
});
