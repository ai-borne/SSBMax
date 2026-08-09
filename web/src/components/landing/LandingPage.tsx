import { FC } from 'react';
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
    <div className="w-full flex flex-col items-center space-y-4" data-testid="landing-page">
      <HeroSection
        onStartFreeClick={onStartFreeClick}
        onViewSampleDossierClick={scrollToDossier}
      />
      <InteractiveSandbox />
      <div id="sample-dossier-section" className="w-full">
        <SampleDossierPreview />
      </div>
      <TestGridSection onStartTestClick={onStartTestClick} />
      <SubscriptionPage />
    </div>
  );
};

export default LandingPage;
