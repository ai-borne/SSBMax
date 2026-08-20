import { FC, useState } from 'react';
import { HelpCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { strings } from '../../constants/strings';

export const FAQSection: FC = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const faqs = [
    { q: strings.faq.q1, a: strings.faq.a1 },
    { q: strings.faq.q2, a: strings.faq.a2 },
    { q: strings.faq.q3, a: strings.faq.a3 },
    { q: strings.faq.q4, a: strings.faq.a4 },
    { q: strings.faq.q5, a: strings.faq.a5 }
  ];

  const toggleFaq = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <div className="p-6 rounded-2xl bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80 shadow-md dark:shadow-xl dark:shadow-slate-950/60 space-y-4" data-testid="faq-section">
      <div className="space-y-1 pb-3 border-b border-slate-200 dark:border-slate-800">
        <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <HelpCircle className="w-5 h-5 text-sky-600 dark:text-sky-400" />
          <span>{strings.faq.title}</span>
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">{strings.faq.subtitle}</p>
      </div>

      <div className="space-y-2.5">
        {faqs.map((faq, index) => {
          const isOpen = openIndex === index;
          return (
            <div
              key={index}
              className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/80 overflow-hidden transition-all"
              data-testid={`faq-item-${index}`}
            >
              <button
                onClick={() => toggleFaq(index)}
                aria-expanded={isOpen}
                aria-controls={`faq-answer-${index}`}
                className="w-full min-h-[44px] px-4 py-3 text-left flex items-center justify-between gap-3 text-xs font-semibold text-slate-900 dark:text-slate-100 hover:text-sky-600 dark:hover:text-sky-400 transition-colors"
                data-testid={`faq-trigger-${index}`}
              >
                <span>{faq.q}</span>
                {isOpen ? (
                  <ChevronUp className="w-4 h-4 text-sky-500 shrink-0" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                )}
              </button>
              {isOpen && (
                <div
                  id={`faq-answer-${index}`}
                  className="px-4 pb-3.5 pt-1 text-xs text-slate-600 dark:text-slate-300 border-t border-slate-200/60 dark:border-slate-800/60 leading-relaxed"
                  data-testid={`faq-answer-${index}`}
                >
                  {faq.a}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default FAQSection;
