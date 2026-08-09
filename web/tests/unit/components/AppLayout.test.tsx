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

  it('renders title, brand logo, and command navigation items for authenticated user', () => {
    render(
      <AppLayout activeTab="dashboard" user={mockUser}>
        <div>Content</div>
      </AppLayout>
    );

    expect(screen.getByTestId('brand-logo')).toBeInTheDocument();
    expect(screen.getAllByText(strings.header.title)[0]).toBeInTheDocument();
    expect(screen.getByTestId('nav-item-dashboard')).toBeInTheDocument();
    expect(screen.getByTestId('nav-item-practice')).toBeInTheDocument();
    expect(screen.getByTestId('nav-item-study')).toBeInTheDocument();
    expect(screen.getByTestId('nav-item-reports')).toBeInTheDocument();
    expect(screen.getByTestId('nav-item-pricing')).toBeInTheDocument();
  });

  it('renders PublicHeader for unauthenticated user on landing page', () => {
    render(
      <AppLayout activeTab="home" user={null}>
        <div>Public Landing Content</div>
      </AppLayout>
    );

    expect(screen.getByTestId('public-header')).toBeInTheDocument();
    expect(screen.getByTestId('public-cta-start-free')).toBeInTheDocument();
  });

  it('triggers onTabChange callback when navigation item is clicked', () => {
    const handleTabChange = vi.fn();
    render(
      <AppLayout activeTab="dashboard" user={mockUser} onTabChange={handleTabChange}>
        <div>Content</div>
      </AppLayout>
    );

    const practiceNav = screen.getByTestId('nav-item-practice');
    fireEvent.click(practiceNav);

    expect(handleTabChange).toHaveBeenCalledWith('practice');
  });

  it('toggles mobile menu drawer when mobile menu button is clicked', () => {
    render(
      <AppLayout user={mockUser}>
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
      <AppLayout user={mockUser}>
        <div>Content</div>
      </AppLayout>
    );

    const toggleButton = screen.getByTestId('theme-toggle-button');
    expect(document.documentElement.classList.contains('dark')).toBe(true);

    fireEvent.click(toggleButton);
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });
});
