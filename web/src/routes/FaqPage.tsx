import { FC } from 'react';
import { Link } from 'react-router-dom';
import { strings } from '../constants/strings';
import { faqBundle } from '../generated/faqBundle';
import { renderBlock } from '../components/content/blocks/blockRegistry';
import { SITE_BASE_URL } from './contentRoutes';
import { useDocumentMeta } from '../hooks/useDocumentMeta';

/**
 * Public, crawlable FAQ page (Phase 7). Structured per-question rendering (rather than the
 * single markdown blob StudyTopicPage uses) since the build already parses discrete
 * question/answer pairs for the FAQPage JSON-LD -- reusing that structure for the visible
 * markup for free, and it reads better for this content shape than one prose block would.
 */
export const FaqPage: FC = () => {
  useDocumentMeta({
    title: faqBundle.seoTitle,
    description: faqBundle.seoDescription,
    url: `${SITE_BASE_URL}/faq`,
  });

  return (
    <article className="max-w-3xl mx-auto px-4 py-8 sm:py-12">
      <Link to="/" className="text-xs font-semibold text-sky-600 dark:text-sky-400 hover:underline">
        {strings.publicFaq.backToHome}
      </Link>
      <h1 className="mt-4 text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">{faqBundle.title}</h1>

      <div className="mt-8 space-y-8">
        {faqBundle.questions.map((qa) => (
          <div key={qa.question}>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">{qa.question}</h2>
            <div className="mt-2 space-y-2">
              {qa.answerBlocks.map((block, index) => {
                const { Component, block: resolved } = renderBlock(block);
                return <Component key={index} block={resolved} />;
              })}
            </div>
          </div>
        ))}
      </div>
    </article>
  );
};

export default FaqPage;
