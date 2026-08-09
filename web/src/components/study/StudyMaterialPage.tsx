import { FC, useEffect, useState } from 'react';
import { BookOpen, Search, CheckCircle, Clock, ChevronRight } from 'lucide-react';
import { strings } from '../../constants/strings';
import { StudyMaterialViewModel } from '../../viewmodels/StudyMaterialViewModel';
import { ContentRepository } from '../../repositories/ContentRepository';
import { StudyMaterial } from '../../types/testContent';
import { StudyDayCard, StudyDayInfo } from './StudyDayCard';
import { StudyReaderModal } from './StudyReaderModal';
import { OfflineBadge } from '../common/OfflineBadge';

export interface StudyMaterialPageProps {
  viewModel?: StudyMaterialViewModel;
  onSelectMaterial?: (material: StudyMaterial) => void;
}

const ssbDayModules: StudyDayInfo[] = [
  {
    dayNumber: '1',
    stageBadge: 'Stage I Screening',
    title: 'Day 1: Screening Tests',
    subtitle: 'Officer Intelligence Rating (OIR) Verbal/Non-Verbal & Picture Perception & Discussion Test (PPDT).',
    estimatedMinutes: 25,
    topics: ['OIR Verbal', 'Non-Verbal', 'PPDT Story', 'Group Discussion']
  },
  {
    dayNumber: '2',
    stageBadge: 'Stage II Psychology',
    title: 'Day 2: Psych Battery',
    subtitle: 'Thematic Apperception (TAT), Word Association (WAT), Situation Reaction (SRT), and Self Description (SD).',
    estimatedMinutes: 40,
    topics: ['TAT 12 Slides', 'WAT 60 Words', 'SRT 60 Scenarios', 'SD 5 Paragraphs']
  },
  {
    dayNumber: '3-4',
    stageBadge: 'Stage II Outdoor & IO',
    title: 'Day 3 & 4: GTO & Interview',
    subtitle: 'Group Testing Officer tasks (GD, GPE, PGT, HGT, Command Task) & Personal Interview with President/IO.',
    estimatedMinutes: 35,
    topics: ['Group Discussion', 'GPE Plan', 'Obstacle Course', 'PI Dossier']
  },
  {
    dayNumber: '5',
    stageBadge: 'Stage II Final Board',
    title: 'Day 5: Conference & Medicals',
    subtitle: 'Final Assessor Board Conference, Selection Results announcement, Special Medical Board guidelines.',
    estimatedMinutes: 20,
    topics: ['Board Conference', 'Assessor Review', 'Medical Standards']
  }
];

export const StudyMaterialPage: FC<StudyMaterialPageProps> = ({ viewModel, onSelectMaterial }) => {
  const [vm] = useState<StudyMaterialViewModel>(() => viewModel || new StudyMaterialViewModel(new ContentRepository()));
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedMaterial, setSelectedMaterial] = useState<StudyMaterial | null>(null);
  const [, setRefreshState] = useState(0);

  useEffect(() => {
    vm.loadMaterials().then(() => setRefreshState((prev) => prev + 1));
  }, [vm]);

  const categories = vm.getCategories();
  const rawMaterials = vm.getMaterials();

  const filteredMaterials = rawMaterials.filter((material) => {
    const matchesCategory = selectedCategory === 'All' || material.category.toLowerCase() === selectedCategory.toLowerCase();
    const matchesSearch =
      material.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      material.summary.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const handleCategoryChange = (cat: string) => {
    setSelectedCategory(cat);
    vm.setCategoryFilter(cat);
  };

  const handleToggleComplete = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    vm.markAsCompleted(id);
    setRefreshState((prev) => prev + 1);
  };

  const openMaterial = (material: StudyMaterial) => {
    setSelectedMaterial(material);
    onSelectMaterial?.(material);
  };

  const handleSelectDay = (dayNum: string) => {
    const matched = rawMaterials.find(m => m.category.includes(`Day ${dayNum}`) || m.tags?.includes(`Day ${dayNum}`));
    if (matched) {
      openMaterial(matched);
    } else {
      setSelectedCategory('All');
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300" data-testid="study-material-page">
      {/* Header Banner */}
      <div className="bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 rounded-2xl p-6 shadow-md shadow-slate-200/50 dark:shadow-lg backdrop-blur-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 text-xs font-bold text-sky-600 dark:text-sky-400 uppercase tracking-widest mb-1">
              <div className="flex items-center gap-1.5">
                <BookOpen className="w-4 h-4" />
                <span>{strings.nav.study}</span>
              </div>
              <OfflineBadge />
            </div>
            <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">{strings.studyMaterial.title}</h1>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 max-w-2xl">{strings.dashboard.subtitle}</p>
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

        {/* Category Filters */}
        <div className="flex items-center gap-2 overflow-x-auto mt-6 pt-4 border-t border-slate-200 dark:border-slate-700/60 pb-1">
          {categories.map((cat) => {
            const isActive = selectedCategory.toLowerCase() === cat.toLowerCase();
            return (
              <button
                key={cat}
                onClick={() => handleCategoryChange(cat)}
                className={`min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-sky-600 text-white shadow-sm'
                    : 'bg-slate-100 dark:bg-slate-900/60 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800'
                }`}
                data-testid={`category-tab-${cat.toLowerCase()}`}
              >
                {cat}
              </button>
            );
          })}
        </div>
      </div>

      {/* Day-Wise SSB Study Hub */}
      <div>
        <h2 className="text-lg font-black text-slate-900 dark:text-white mb-3 flex items-center gap-2">
          <span>5-Day SSB Process Modules</span>
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4" data-testid="ssb-day-modules-grid">
          {ssbDayModules.map((dayInfo) => (
            <StudyDayCard key={dayInfo.dayNumber} dayInfo={dayInfo} onSelectDay={handleSelectDay} />
          ))}
        </div>
      </div>

      {/* Study Materials Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredMaterials.map((material) => {
          const isDone = vm.isCompleted(material.id);
          const readTime = material.estimatedReadTimeMinutes ?? 5;
          return (
            <div
              key={material.id}
              onClick={() => openMaterial(material)}
              className="bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 hover:border-sky-500/50 rounded-2xl p-5 shadow-md shadow-slate-200/40 dark:shadow-lg flex flex-col justify-between cursor-pointer transition-all group"
              data-testid={`material-card-${material.id}`}
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-sky-500/10 text-sky-700 dark:text-sky-400 border border-sky-500/30">
                    {material.category}
                  </span>
                  <button
                    onClick={(e) => handleToggleComplete(material.id, e)}
                    className={`min-h-[44px] flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-lg transition-colors ${
                      isDone
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                        : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
                    }`}
                    data-testid={`mark-read-btn-${material.id}`}
                  >
                    <CheckCircle className="w-3.5 h-3.5" />
                    <span>{isDone ? strings.studyMaterial.completed : strings.studyMaterial.markAsRead}</span>
                  </button>
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors mb-1">
                  {material.title}
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed mb-4 line-clamp-2">{material.summary}</p>
              </div>

              <div className="pt-3 border-t border-slate-200 dark:border-slate-700/60 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                <span className="flex items-center gap-1 font-mono">
                  <Clock className="w-3.5 h-3.5" />
                  {readTime}m read
                </span>
                <span className="flex items-center gap-1 font-bold text-sky-600 dark:text-sky-400 group-hover:translate-x-0.5 transition-transform">
                  Read Guide <ChevronRight className="w-4 h-4" />
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Accessible Study Reader Modal */}
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
