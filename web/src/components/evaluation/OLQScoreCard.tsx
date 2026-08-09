import type { FC } from 'react';
import { strings } from '../../constants/strings';

export interface OLQScoreItem {
  olq: string;
  score: number;
  reasoning?: string;
  evidence?: string[];
}

export interface OLQScoreCardProps {
  olqScores: OLQScoreItem[];
  overallConfidence?: number;
  keyInsights?: string[];
  suggestedFollowUp?: string;
}

export const OLQScoreCard: FC<OLQScoreCardProps> = ({
  olqScores,
  overallConfidence,
  keyInsights,
  suggestedFollowUp
}) => {
  if (!olqScores || olqScores.length === 0) {
    return (
      <div className="p-6 text-center rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] text-[var(--color-text-muted)]">
        {strings.olq.noScores}
      </div>
    );
  }

  // Factor classification
  const factor1OLQs = ['EFFECTIVE_INTELLIGENCE', 'REASONING_ABILITY', 'ORGANIZING_ABILITY', 'POWER_OF_EXPRESSION'];
  const factor2OLQs = ['SOCIAL_ADJUSTMENT', 'COOPERATION', 'INFLUENCE_GROUP'];
  const factor3OLQs = ['INITIATIVE', 'SELF_CONFIDENCE', 'SPEED_OF_DECISION', 'DETERMINATION'];
  const factor4OLQs = ['COURAGE', 'SENSE_OF_RESPONSIBILITY', 'STAMINA', 'LIVELINESS'];

  const getFactorScores = (olqList: string[]) =>
    olqScores.filter((item) => olqList.includes(item.olq.toUpperCase()));

  const factor1Items = getFactorScores(factor1OLQs);
  const factor2Items = getFactorScores(factor2OLQs);
  const factor3Items = getFactorScores(factor3OLQs);
  const factor4Items = getFactorScores(factor4OLQs);
  const unclassifiedItems = olqScores.filter(
    (item) =>
      !factor1OLQs.includes(item.olq.toUpperCase()) &&
      !factor2OLQs.includes(item.olq.toUpperCase()) &&
      !factor3OLQs.includes(item.olq.toUpperCase()) &&
      !factor4OLQs.includes(item.olq.toUpperCase())
  );

  const renderOLQList = (items: OLQScoreItem[]) => (
    <div className="space-y-3 mt-2">
      {items.map((item) => {
        const scoreText = strings.olq.scoreFormat.replace('{score}', item.score.toString());
        return (
          <div
            key={item.olq}
            className="p-3 rounded-md bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)]"
          >
            <div className="flex justify-between items-center">
              <span className="font-semibold text-[var(--color-text-primary)]">
                {item.olq.replace(/_/g, ' ')}
              </span>
              <span className="text-sm font-bold text-[var(--color-accent)]">
                {scoreText}
              </span>
            </div>
            {item.reasoning && (
              <p className="text-sm mt-1 text-[var(--color-text-secondary)]">
                {item.reasoning}
              </p>
            )}
            {item.evidence && item.evidence.length > 0 && (
              <div className="mt-2 space-y-1">
                {item.evidence.map((ev, idx) => (
                  <p key={idx} className="text-xs italic text-[var(--color-text-muted)] pl-2 border-l-2 border-[var(--color-accent)]">
                    "{ev}"
                  </p>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="w-full space-y-6 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-6 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-[var(--color-border)]">
        <h3 className="text-xl font-bold text-[var(--color-text-primary)]">
          {strings.olq.scoreCardTitle}
        </h3>
        {overallConfidence !== undefined && (
          <span className="mt-2 sm:mt-0 inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-[var(--color-bg-elevated)] text-[var(--color-accent)]">
            {strings.olq.overallConfidence}: {overallConfidence}%
          </span>
        )}
      </div>

      {factor1Items.length > 0 && (
        <section>
          <h4 className="text-md font-bold text-[var(--color-text-primary)]">
            {strings.olq.factor1}
          </h4>
          {renderOLQList(factor1Items)}
        </section>
      )}

      {factor2Items.length > 0 && (
        <section>
          <h4 className="text-md font-bold text-[var(--color-text-primary)]">
            {strings.olq.factor2}
          </h4>
          {renderOLQList(factor2Items)}
        </section>
      )}

      {factor3Items.length > 0 && (
        <section>
          <h4 className="text-md font-bold text-[var(--color-text-primary)]">
            {strings.olq.factor3}
          </h4>
          {renderOLQList(factor3Items)}
        </section>
      )}

      {factor4Items.length > 0 && (
        <section>
          <h4 className="text-md font-bold text-[var(--color-text-primary)]">
            {strings.olq.factor4}
          </h4>
          {renderOLQList(factor4Items)}
        </section>
      )}

      {unclassifiedItems.length > 0 && (
        <section>
          {renderOLQList(unclassifiedItems)}
        </section>
      )}

      {keyInsights && keyInsights.length > 0 && (
        <section className="pt-4 border-t border-[var(--color-border)]">
          <h4 className="text-md font-bold text-[var(--color-text-primary)] mb-2">
            {strings.olq.recommendations}
          </h4>
          <ul className="list-disc pl-5 space-y-1 text-sm text-[var(--color-text-secondary)]">
            {keyInsights.map((insight, idx) => (
              <li key={idx}>{insight}</li>
            ))}
          </ul>
        </section>
      )}

      {suggestedFollowUp && (
        <section className="p-4 rounded-lg bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)]">
          <span className="block text-xs font-bold uppercase tracking-wider text-[var(--color-accent)] mb-1">
            Suggested Probe
          </span>
          <p className="text-sm font-medium text-[var(--color-text-primary)]">
            {suggestedFollowUp}
          </p>
        </section>
      )}
    </div>
  );
};
