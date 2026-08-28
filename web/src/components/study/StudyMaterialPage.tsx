import { FC, useEffect, useState } from 'react';
import { BookOpen, Search, ShieldCheck } from 'lucide-react';
import { strings } from '../../constants/strings';
import { StudyMaterialViewModel } from '../../viewmodels/StudyMaterialViewModel';
import { ContentRepository } from '../../repositories/ContentRepository';
import { StudyMaterial } from '../../types/testContent';
import { StudyReaderModal } from './StudyReaderModal';
import { StudyDayAccordion, StudyDayAccordionSection } from './StudyDayAccordion';
import { authService, UserProfile } from '../../services/AuthService';
import { ssbDayConfigs } from './ssbDayData';
import { filterMaterialsForTestCard } from '../../utils/materialMatcher';

export interface StudyMaterialPageProps {
  viewModel?: StudyMaterialViewModel;
  onSelectMaterial?: (material: StudyMaterial) => void;
  user?: UserProfile | null;
}

export const StudyMaterialPage: FC<StudyMaterialPageProps> = ({
  viewModel,
  onSelectMaterial,
  user: propUser,
}) => {
  const [vm] = useState<StudyMaterialViewModel>(
    () => viewModel || new StudyMaterialViewModel(new ContentRepository())
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMaterial, setSelectedMaterial] = useState<StudyMaterial | null>(null);
  const [, setRefreshState] = useState(0);
  const [materialsLoaded, setMaterialsLoaded] = useState(false);
  const [authUser, setAuthUser] = useState<UserProfile | null>(
    propUser !== undefined ? propUser : authService.getCurrentUser()
  );
  const [expandedDay, setExpandedDay] = useState<string | null>('1');

  useEffect(() => {
    if (propUser !== undefined) {
      setAuthUser(propUser);
      return;
    }
    const unsubscribe = authService.onAuthStateChanged((u) => {
      setAuthUser(u);
    });
    return () => unsubscribe();
  }, [propUser]);

  useEffect(() => {
    let isMounted = true;
    setMaterialsLoaded(false);
    vm.loadMaterials()
      .then(() => {
        if (isMounted) {
          setMaterialsLoaded(true);
          setRefreshState((prev) => prev + 1);
        }
      })
      .catch(() => {
        if (isMounted) {
          setMaterialsLoaded(true);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [vm, authUser]);

  const rawMaterials = vm.getMaterials();

  const handleToggleComplete = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    vm.markAsCompleted(id);
    setRefreshState((prev) => prev + 1);
  };

  const handleSoftCtaSignIn = async () => {
    try {
      await authService.signInWithGoogle();
    } catch {
      // Fallback handled gracefully
    }
  };

  const openMaterial = (material: StudyMaterial) => {
    setSelectedMaterial(material);
    onSelectMaterial?.(material);
  };

  const handleToggleAccordion = (dayNum: string) => {
    setExpandedDay((prev) => (prev === dayNum ? null : dayNum));
  };

  const getMaterialsForTest = (
    testTypeId: string,
    compositeTestTypeIds?: StudyMaterial['testTypeId'][]
  ): StudyMaterial[] => {
    return filterMaterialsForTestCard(rawMaterials, {
      testTypeId: testTypeId as StudyMaterial['testTypeId'],
      compositeTestTypeIds,
      searchQuery,
    });
  };

  const daySections: StudyDayAccordionSection[] = ssbDayConfigs.map((cfg) => ({
    dayNumber: cfg.dayNumber,
    stageBadge: cfg.stageBadge,
    title: cfg.title,
    subtitle: cfg.subtitle,
    testCards: cfg.getTestCards(getMaterialsForTest),
  }));

  return (
    <div className="max-w-7xl w-full mx-auto px-4 py-6 space-y-6 animate-in fade-in duration-300" data-testid="study-material-page">
      {/* Header Banner */}
      <div className="bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 rounded-2xl p-6 shadow-md shadow-slate-200/50 dark:shadow-lg backdrop-blur-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-sky-600 dark:text-sky-400 uppercase tracking-widest mb-1">
              <BookOpen className="w-4 h-4" />
              <span>{strings.nav.study}</span>
            </div>
            <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              {strings.studyMaterial.title}
            </h1>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 max-w-2xl">
              {strings.dashboard.subtitle}
            </p>
          </div>

          <div className="relative w-full md:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search guides & notes..."
              className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-sky-500 min-h-[44px]"
              data-testid="search-materials-input"
            />
          </div>
        </div>
      </div>

      {/* Soft CTA: content is fully public, sign-in only offers progress sync */}
      {!authUser && (
        <div
          className="bg-gradient-to-r from-sky-900/90 to-blue-900/90 border border-sky-500/30 rounded-2xl p-5 text-white flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-lg"
          data-testid="soft-signin-cta-banner"
        >
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-sky-500/20 text-sky-300 border border-sky-400/30">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-black tracking-wide text-white">
                {strings.studyMaterial.softCtaTitle}
              </h3>
              <p className="text-xs text-sky-100/80 leading-relaxed mt-0.5 max-w-xl">
                {strings.studyMaterial.softCtaDesc}
              </p>
            </div>
          </div>

          <button
            onClick={handleSoftCtaSignIn}
            className="px-5 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-white text-xs font-bold transition-all shadow-md shadow-sky-500/20 min-h-[44px] flex items-center justify-center gap-2 whitespace-nowrap"
            data-testid="soft-signin-cta-btn"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>{strings.studyMaterial.signInWithGoogle}</span>
          </button>
        </div>
      )}

      {/* 5-Day SSB Process Vertical Accordion Hub */}
      <div className="space-y-4" data-testid="ssb-day-accordions-container">
        <h2 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
          <span>5-Day SSB Selection Process Modules</span>
        </h2>

        {!materialsLoaded ? (
          <div className="space-y-4" data-testid="study-materials-skeleton">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-28 w-full rounded-2xl bg-slate-200 dark:bg-slate-800/60 animate-pulse border border-slate-200/60 dark:border-slate-700/50"
              />
            ))}
          </div>
        ) : (
          daySections.map((section) => (
            <StudyDayAccordion
              key={section.dayNumber}
              section={section}
              isOpen={expandedDay === section.dayNumber}
              onToggle={handleToggleAccordion}
              onSelectMaterial={openMaterial}
              isMaterialCompleted={(id) => vm.isCompleted(id)}
              onToggleCompleted={handleToggleComplete}
            />
          ))
        )}
      </div>

      {/* Study Reader Modal */}
      <StudyReaderModal
        material={selectedMaterial}
        isOpen={Boolean(selectedMaterial)}
        isCompleted={selectedMaterial ? vm.isCompleted(selectedMaterial.id) : false}
        onClose={() => setSelectedMaterial(null)}
        onToggleCompleted={(id) => handleToggleComplete(id)}
      />
    </div>
  );
};

export default StudyMaterialPage;
