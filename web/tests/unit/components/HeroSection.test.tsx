import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { HeroSection } from '../../../src/components/landing/HeroSection';
import { strings } from '../../../src/constants/strings';

describe('HeroSection Component', () => {
  it('renders hero title, badge, and subtitle from string resources', () => {
    render(<HeroSection />);

    expect(screen.getByText(strings.landing.heroBadge)).toBeInTheDocument();
    expect(screen.getByText(strings.landing.heroSubtitle)).toBeInTheDocument();
  });

  it('triggers onStartFreeClick callback when Start Free button is clicked', () => {
    const handleStartFree = vi.fn();
    render(<HeroSection onStartFreeClick={handleStartFree} />);

    const startBtn = screen.getByTestId('start-free-btn');
    expect(startBtn).toBeInTheDocument();
    fireEvent.click(startBtn);

    expect(handleStartFree).toHaveBeenCalledTimes(1);
  });

  it('triggers onUnlockProClick callback when Unlock Pro button is clicked', () => {
    const handleUnlockPro = vi.fn();
    render(<HeroSection onUnlockProClick={handleUnlockPro} />);

    const unlockBtn = screen.getByTestId('unlock-pro-btn');
    expect(unlockBtn).toBeInTheDocument();
    fireEvent.click(unlockBtn);

    expect(handleUnlockPro).toHaveBeenCalledTimes(1);
  });

  it('renders tactical stat badges for OLQ, Stage, and AI analysis', () => {
    render(<HeroSection />);

    expect(screen.getByText(strings.landing.statOlq)).toBeInTheDocument();
    expect(screen.getByText(strings.landing.statStage)).toBeInTheDocument();
    expect(screen.getByText(strings.landing.statAi)).toBeInTheDocument();
  });

  it('uses theme-adaptive dark: text and background classes for light/dark contrast compliance', () => {
    const { container } = render(<HeroSection />);
    const heading = container.querySelector('h1');
    expect(heading?.className).toContain('dark:text-white');
    expect(heading?.className).toContain('text-slate-900');
  });

  it('should apply animate-shimmer class to the AI gradient text span', () => {
    const { container } = render(<HeroSection />);
    // The <span> wrapping "AI" must carry the shimmer animation class
    const shimmerSpan = container.querySelector('span.animate-shimmer');
    expect(shimmerSpan).toBeInTheDocument();
    expect(shimmerSpan?.textContent?.trim()).toBe('AI');
  });

  it('should apply hover-lift and transition classes to all three hero stat cards', () => {
    const { container } = render(<HeroSection />);
    const statCards = container.querySelectorAll('[data-testid="hero-stat-card"]');
    expect(statCards.length).toBe(3);
    statCards.forEach((card) => {
      expect(card.className).toContain('hover:-translate-y-1');
      expect(card.className).toContain('transition-all');
    });
  });

  it('should apply shimmer animation class to the primary CTA button', () => {
    render(<HeroSection />);
    const ctaBtn = screen.getByTestId('start-free-btn');
    expect(ctaBtn.className).toContain('animate-shimmer');
  });

  it('should apply glow shadow class to the platform badge', () => {
    const { container } = render(<HeroSection />);
    const badge = container.querySelector('[data-testid="hero-platform-badge"]');
    expect(badge).toBeInTheDocument();
    expect(badge?.className).toContain('shadow-md');
  });
});
