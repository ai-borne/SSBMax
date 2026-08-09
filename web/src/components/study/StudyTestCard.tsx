import { FC } from 'react';
import { Lock, FileText, CheckCircle, Clock, ChevronRight } from 'lucide-react';
import { StudyMaterial } from '../../types/testContent';
import { AccessTier } from '../../constants/ssbSelectionProcess';

export interface SSBTestCardInfo {
  id: string;
  testTypeId: string;
  title: string;
  shortCode: string;
  description: string;
  requiredTier?: AccessTier;
  materials: StudyMaterial[];
}

export interface StudyTestCardProps {
  cardInfo: SSBTestCardInfo;
  isUnlocked: boolean;
  onCardClick: (testTypeId: string) => void;
  onSelectMaterial: (material: StudyMaterial) => void;
  isMaterialCompleted: (materialId: string) => boolean;
  onToggleCompleted: (materialId: string, e: React.MouseEvent) => void;
}

export const StudyTestCard: FC<StudyTestCardProps> = ({
  cardInfo,
  isUnlocked,
  onCardClick,
  onSelectMaterial,
  isMaterialCompleted,
  onToggleCompleted,
}) => {
  const getTierBadgeStyle = () => {
    switch (cardInfo.requiredTier) {
      case 'command':
        return 'bg-amber-500/10 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-500/30';
      case 'officer':
        return 'bg-sky-500/10 dark:bg-sky-500/20 text-sky-700 dark:text-sky-400 border-sky-500/30';
      case 'cadet':
      default:
        return 'bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-500/30';
    }
  };

  const getTierBadgeLabel = () => {
    switch (cardInfo.requiredTier) {
      case 'command':
        return 'COMMAND DOSSIER';
      case 'officer':
        return 'PRO DOSSIER';
      case 'cadet':
      default:
        return 'FREE GUIDE';
    }
  };

  return (
    <div
      onClick={() => onCardClick(cardInfo.testTypeId)}
      className="bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/80 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between group cursor-pointer"
      data-testid={`study-test-card-${cardInfo.testTypeId}`}
    >
      <div>
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-1.5">
            <span className="px-2.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
              {cardInfo.shortCode}
            </span>
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${getTierBadgeStyle()}`}
              data-testid={`tier-badge-${cardInfo.testTypeId}`}
            >
              {getTierBadgeLabel()}
            </span>
          </div>
          {!isUnlocked && (
            <span
              className="flex items-center gap-1 text-[11px] font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/30"
              data-testid={`locked-badge-${cardInfo.testTypeId}`}
            >
              <Lock className="w-3 h-3" />
              <span>Locked</span>
            </span>
          )}
        </div>

        <h4 className="text-base font-bold text-slate-900 dark:text-white group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors mb-1">
          {cardInfo.title}
        </h4>
        <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed mb-4 line-clamp-2">
          {cardInfo.description}
        </p>

        {/* Nested Study Materials List */}
        <div className="space-y-2 mt-3 pt-3 border-t border-slate-200/70 dark:border-slate-700/60">
          <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1">
            <FileText className="w-3.5 h-3.5" />
            <span>Study Guides & Practice Sets ({cardInfo.materials.length})</span>
          </div>

          {cardInfo.materials.length === 0 ? (
            <p className="text-xs text-slate-400 italic">Material coming soon from Firestore</p>
          ) : (
            cardInfo.materials.map((mat) => {
              const isDone = isMaterialCompleted(mat.id);
              return (
                <div
                  key={mat.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!isUnlocked) {
                      onCardClick(cardInfo.testTypeId);
                    } else {
                      onSelectMaterial(mat);
                    }
                  }}
                  className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800 hover:border-sky-500/40 flex items-center justify-between gap-2 transition-all cursor-pointer min-h-[44px]"
                  data-testid={`nested-material-item-${mat.id}`}
                >
                  <div className="min-w-0 flex-1">
                    <h5 className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                      {mat.title}
                    </h5>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono flex items-center gap-1 mt-0.5">
                      <Clock className="w-3 h-3" />
                      {mat.estimatedReadTimeMinutes ?? 5}m read
                    </span>
                  </div>

                  {isUnlocked ? (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={(e) => onToggleCompleted(mat.id, e)}
                        className={`p-1.5 rounded-lg text-[10px] font-bold transition-all min-h-[44px] min-w-[44px] flex items-center justify-center ${
                          isDone
                            ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10'
                            : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
                        }`}
                        title={isDone ? 'Completed' : 'Mark as Read'}
                        data-testid={`toggle-completed-${mat.id}`}
                      >
                        <CheckCircle className="w-4 h-4" />
                      </button>
                      <ChevronRight className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                    </div>
                  ) : (
                    <Lock className="w-3.5 h-3.5 text-amber-500" />
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default StudyTestCard;
