import { FC, useMemo } from 'react';
import { Clock, CheckCircle, WifiOff } from 'lucide-react';
import { BaseModal } from '../common/BaseModal';
import { strings } from '../../constants/strings';
import { StudyMaterial } from '../../types/testContent';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { renderMarkdown } from '../../utils/renderMarkdown';
import { useStudyMaterialSections } from '../../viewmodels/useStudyMaterialSections';
import { DocumentView } from '../content/DocumentView';
import { ContentRepository } from '../../repositories/ContentRepository';
import { IContentRepository } from '../../repositories/interfaces/IContentRepository';

// Module-level singleton, not `new ContentRepository()` inline as the prop default -- an inline
// default is re-created every render, which would change useStudyMaterialSections' dependency
// and re-trigger the fetch effect on every render.
const defaultContentRepository = new ContentRepository();

export interface StudyReaderModalProps {
  material: StudyMaterial | null;
  isOpen: boolean;
  isCompleted?: boolean;
  onClose: () => void;
  onToggleCompleted?: (id: string) => void;
  /** Injectable for tests, same pattern as StudyMaterialPage's `viewModel` prop -- defaults to
   * a real ContentRepository so callers never need to pass this in production. */
  contentRepository?: IContentRepository;
}

export const StudyReaderModal: FC<StudyReaderModalProps> = ({
  material,
  isOpen,
  isCompleted = false,
  onClose,
  onToggleCompleted,
  contentRepository = defaultContentRepository
}) => {
  const isOnline = useOnlineStatus();
  const sections = useStudyMaterialSections(material?.id, material?.topicType, contentRepository);

  // Content's own headings nest under this modal's <h2> title (BaseModal), so shift by 1.
  // Only needed as a fallback -- once `sections` resolves, DocumentView renders instead (D4:
  // no runtime markdown parsing once structured sections are available).
  const contentHtml = useMemo(
    () => (material && !sections ? renderMarkdown(material.contentMarkdown, 1) : ''),
    [material, sections]
  );

  if (!material) return null;

  const readTime = material.estimatedReadTimeMinutes ?? 5;

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title={material.title}
      testId="study-reader-modal"
      ariaLabelledBy="study-reader-title"
    >
      <div className="space-y-4">
        {/* Top Metadata Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider bg-sky-500/10 text-sky-700 dark:text-sky-400 border border-sky-500/30">
              {material.category}
            </span>
            <span className="flex items-center gap-1 text-xs font-mono text-slate-500 dark:text-slate-400">
              <Clock className="w-3.5 h-3.5" />
              {readTime} min read
            </span>
          </div>

          <div className="flex items-center gap-2">
            {!isOnline && (
              <div className="flex items-center gap-1 text-[11px] font-medium text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-1 rounded border border-amber-500/30">
                <WifiOff className="w-3 h-3" />
                <span>{strings.studyMaterial.offlineNotice}</span>
              </div>
            )}
            {onToggleCompleted && (
              <button
                onClick={() => onToggleCompleted(material.id)}
                className={`min-h-[44px] px-3 py-2 flex items-center gap-1.5 text-xs font-semibold rounded-xl transition-colors ${
                  isCompleted
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
                data-testid={`modal-toggle-completed-${material.id}`}
              >
                <CheckCircle className="w-4 h-4" />
                <span>{isCompleted ? strings.studyMaterial.completed : strings.studyMaterial.markAsRead}</span>
              </button>
            )}
          </div>
        </div>

        {/* Executive Summary */}
        <p className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-white border-l-4 border-sky-500 pl-3 py-2 bg-sky-500/5 rounded-r">
          {material.summary}
        </p>

        {/* D4: no runtime markdown parsing once a study_material_sections side document exists
            for this material -- DocumentView renders the same typed blocks as every other
            surface. Falls back to contentHtml (rendered HTML, see renderMarkdown's doc comment
            on trust) when sections hasn't resolved yet or none is published. */}
        {sections ? (
          <div className="prose dark:prose-invert max-w-none text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
            <DocumentView model={sections} />
          </div>
        ) : (
          <div
            className="prose dark:prose-invert max-w-none text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed"
            dangerouslySetInnerHTML={{ __html: contentHtml }}
          />
        )}
      </div>
    </BaseModal>
  );
};

export default StudyReaderModal;
