import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LandingPage } from '../../../src/components/landing/LandingPage';

describe('LandingPage Assembly Component', () => {
  it('renders HeroSection, InteractiveSandbox, SampleDossierPreview, TestGridSection, and a pricing CTA', () => {
    render(<LandingPage onStartFreeClick={vi.fn()} onStartTestClick={vi.fn()} onViewPricingClick={vi.fn()} />);

    expect(screen.getByTestId('landing-page')).toBeInTheDocument();
    expect(screen.getByTestId('hero-section')).toBeInTheDocument();
    expect(screen.getByTestId('interactive-sandbox')).toBeInTheDocument();
    expect(screen.getByTestId('sample-dossier-preview')).toBeInTheDocument();
    expect(screen.getByTestId('test-grid-section')).toBeInTheDocument();
    expect(screen.getByTestId('pricing-cta-section')).toBeInTheDocument();
  });

  it('routes the pricing CTA click to the caller (SSB Tests tab, the single real pricing surface)', () => {
    const onViewPricingClick = vi.fn();
    render(<LandingPage onStartFreeClick={vi.fn()} onStartTestClick={vi.fn()} onViewPricingClick={onViewPricingClick} />);

    fireEvent.click(screen.getByTestId('pricing-cta-button'));

    expect(onViewPricingClick).toHaveBeenCalledOnce();
  });
});
