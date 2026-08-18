import { FC } from 'react';
import { ArrowRight } from 'lucide-react';
// Centralized string resources: strings.landing
import { strings } from '../../constants/strings';
import { HeroSection } from './HeroSection';
import { InteractiveSandbox } from './InteractiveSandbox';
import { SampleDossierPreview } from './SampleDossierPreview';
import { TestGridSection } from './TestGridSection';

export interface LandingPageProps {
  onStartFreeClick: () => void;
  onStartTestClick: (testId: string) => void;
  onViewPricingClick: () => void;
}

export const LandingPage: FC<LandingPageProps> = ({ onStartFreeClick, onStartTestClick, onViewPricingClick }) => {
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
        <TestGridSection onStartTestClick={onStartTestClick} />
        {/*
          Pricing lives in one place -- PaymentRibbon.tsx on the SSB Tests tab (SUBSCRIPTION_TIERS,
          the same source SubscriptionPage.tsx consumes). This is a CTA into that surface, not a
          second pricing grid -- a duplicate here previously showed only 2 of the 4 tiers and could
          drift from the real one.
        */}
        <div
          className="w-full max-w-3xl mx-auto text-center p-8 rounded-3xl bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80 shadow-md space-y-4"
          data-testid="pricing-cta-section"
        >
          <h2 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
            {strings.landing.pricingCtaTitle}
          </h2>
          <p className="text-slate-600 dark:text-slate-400 text-sm max-w-xl mx-auto">
            {strings.landing.pricingCtaSubtitle}
          </p>
          <button
            onClick={onViewPricingClick}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 text-white text-sm font-bold shadow-lg shadow-sky-600/20 transition-all"
            data-testid="pricing-cta-button"
          >
            <span>{strings.landing.pricingCtaButton}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default LandingPage;
