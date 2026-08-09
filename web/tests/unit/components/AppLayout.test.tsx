import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AppLayout } from '../../../src/components/layout/AppLayout';
import { strings } from '../../../src/constants/strings';

const mockUser = {
  uid: 'user_123',
  email: 'cadet@ssbmax.in',
  displayName: 'Cadet Officer',
  photoURL: null,
  isPaidMember: true
};

describe('AppLayout Component', () => {
  beforeEach(() => {
    localStorage.setItem('theme', 'dark');
    document.documentElement.classList.add('dark');
  });

  afterEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('dark');
  });

  it('renders children content within layout shell', () => {
    render(
      <AppLayout user={mockUser}>
        <div data-testid="test-child">Child Content</div>
      </AppLayout>
    );

    expect(screen.getByTestId('test-child')).toBeInTheDocument();
    expect(screen.getByText('Child Content')).toBeInTheDocument();
  });

  it('renders unified pill segmented navigation bar for both guest and authenticated users', () => {
    render(
      <AppLayout activeTab="home" user={null}>
        <div>Public Landing Content</div>
      </AppLayout>
    );

    expect(screen.getByTestId('brand-logo')).toBeInTheDocument();
    expect(screen.getByTestId('command-header')).toBeInTheDocument();
    expect(screen.getByTestId('nav-item-home')).toBeInTheDocument();
    expect(screen.getByTestId('nav-item-study')).toBeInTheDocument();
    expect(screen.getByTestId('nav-item-tests')).toBeInTheDocument();
    expect(screen.getByTestId('nav-item-settings')).toBeInTheDocument();
    expect(screen.getByTestId('sign-in-cta-button')).toBeInTheDocument();
    expect(screen.getByTestId('sign-in-cta-button')).toHaveTextContent(strings.header.signIn);
  });

  it('renders PRO badge for authenticated paid officer member', () => {
    render(
      <AppLayout activeTab="home" user={mockUser}>
        <div>Content</div>
      </AppLayout>
    );

    expect(screen.getByTestId('pro-membership-badge')).toBeInTheDocument();
    expect(screen.getByTestId('nav-item-home')).toBeInTheDocument();
  });

  it('triggers onTabChange callback when navigation pill is clicked', () => {
    const handleTabChange = vi.fn();
    render(
      <AppLayout activeTab="home" user={null} onTabChange={handleTabChange}>
        <div>Content</div>
      </AppLayout>
    );

    const studyNav = screen.getByTestId('nav-item-study');
    fireEvent.click(studyNav);
    expect(handleTabChange).toHaveBeenCalledWith('study');

    const testsNav = screen.getByTestId('nav-item-tests');
    fireEvent.click(testsNav);
    expect(handleTabChange).toHaveBeenCalledWith('tests');
  });

  it('triggers onSignInClick when sign-in button is clicked for guest user', () => {
    const onSignInClick = vi.fn();
    render(
      <AppLayout activeTab="home" user={null} onSignInClick={onSignInClick}>
        <div>Content</div>
      </AppLayout>
    );

    const signInBtn = screen.getByTestId('sign-in-cta-button');
    fireEvent.click(signInBtn);
    expect(onSignInClick).toHaveBeenCalledTimes(1);
  });

  it('toggles mobile menu drawer when mobile menu button is clicked', () => {
    render(
      <AppLayout user={null}>
        <div>Content</div>
      </AppLayout>
    );

    const mobileMenuBtn = screen.getByTestId('mobile-menu-button');
    expect(screen.queryByTestId('mobile-menu-drawer')).not.toBeInTheDocument();

    fireEvent.click(mobileMenuBtn);
    expect(screen.getByTestId('mobile-menu-drawer')).toBeInTheDocument();
  });

  it('toggles theme mode when theme toggle button is clicked', () => {
    render(
      <AppLayout user={null}>
        <div>Content</div>
      </AppLayout>
    );

    const toggleButton = screen.getByTestId('theme-toggle-button');
    expect(document.documentElement.classList.contains('dark')).toBe(true);

    fireEvent.click(toggleButton);
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });
});
