import { FC } from 'react';
import { Link } from 'react-router-dom';
import { strings } from '../constants/strings';
import { contentBundle, ContentBundleTopicId } from '../generated/contentBundle';
import { DocumentView } from '../components/content/DocumentView';
import { CONTENT_ROUTES, SITE_BASE_URL } from './contentRoutes';
import { CONTENT_SEO } from './contentSeo';
import { useDocumentMeta } from '../hooks/useDocumentMeta';

export interface StudyTopicPageProps {
  topicId: ContentBundleTopicId;
}

/**
 * Public, crawlable content page for one topic (Phase 2). Reads the build-time
 * content bundle synchronously -- no Firestore fetch, no loading state, so there is no
 * async gap for React to hydrate over (Blocker 2). Phase 5 replaces the rendering here
 * with genuinely static, non-hydrated HTML; this component is what it will render from.
 */
export const StudyTopicPage: FC<StudyTopicPageProps> = ({ topicId }) => {
  const topic = contentBundle[topicId];
  const seo = CONTENT_SEO[topicId];
  const path = CONTENT_ROUTES.find((r) => r.topicId === topicId)?.path ?? '';

  useDocumentMeta({
    title: topic && seo ? seo.title : strings.contentTopic.notFound,
    description: topic && seo ? seo.description : strings.contentTopic.notFound,
    url: `${SITE_BASE_URL}${path}`,
  });

  if (!topic) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12">
        <p className="text-sm text-slate-600 dark:text-slate-400">{strings.contentTopic.notFound}</p>
        <Link to="/" className="text-sky-600 dark:text-sky-400 hover:underline text-sm">
          {strings.contentTopic.backToHome}
        </Link>
      </div>
    );
  }

  return (
    <article className="max-w-3xl mx-auto px-4 py-8 sm:py-12">
      <Link to="/" className="text-xs font-semibold text-sky-600 dark:text-sky-400 hover:underline">
        {strings.contentTopic.backToHome}
      </Link>
      <h1 className="mt-4 text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">{topic.title}</h1>
      <div className="mt-4">
        <DocumentView model={topic.introductionSections} />
      </div>

      {topic.materials.length > 0 && (
        <section className="mt-10">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">{strings.contentTopic.materialsHeading}</h2>
          <div className="mt-4 space-y-8">
            {topic.materials.map((material) => (
              <div key={material.id} data-testid={`content-material-${material.id}`}>
                <h3 className="text-base font-semibold text-slate-900 dark:text-white">{material.title}</h3>
                <p className="text-xs font-mono text-slate-500 dark:text-slate-400">
                  {material.estimatedReadTimeMinutes} {strings.contentTopic.minRead}
                </p>
                <div className="mt-2">
                  <DocumentView model={material.sections} />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </article>
  );
};

export default StudyTopicPage;
