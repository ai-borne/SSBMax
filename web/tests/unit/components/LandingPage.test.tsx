import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LandingPage } from '../../../src/components/landing/LandingPage';

describe('LandingPage Assembly Component', () => {
  it('renders HeroSection, InteractiveSandbox, SampleDossierPreview, TestGridSection teaser, and the real 4-tier pricing grid', () => {
    render(<LandingPage onStartFreeClick={vi.fn()} onViewPricingClick={vi.fn()} />);

    expect(screen.getByTestId('landing-page')).toBeInTheDocument();
    expect(screen.getByTestId('hero-section')).toBeInTheDocument();
    expect(screen.getByTestId('interactive-sandbox')).toBeInTheDocument();
    expect(screen.getByTestId('sample-dossier-preview')).toBeInTheDocument();
    expect(screen.getByTestId('test-grid-section')).toBeInTheDocument();
    // The real PaymentRibbon (same component/data as the SSB Tests tab), not a bespoke copy.
    expect(screen.getByTestId('payment-ribbon')).toBeInTheDocument();
    expect(screen.getByTestId('tier-card-FREE')).toBeInTheDocument();
    expect(screen.getByTestId('tier-card-BASIC')).toBeInTheDocument();
    expect(screen.getByTestId('tier-card-PRO')).toBeInTheDocument();
    expect(screen.getByTestId('tier-card-PREMIUM')).toBeInTheDocument();
  });

  it('routes a pricing tier click to the caller (SSB Tests tab, the single real pricing surface)', () => {
    const onViewPricingClick = vi.fn();
    render(<LandingPage onStartFreeClick={vi.fn()} onViewPricingClick={onViewPricingClick} />);

    fireEvent.click(screen.getByTestId('upgrade-button-FREE'));

    expect(onViewPricingClick).toHaveBeenCalledOnce();
  });

  it('routes the "explore all tests" CTA to the caller instead of launching a test directly', () => {
    const onViewPricingClick = vi.fn();
    render(<LandingPage onStartFreeClick={vi.fn()} onViewPricingClick={onViewPricingClick} />);

    fireEvent.click(screen.getByTestId('grid-cta-button'));

    expect(onViewPricingClick).toHaveBeenCalledOnce();
  });
});
