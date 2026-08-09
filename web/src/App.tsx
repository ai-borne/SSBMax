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

export const App: FC = () => {
  const { activeTab, setActiveTab } = useTabRouting('home');
  const [activeTest, setActiveTest] = useState<string | null>(null);
  const [isPaidMember] = useState(false);

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
          {activeTab === 'tests' && (
            <PracticeTestsPage
              isPaidMember={isPaidMember}
              onStartTest={handleStartTest}
              onUpgrade={() => setActiveTab('settings')}
            />
          )}
          {activeTab === 'study' && <StudyMaterialPage />}
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
