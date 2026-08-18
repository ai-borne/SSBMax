import { FC } from 'react';
// Centralized string resources: strings.landing
import { PaymentRibbon } from '../practice/PaymentRibbon';
import { HeroSection } from './HeroSection';
import { InteractiveSandbox } from './InteractiveSandbox';
import { SampleDossierPreview } from './SampleDossierPreview';
import { TestGridSection } from './TestGridSection';

export interface LandingPageProps {
  onStartFreeClick: () => void;
  /** Routes to the SSB Tests tab -- the one place with the real, functional test launcher and pricing grid. */
  onViewPricingClick: () => void;
}

export const LandingPage: FC<LandingPageProps> = ({ onStartFreeClick, onViewPricingClick }) => {
  const scrollToDossier = () => {
    const el = document.getElementById('sample-dossier-section');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="w-full flex flex-col items-center" data-testid="landing-page">
      <HeroSection
        onStartFreeClick={onStartFreeClick}
        onViewSampleDossierClick={scrollToDossier}
      />
      <div className="max-w-7xl w-full mx-auto px-4 py-6 space-y-8 flex flex-col items-center">
        <InteractiveSandbox />
        <div id="sample-dossier-section" className="w-full">
          <SampleDossierPreview />
        </div>
        <TestGridSection onExploreTestsClick={onViewPricingClick} />
        {/*
          Pricing lives in one place -- PaymentRibbon.tsx (SUBSCRIPTION_TIERS, the same source
          SubscriptionPage.tsx and the SSB Tests tab consume). Rendered directly here (not a
          bespoke summary card) so the home page shows the real 4-tier grid instead of a copy
          that can drift from it. Anonymous visitors are treated as FREE; any tier action here
          routes to the SSB Tests tab rather than starting checkout from the marketing page.
        */}
        <div className="w-full max-w-6xl mx-auto" data-testid="pricing-cta-section">
          <PaymentRibbon
            currentTier="FREE"
            onSelectTier={onViewPricingClick}
            onUpgradeClick={onViewPricingClick}
          />
        </div>
      </div>
    </div>
  );
};

export default LandingPage;
