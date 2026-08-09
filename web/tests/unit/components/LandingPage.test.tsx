import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LandingPage } from '../../../src/components/landing/LandingPage';

describe('LandingPage Assembly Component', () => {
  it('renders HeroSection, InteractiveSandbox, SampleDossierPreview, TestGridSection, and SubscriptionPage', () => {
    render(<LandingPage onStartFreeClick={vi.fn()} onStartTestClick={vi.fn()} />);

    expect(screen.getByTestId('landing-page')).toBeInTheDocument();
    expect(screen.getByTestId('hero-section')).toBeInTheDocument();
    expect(screen.getByTestId('interactive-sandbox')).toBeInTheDocument();
    expect(screen.getByTestId('sample-dossier-preview')).toBeInTheDocument();
    expect(screen.getByTestId('test-grid-section')).toBeInTheDocument();
    expect(screen.getByTestId('subscription-page')).toBeInTheDocument();
  });
});
