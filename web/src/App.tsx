import { useState, useMemo, FC } from 'react';
import { AppLayout } from './components/layout/AppLayout';
import { LandingPage } from './components/landing/LandingPage';
import { HeroSection } from './components/landing/HeroSection';
import { CandidateDashboard } from './components/dashboard/CandidateDashboard';
import { PracticeTestsPage } from './components/practice/PracticeTestsPage';
import { StudyMaterialPage } from './components/study/StudyMaterialPage';
import { AIReportsPage } from './components/reports/AIReportsPage';
import { SubscriptionPage } from './components/subscription/SubscriptionPage';
import { AccountPage } from './components/account/AccountPage';
import { SettingsPage } from './components/settings/SettingsPage';
import { PrivacyPolicy } from './components/legal/PrivacyPolicy';
import { TermsAndRefunds } from './components/legal/TermsAndRefunds';
import { OIRTestRunner } from './components/testRunners/OIRTestRunner';
import { PsychologyTestRunner } from './components/testRunners/PsychologyTestRunner';
import { OIRTestViewModel } from './viewmodels/OIRTestViewModel';
import { PsychologyTestViewModel } from './viewmodels/PsychologyTestViewModel';
import { ContentRepository } from './repositories/ContentRepository';

export const App: FC = () => {
  const [activeTab, setActiveTab] = useState('home');
  const [activeTest, setActiveTest] = useState<string | null>(null);
  const [isPaidMember, setIsPaidMember] = useState(false);
  const [isGuest] = useState(true);

  const repository = useMemo(() => new ContentRepository(), []);
  const oirViewModel = useMemo(() => new OIRTestViewModel(repository), [repository]);
  const psychViewModel = useMemo(
    () => new PsychologyTestViewModel(activeTest === 'ppdt' ? 'PPDT' : 'TAT', repository),
    [repository, activeTest]
  );

  const handleStartTest = (testType: string) => {
    setActiveTest(testType);
  };

  const handleExitTest = () => {
    setActiveTest(null);
  };

  const handleBackToHome = () => {
    setActiveTab('home');
  };

  return (
    <AppLayout activeTab={activeTab} onTabChange={setActiveTab} isTestMode={Boolean(activeTest)}>
      {activeTest ? (
        activeTest === 'oir' ? (
          <OIRTestRunner
            viewModel={oirViewModel}
            userId="cadet-web-user"
            onExitTest={handleExitTest}
          />
        ) : (
          <PsychologyTestRunner
            viewModel={psychViewModel}
            userId="cadet-web-user"
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
          {activeTab === 'dashboard' && (
            <CandidateDashboard
              onLaunchTest={handleStartTest}
              onViewReports={() => setActiveTab('reports')}
            />
          )}
          {activeTab === 'practice' && (
            <PracticeTestsPage
              isPaidMember={isPaidMember}
              onStartTest={handleStartTest}
              onUpgrade={() => setActiveTab('pricing')}
            />
          )}
          {activeTab === 'study' && <StudyMaterialPage />}
          {activeTab === 'reports' && (
            <AIReportsPage
              isGuest={isGuest}
              onSignIn={() => setActiveTab('account')}
              onStartTest={() => handleStartTest('oir')}
            />
          )}
          {activeTab === 'pricing' && (
            <SubscriptionPage
              onPaymentSuccess={() => {
                setIsPaidMember(true);
                setActiveTab('dashboard');
              }}
            />
          )}
          {activeTab === 'account' && (
            <AccountPage onUpgradeClick={() => setActiveTab('pricing')} />
          )}
          {activeTab === 'settings' && <SettingsPage />}
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
