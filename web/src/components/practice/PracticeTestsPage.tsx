import { FC, useState } from 'react';
import { Target, Search, Calendar } from 'lucide-react';
import { strings } from '../../constants/strings';
import { SSB_5_DAY_TIMELINE, AccessTier } from '../../constants/ssbSelectionProcess';
import { OLQFactorRadarSVG } from './OLQFactorRadarSVG';
import { PaymentRibbon } from './PaymentRibbon';
import { TestDayAccordion } from './TestDayAccordion';
import { PIQWizardContainer } from './piq/PIQWizardContainer';
import { ProUpgradeGateModal } from './ProUpgradeGateModal';

import { GridCardContainer } from '../common/GridCardContainer';

export interface PracticeTestsPageProps {
  isPaidMember?: boolean;
  userTier?: AccessTier;
  onStartTest?: (testType: string) => void;
  onUpgrade?: (tier?: AccessTier) => void;
}

export const PracticeTestsPage: FC<PracticeTestsPageProps> = ({
  isPaidMember = false,
  userTier: propUserTier,
  onStartTest,
  onUpgrade,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [piqOpen, setPiqOpen] = useState(false);
  const [proGateOpen, setProGateOpen] = useState(false);

  const effectiveTier: AccessTier = propUserTier || (isPaidMember ? 'officer' : 'cadet');

  const handleLaunch = (testId: string) => {
    if (testId === 'piq') {
      setPiqOpen(true);
    } else {
      onStartTest?.(testId);
    }
  };

  const handleUnlockTier = (_tier?: AccessTier) => {
    setProGateOpen(true);
  };

  return (
    <div className="max-w-7xl w-full mx-auto px-4 py-6 space-y-6 animate-in fade-in duration-300" data-testid="practice-tests-page">
      {/* Header Banner */}
      <GridCardContainer variant="glass" className="p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-sky-600 dark:text-sky-400 uppercase tracking-widest mb-1">
              <Target className="w-4 h-4" />
              <span>{strings.nav.practice}</span>
            </div>
            <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              {strings.practice.title}
            </h1>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 max-w-2xl">
              {strings.practice.subtitle}
            </p>
          </div>

          <div className="relative w-full md:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search SSB tests & GTO tasks..."
              className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-sky-500 min-h-[44px]"
              data-testid="search-input"
            />
          </div>
        </div>
      </GridCardContainer>

      {/* 15 OLQ Radar Graph Primitive */}
      <OLQFactorRadarSVG />

      {/* 3-Tier Subscription Payment Ribbon */}
      <PaymentRibbon
        currentTier={effectiveTier}
        onSelectTier={(tier) => {
          if (tier !== effectiveTier) onUpgrade?.(tier);
        }}
        onUpgradeClick={(tier) => {
          onUpgrade?.(tier);
        }}
      />

      {/* Vertical 5-Day SSB Process Accordions */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
            <Calendar className="w-5 h-5 text-sky-600 dark:text-sky-400" />
            <span>Vertical 5-Day SSB Selection Process Simulators</span>
          </h2>
        </div>

        {SSB_5_DAY_TIMELINE.map((day) => (
          <TestDayAccordion
            key={day.dayNumber}
            dayOverview={day}
            userTier={effectiveTier}
            searchQuery={searchQuery}
            onStartTest={handleLaunch}
            onUnlockTier={handleUnlockTier}
          />
        ))}
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
