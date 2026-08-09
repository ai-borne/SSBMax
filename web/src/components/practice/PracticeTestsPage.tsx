import { FC, useState } from 'react';
import { Target, Search, FileText } from 'lucide-react';
import { strings } from '../../constants/strings';
import { TestDayCard, TestDayCardItem } from './TestDayCard';
import { OLQFactorRadarSVG } from './OLQFactorRadarSVG';
import { PIQWizardContainer } from './piq/PIQWizardContainer';
import { ProUpgradeGateModal } from './ProUpgradeGateModal';

export interface PracticeTestsPageProps {
  isPaidMember?: boolean;
  onStartTest?: (testType: 'oir' | 'ppdt' | 'psychology' | 'tat' | 'wat' | 'srt' | 'sd' | 'piq') => void;
  onUpgrade?: () => void;
}

const testList: TestDayCardItem[] = [
  { id: 'oir', title: strings.practice.oirTitle, desc: strings.practice.oirDesc, stage: 'stage1', isPro: false, timeLimit: '50 Qs / 30m' },
  { id: 'ppdt', title: strings.practice.ppdtTitle, desc: strings.practice.ppdtDesc, stage: 'stage1', isPro: true, timeLimit: '30s view / 4m write' },
  { id: 'piq', title: 'Digital PIQ Form Wizard', desc: 'Step-by-step Personal Information Questionnaire with 1-tap preset chips.', stage: 'stage1', isPro: false, timeLimit: '15m Profile Build' },
  { id: 'psychology', title: 'Full Psychology Battery', desc: 'Complete TAT, WAT, SRT, and SD in one timed session.', stage: 'stage2', isPro: true, timeLimit: 'Full 4-Test Battery' },
  { id: 'tat', title: strings.practice.tatTitle, desc: strings.practice.tatDesc, stage: 'stage2', isPro: true, timeLimit: '12 Slides / 48m' },
  { id: 'wat', title: strings.practice.watTitle, desc: strings.practice.watDesc, stage: 'stage2', isPro: true, timeLimit: '60 Words / 15m' },
  { id: 'srt', title: strings.practice.srtTitle, desc: strings.practice.srtDesc, stage: 'stage2', isPro: true, timeLimit: '60 Situations / 30m' },
  { id: 'sd', title: strings.practice.sdTitle, desc: strings.practice.sdDesc, stage: 'stage2', isPro: true, timeLimit: '5 Paragraphs / 15m' }
];

export const PracticeTestsPage: FC<PracticeTestsPageProps> = ({
  isPaidMember = false,
  onStartTest,
  onUpgrade
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [piqOpen, setPiqOpen] = useState(false);
  const [proGateOpen, setProGateOpen] = useState(false);

  const filteredTests = testList.filter(
    (t) =>
      t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.desc.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleLaunch = (testId: string) => {
    if (testId === 'piq') {
      setPiqOpen(true);
    } else {
      onStartTest?.(testId as any);
    }
  };

  const handleUnlockPro = () => {
    setProGateOpen(true);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300" data-testid="practice-tests-page">
      {/* Header Banner */}
      <div className="bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 rounded-2xl p-6 shadow-md shadow-slate-200/50 dark:shadow-lg backdrop-blur-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-sky-600 dark:text-sky-400 uppercase tracking-widest mb-1">
              <Target className="w-4 h-4" />
              <span>{strings.nav.practice}</span>
            </div>
            <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">{strings.practice.title}</h1>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 max-w-2xl">{strings.practice.subtitle}</p>
          </div>

          <div className="relative w-full md:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tests..."
              className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-sky-500 min-h-[44px]"
              data-testid="search-input"
            />
          </div>
        </div>
      </div>

      {/* 15 OLQ Radar Graph Primitive */}
      <OLQFactorRadarSVG />

      {/* Tests Launchers Grid */}
      <div>
        <h2 className="text-lg font-black text-slate-900 dark:text-white mb-3 flex items-center gap-2">
          <FileText className="w-5 h-5 text-sky-600 dark:text-sky-400" />
          <span>Services Selection Board Test Simulators</span>
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTests.map((test) => (
            <TestDayCard
              key={test.id}
              test={test}
              isPaidMember={isPaidMember}
              onLaunch={handleLaunch}
              onUnlockPro={handleUnlockPro}
            />
          ))}
        </div>
      </div>

      {/* Digital PIQ Form Wizard Modal */}
      <PIQWizardContainer
        isOpen={piqOpen}
        onClose={() => setPiqOpen(false)}
      />

      {/* Pro Upgrade Gate Modal */}
      <ProUpgradeGateModal
        isOpen={proGateOpen}
        onClose={() => setProGateOpen(false)}
        onUpgrade={() => onUpgrade?.()}
      />
    </div>
  );
};

export default PracticeTestsPage;
