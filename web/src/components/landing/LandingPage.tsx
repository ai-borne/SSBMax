import { FC } from 'react';
// Centralized string resources: strings.landing
import { HeroSection } from './HeroSection';
import { InteractiveSandbox } from './InteractiveSandbox';
import { SampleDossierPreview } from './SampleDossierPreview';
import { TestGridSection } from './TestGridSection';
import { SubscriptionPage } from '../subscription/SubscriptionPage';

export interface LandingPageProps {
  onStartFreeClick: () => void;
  onStartTestClick: (testId: string) => void;
}

export const LandingPage: FC<LandingPageProps> = ({ onStartFreeClick, onStartTestClick }) => {
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
        <SubscriptionPage />
      </div>
    </div>
  );
};

export default LandingPage;
