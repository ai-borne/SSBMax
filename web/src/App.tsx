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
import { GTOTaskGuideRunner } from './components/testRunners/GTOTaskGuideRunner';
import { AIReportsPage } from './components/reports/AIReportsPage';
import { useOLQDashboardViewModel } from './viewmodels/useOLQDashboardViewModel';
import { OIRTestViewModel } from './viewmodels/OIRTestViewModel';
import { PsychologyTestViewModel, PsychologyTestType } from './viewmodels/PsychologyTestViewModel';
import { ContentRepository } from './repositories/ContentRepository';
import { useTabRouting } from './hooks/useTabRouting';
import { authService } from './services/AuthService';
import { useSubscriptionViewModel } from './viewmodels/SubscriptionViewModel';
import { useAppVersionGateViewModel } from './viewmodels/useAppVersionGateViewModel';
import { UpdateRequiredScreen } from './components/common/UpdateRequiredScreen';
import { AccessTier, DevTierOverride, getEffectiveTier } from './constants/ssbSelectionProcess';

const DEV_TIER_OVERRIDE_KEY = 'ssbmax_dev_tier_override';

export const App: FC = () => {
  const updateRequired = useAppVersionGateViewModel();
  const { activeTab, setActiveTab } = useTabRouting('home');
  const [activeTest, setActiveTest] = useState<string | null>(null);
  const [activeBatchId, setActiveBatchId] = useState<string | undefined>(undefined);
  const [devTierOverride, setDevTierOverride] = useState<DevTierOverride>(
    () => (localStorage.getItem(DEV_TIER_OVERRIDE_KEY) as DevTierOverride | null) || 'FOLLOW_REAL'
  );

  const handleSelectDevTier = (override: DevTierOverride) => {
    setDevTierOverride(override);
    localStorage.setItem(DEV_TIER_OVERRIDE_KEY, override);
  };

  const { tier: realTier, usage } = useSubscriptionViewModel(authService.getCurrentUser()?.uid, devTierOverride);
  const olqDashboard = useOLQDashboardViewModel(authService.getCurrentUser()?.uid, undefined, activeTab === 'reports');
  const isPaidMember = realTier !== 'FREE';
  const effectiveTier: AccessTier = import.meta.env.DEV
    ? getEffectiveTier(devTierOverride, realTier)
    : realTier;

  const repository = useMemo(() => new ContentRepository(), []);
  const oirViewModel = useMemo(() => new OIRTestViewModel(repository), [repository]);
  const psychTestType: PsychologyTestType = (
    activeTest === 'ppdt' ? 'PPDT' :
    activeTest === 'wat' ? 'WAT' :
    activeTest === 'srt' ? 'SRT' :
    activeTest === 'sd' ? 'SD' :
    'TAT'
  );
  const psychViewModel = useMemo(
    () => new PsychologyTestViewModel(psychTestType, repository),
    [repository, psychTestType]
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

  if (updateRequired) {
    return <UpdateRequiredScreen />;
  }

  const isPsychTest = ['ppdt', 'tat', 'wat', 'srt', 'sd'].includes(activeTest || '');
  const isGTOTaskOrBoard = ['gd', 'gpe', 'pgt', 'hgt', 'iot', 'command_task', 'snake_race', 'fgt', 'interview', 'conference'].includes(activeTest || '');

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
        ) : isPsychTest ? (
          <PsychologyTestRunner
            viewModel={psychViewModel}
            userId="cadet-web-user"
            batchId={activeBatchId}
            onExitTest={handleExitTest}
          />
        ) : isGTOTaskOrBoard ? (
          <GTOTaskGuideRunner
            testId={activeTest}
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
              usage={usage}
              onStartTest={handleStartTest}
              onUpgrade={() => setActiveTab('settings')}
            />
          )}
          {activeTab === 'reports' && (
            <AIReportsPage
              userReports={olqDashboard.completedTestsCount > 0 ? { olqScores: olqDashboard.olqScores, dossier: olqDashboard.dossier! } : null}
              isGuest={!authService.getCurrentUser()}
              onSignIn={() => authService.signInWithGoogle()}
              onStartTest={() => setActiveTab('tests')}
            />
          )}
          {activeTab === 'study' && <StudyMaterialPage />}
          {activeTab === 'settings' && (
            <SettingsPage
              userId={authService.getCurrentUser()?.uid}
              isPro={isPaidMember}
              devTierOverride={devTierOverride}
              onSelectDevTier={handleSelectDevTier}
            />
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
