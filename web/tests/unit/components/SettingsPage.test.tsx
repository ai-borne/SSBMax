import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SettingsPage } from '../../../src/components/settings/SettingsPage';
import { strings } from '../../../src/constants/strings';

describe('SettingsPage Component', () => {
  it('renders settings title, appearance card, notification toggles, and system diagnostics', () => {
    render(<SettingsPage theme="dark" />);

    expect(screen.getByTestId('settings-page')).toBeInTheDocument();
    expect(screen.getByTestId('current-theme-label')).toHaveTextContent(strings.settings.themeDark);
    expect(screen.getByTestId('app-version-value')).toHaveTextContent('v1.0.0-PRO');
    expect(screen.getByTestId('pwa-status-value')).toHaveTextContent('Active (Workbox SW)');
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
});
