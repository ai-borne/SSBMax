import { useState, useMemo, FC } from 'react';
import { AppLayout } from './components/layout/AppLayout';
import { LandingPage } from './components/landing/LandingPage';
import { PracticeTestsPage } from './components/practice/PracticeTestsPage';
import { StudyMaterialPage } from './components/study/StudyMaterialPage';
import { SettingsPage } from './components/settings/SettingsPage';
import { PrivacyPolicy } from './components/legal/PrivacyPolicy';
import { TermsAndRefunds } from './components/legal/TermsAndRefunds';
import { OIRTestRunner } from './components/testRunners/OIRTestRunner';
import { PsychologyTestRunner } from './components/testRunners/PsychologyTestRunner';
import { OIRTestViewModel } from './viewmodels/OIRTestViewModel';
import { PsychologyTestViewModel } from './viewmodels/PsychologyTestViewModel';
import { ContentRepository } from './repositories/ContentRepository';
import { useTabRouting } from './hooks/useTabRouting';
import { authService } from './services/AuthService';
import { AccessTier, DevTierOverride, getEffectiveTier } from './constants/ssbSelectionProcess';

const DEV_TIER_OVERRIDE_KEY = 'ssbmax_dev_tier_override';

export const App: FC = () => {
  const { activeTab, setActiveTab } = useTabRouting('home');
  const [activeTest, setActiveTest] = useState<string | null>(null);
  const [activeBatchId, setActiveBatchId] = useState<string | undefined>(undefined);
  const [isPaidMember] = useState(false);
  const [devTierOverride, setDevTierOverride] = useState<DevTierOverride>(
    () => (localStorage.getItem(DEV_TIER_OVERRIDE_KEY) as DevTierOverride | null) || 'real'
  );

  const handleSelectDevTier = (override: DevTierOverride) => {
    setDevTierOverride(override);
    localStorage.setItem(DEV_TIER_OVERRIDE_KEY, override);
  };

  const realTier: AccessTier = authService.getCurrentUser()?.isPaidMember ? 'officer' : 'cadet';
  const effectiveTier: AccessTier = import.meta.env.DEV
    ? getEffectiveTier(devTierOverride, realTier)
    : realTier;

  const repository = useMemo(() => new ContentRepository(), []);
  const oirViewModel = useMemo(() => new OIRTestViewModel(repository), [repository]);
  const psychViewModel = useMemo(
    () => new PsychologyTestViewModel(activeTest === 'ppdt' ? 'PPDT' : 'TAT', repository),
    [repository, activeTest]
  );

  const handleStartTest = (testType: string, batchId?: string) => {
    setActiveTest(testType);
    setActiveBatchId(batchId);
  };

  const handleExitTest = () => {
    setActiveTest(null);
    setActiveBatchId(undefined);
  };

  const handleBackToHome = () => {
    setActiveTab('home');
  };

  const oirBatchIndex = useMemo(() => {
    if (!activeBatchId) return 0;
    const match = activeBatchId.match(/\d+/);
    return match ? parseInt(match[0], 10) : 0;
  }, [activeBatchId]);

  return (
    <AppLayout activeTab={activeTab} onTabChange={setActiveTab} isTestMode={Boolean(activeTest)}>
      {activeTest ? (
        activeTest === 'oir' ? (
          <OIRTestRunner
            viewModel={oirViewModel}
            userId="cadet-web-user"
            batchIndex={oirBatchIndex}
            onExitTest={handleExitTest}
          />
        ) : (
          <PsychologyTestRunner
            viewModel={psychViewModel}
            userId="cadet-web-user"
            batchId={activeBatchId}
            onExitTest={handleExitTest}
          />
        )
      ) : (

        <>
          {activeTab === 'home' && (
            <LandingPage
              onStartFreeClick={() => handleStartTest('oir')}
              onStartTestClick={handleStartTest}
            />
          )}
          {activeTab === 'tests' && (
            <PracticeTestsPage
              isPaidMember={isPaidMember}
              userTier={effectiveTier}
              onStartTest={handleStartTest}
              onUpgrade={() => setActiveTab('settings')}
            />
          )}
          {activeTab === 'study' && <StudyMaterialPage />}
          {activeTab === 'settings' && (
            <SettingsPage devTierOverride={devTierOverride} onSelectDevTier={handleSelectDevTier} />
          )}
          {activeTab === 'privacy' && (
            <PrivacyPolicy onBackClick={handleBackToHome} />
          )}
          {activeTab === 'terms' && (
            <TermsAndRefunds onBackClick={handleBackToHome} />
          )}
        </>
      )}
    </AppLayout>
  );
};

export default App;
