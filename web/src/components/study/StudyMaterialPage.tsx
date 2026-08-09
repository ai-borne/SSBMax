import { FC, useEffect, useState } from 'react';
import { BookOpen, Clock, CheckCircle, Search, ChevronRight, X } from 'lucide-react';
import { strings } from '../../constants/strings';
import { StudyMaterialViewModel } from '../../viewmodels/StudyMaterialViewModel';
import { ContentRepository } from '../../repositories/ContentRepository';
import { StudyMaterial } from '../../types/testContent';

export interface StudyMaterialPageProps {
  viewModel?: StudyMaterialViewModel;
  onSelectMaterial?: (material: StudyMaterial) => void;
}

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

  const handleToggleComplete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    vm.markAsCompleted(id);
    setRefreshState((prev) => prev + 1);
  };

  const openMaterial = (material: StudyMaterial) => {
    setSelectedMaterial(material);
    onSelectMaterial?.(material);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300" data-testid="study-material-page">
      {/* Header Banner */}
      <div className="bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 rounded-2xl p-6 shadow-md shadow-slate-200/50 dark:shadow-lg backdrop-blur-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-sky-600 dark:text-sky-400 uppercase tracking-widest mb-1">
              <BookOpen className="w-4 h-4" />
              <span>{strings.nav.study}</span>
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
              className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-sky-500"
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
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
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

      {/* Materials List */}
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
                    className={`flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded transition-colors ${
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

      {/* Reader Modal */}
      {selectedMaterial && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4" data-testid="material-modal">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-start justify-between gap-4 bg-slate-50 dark:bg-slate-950/60">
              <div>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-sky-500/10 text-sky-700 dark:text-sky-400 border border-sky-500/30">
                  {selectedMaterial.category}
                </span>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white mt-2">{selectedMaterial.title}</h2>
              </div>
              <button
                onClick={() => setSelectedMaterial(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
                data-testid="close-material-modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto space-y-4 text-slate-700 dark:text-slate-300 text-sm leading-relaxed">
              <p className="font-semibold text-slate-900 dark:text-white border-l-4 border-sky-500 pl-3 py-1 bg-sky-500/5 rounded-r">
                {selectedMaterial.summary}
              </p>
              <div className="prose dark:prose-invert max-w-none text-slate-700 dark:text-slate-300">
                {selectedMaterial.contentMarkdown}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudyMaterialPage;
