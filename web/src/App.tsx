import { useState, useMemo, FC } from 'react';
import { ArrowLeft } from 'lucide-react';
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
import { SubmissionResultView } from './components/evaluation/SubmissionResultView';
import { OIRSubmissionResultView } from './components/evaluation/OIRSubmissionResultView';
import { useOLQDashboardViewModel } from './viewmodels/useOLQDashboardViewModel';
import { resolveNotificationResultTarget, NotificationResultTarget } from './utils/notificationResultRoute';
import type { SSBMaxNotification } from './types/notification';
import { strings } from './constants/strings';
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
  const [selectedResult, setSelectedResult] = useState<NotificationResultTarget | null>(null);
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


  // Wraps setActiveTab so manually switching tabs (nav bar, Footer, back-to-home)
  // always leaves the notification-triggered single-submission view -- only
  // handleNotificationClick below sets selectedResult.
  const handleTabChange = (tab: string) => {
    setSelectedResult(null);
    setActiveTab(tab);
  };

  const handleNotificationClick = (notification: SSBMaxNotification) => {
    const target = resolveNotificationResultTarget(notification);
    if (!target) return;
    setSelectedResult(target);
    setActiveTab('reports');
  };

  const handleBackToHome = () => {
    handleTabChange('home');
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
    <AppLayout activeTab={activeTab} onTabChange={handleTabChange} onNotificationClick={handleNotificationClick} isTestMode={Boolean(activeTest)}>
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
              onViewPricingClick={() => setActiveTab('tests')}
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
            selectedResult ? (
              <div className="max-w-7xl w-full mx-auto px-4 py-6" data-testid="notification-result-detail">
                <button
                  onClick={() => setSelectedResult(null)}
                  className="mb-4 flex items-center gap-1.5 text-xs font-semibold text-sky-600 dark:text-sky-400 hover:underline"
                  data-testid="notification-result-back-button"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  {strings.common.back}
                </button>
                {selectedResult.kind === 'oir' ? (
                  <OIRSubmissionResultView submissionId={selectedResult.submissionId} />
                ) : (
                  <SubmissionResultView submissionId={selectedResult.submissionId} resultCollection={selectedResult.resultCollection} />
                )}
              </div>
            ) : (
              <AIReportsPage
                userReports={olqDashboard.completedTestsCount > 0 ? { olqScores: olqDashboard.olqScores, dossier: olqDashboard.dossier! } : null}
                isGuest={!authService.getCurrentUser()}
                onSignIn={() => authService.signInWithGoogle()}
                onStartTest={() => handleTabChange('tests')}
              />
            )
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
