import { FC, useState } from 'react';
import { Target, Play, Lock, Search } from 'lucide-react';
import { strings } from '../../constants/strings';

export interface PracticeTestsPageProps {
  isPaidMember?: boolean;
  onStartTest?: (testType: 'oir' | 'ppdt' | 'psychology' | 'tat' | 'wat' | 'srt' | 'sd') => void;
  onUpgrade?: () => void;
}

interface TestItem {
  id: 'oir' | 'ppdt' | 'psychology' | 'tat' | 'wat' | 'srt' | 'sd';
  title: string;
  desc: string;
  stage: 'stage1' | 'stage2' | 'stage3';
  isPro: boolean;
  timeLimit: string;
}

export const PracticeTestsPage: FC<PracticeTestsPageProps> = ({
  isPaidMember = false,
  onStartTest,
  onUpgrade
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  const testList: TestItem[] = [
    { id: 'oir', title: strings.practice.oirTitle, desc: strings.practice.oirDesc, stage: 'stage1', isPro: false, timeLimit: '50 Qs / 30m' },
    { id: 'ppdt', title: strings.practice.ppdtTitle, desc: strings.practice.ppdtDesc, stage: 'stage1', isPro: true, timeLimit: '30s view / 4m write' },
    { id: 'psychology', title: 'Full Psychology Battery', desc: 'Complete TAT, WAT, SRT, and SD in one timed session.', stage: 'stage2', isPro: true, timeLimit: 'Full 4-Test Battery' },
    { id: 'tat', title: strings.practice.tatTitle, desc: strings.practice.tatDesc, stage: 'stage2', isPro: true, timeLimit: '12 Slides / 48m' },
    { id: 'wat', title: strings.practice.watTitle, desc: strings.practice.watDesc, stage: 'stage2', isPro: true, timeLimit: '60 Words / 15m' },
    { id: 'srt', title: strings.practice.srtTitle, desc: strings.practice.srtDesc, stage: 'stage2', isPro: true, timeLimit: '60 Situations / 30m' },
    { id: 'sd', title: strings.practice.sdTitle, desc: strings.practice.sdDesc, stage: 'stage2', isPro: true, timeLimit: '5 Paragraphs / 15m' }
  ];

  const filteredTests = testList.filter(
    (t) =>
      t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.desc.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleAction = (test: TestItem) => {
    if (test.isPro && !isPaidMember) {
      onUpgrade?.();
    } else {
      onStartTest?.(test.id);
    }
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
              className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-sky-500"
              data-testid="search-input"
            />
          </div>
        </div>
      </div>

      {/* Tests Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredTests.map((test) => {
          const isLocked = test.isPro && !isPaidMember;
          return (
            <div
              key={test.id}
              className="bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 rounded-2xl p-5 shadow-md shadow-slate-200/40 dark:shadow-lg flex flex-col justify-between"
              data-testid={`test-card-${test.id}`}
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                    {test.stage.toUpperCase()}
                  </span>
                  {test.isPro ? (
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-500/30">
                      PRO
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
                      FREE
                    </span>
                  )}
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1">{test.title}</h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed mb-4">{test.desc}</p>
              </div>

              <div className="pt-3 border-t border-slate-200 dark:border-slate-700/60 flex items-center justify-between gap-2">
                <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">{test.timeLimit}</span>
                <button
                  onClick={() => handleAction(test)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm ${
                    isLocked
                      ? 'bg-amber-500/10 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 hover:bg-amber-500/20 border border-amber-500/40'
                      : 'bg-sky-600 hover:bg-sky-500 text-white'
                  }`}
                  data-testid={`launch-test-${test.id}`}
                >
                  {isLocked ? (
                    <>
                      <Lock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                      <span>{strings.practice.proRequired}</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5" />
                      <span>{strings.practice.startTest}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default PracticeTestsPage;
