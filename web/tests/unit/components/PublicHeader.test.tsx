import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PublicHeader } from '../../../src/components/layout/PublicHeader';
import { strings } from '../../../src/constants/strings';

describe('PublicHeader Component', () => {
  it('renders brand logo, streamlined links, theme toggle, and CTA', () => {
    const handleNavClick = vi.fn();
    const handleToggleTheme = vi.fn();
    const handleSignIn = vi.fn();

    render(
      <PublicHeader
        activeTab="home"
        onNavClick={handleNavClick}
        theme="dark"
        toggleTheme={handleToggleTheme}
        deferredPrompt={null}
        onInstallClick={vi.fn()}
        onSignInClick={handleSignIn}
      />
    );

    expect(screen.getByTestId('public-header')).toBeInTheDocument();
    expect(screen.getByTestId('public-brand-logo')).toBeInTheDocument();
    expect(screen.getByTestId('public-nav-home')).toHaveTextContent(strings.nav.landing);
    expect(screen.getByTestId('public-nav-study')).toHaveTextContent(strings.nav.study);
    expect(screen.getByTestId('public-nav-tests')).toHaveTextContent(strings.nav.tests);
    expect(screen.getByTestId('public-nav-settings')).toHaveTextContent(strings.nav.settings);
    expect(screen.getByTestId('public-cta-start-free')).toBeInTheDocument();
    expect(screen.getByTestId('public-sign-in-button')).toHaveTextContent(strings.header.signIn);
  });

  it('triggers callbacks when links and sign in button are clicked', () => {
    const handleNavClick = vi.fn();
    const handleSignIn = vi.fn();

    render(
      <PublicHeader
        activeTab="home"
        onNavClick={handleNavClick}
        theme="dark"
        toggleTheme={vi.fn()}
        deferredPrompt={null}
        onInstallClick={vi.fn()}
        onSignInClick={handleSignIn}
      />
    );

    fireEvent.click(screen.getByTestId('public-nav-tests'));
    expect(handleNavClick).toHaveBeenCalledWith('tests');

    fireEvent.click(screen.getByTestId('public-sign-in-button'));
    expect(handleSignIn).toHaveBeenCalled();
  });
});
