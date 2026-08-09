import React, { useState } from 'react';
import { strings } from '../../constants/strings';

export interface OLQRadarItem {
  olq: string;
  score: number; // 0 to 10 scale
  reasoning?: string;
}

export interface InteractiveRadarChartProps {
  scores: OLQRadarItem[];
  benchmarkScore?: number;
  onSelectOLQ?: (olq: OLQRadarItem) => void;
}

const DEFAULT_15_OLQS = [
  'Effective Intelligence',
  'Reasoning Ability',
  'Organizing Ability',
  'Power of Expression',
  'Social Adjustment',
  'Cooperation',
  'Sense of Responsibility',
  'Initiative',
  'Self Confidence',
  'Speed of Decision',
  'Ability to Influence Group',
  'Liveliness',
  'Determination',
  'Courage',
  'Stamina'
];

export const InteractiveRadarChart: React.FC<InteractiveRadarChartProps> = ({
  scores,
  benchmarkScore = 7.0,
  onSelectOLQ
}) => {
  const [selectedOLQIndex, setSelectedOLQIndex] = useState<number | null>(null);

  if (!scores || scores.length === 0) {
    return (
      <div className="p-6 text-center rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] text-[var(--color-text-muted)]">
        {strings.radar.noData}
      </div>
    );
  }

  // Ensure 15 items by mapping or using scores
  const normalizedItems = DEFAULT_15_OLQS.map((name) => {
    const matched = scores.find(
      (s) => s.olq.toLowerCase().replace(/_/g, ' ') === name.toLowerCase()
    );
    return {
      name,
      score: matched ? Math.min(10, Math.max(0, matched.score)) : 0,
      reasoning: matched?.reasoning,
      rawItem: matched
    };
  });

  const numAxes = normalizedItems.length;
  const size = 360;
  const center = size / 2;
  const radius = 130;
  const angleStep = (2 * Math.PI) / numAxes;

  const getCoordinates = (index: number, val: number) => {
    const angle = index * angleStep - Math.PI / 2;
    const r = (val / 10) * radius;
    return {
      x: center + r * Math.cos(angle),
      y: center + r * Math.sin(angle)
    };
  };

  // Generate candidate polygon points
  const candidatePoints = normalizedItems
    .map((item, i) => {
      const { x, y } = getCoordinates(i, item.score);
      return `${x},${y}`;
    })
    .join(' ');

  // Generate benchmark polygon points
  const benchmarkPoints = normalizedItems
    .map((_, i) => {
      const { x, y } = getCoordinates(i, benchmarkScore);
      return `${x},${y}`;
    })
    .join(' ');

  const activeItem = selectedOLQIndex !== null ? normalizedItems[selectedOLQIndex] : null;

  return (
    <div className="w-full space-y-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-6 shadow-sm">
      <div className="border-b border-[var(--color-border)] pb-3">
        <h3 className="text-xl font-bold text-[var(--color-text-primary)]">
          {strings.radar.title}
        </h3>
        <p className="text-sm text-[var(--color-text-secondary)]">
          {strings.radar.subtitle}
        </p>
      </div>

      <div className="flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="relative w-full max-w-[380px] aspect-square flex items-center justify-center">
          <svg viewBox={`0 0 ${size} ${size}`} className="w-full h-full">
            {/* Grid circles / polygons */}
            {[2, 4, 6, 8, 10].map((step) => {
              const pts = normalizedItems
                .map((_, i) => {
                  const { x, y } = getCoordinates(i, step);
                  return `${x},${y}`;
                })
                .join(' ');
              return (
                <polygon
                  key={step}
                  points={pts}
                  fill="none"
                  stroke="var(--color-border)"
                  strokeDasharray={step === 10 ? 'none' : '2,2'}
                  strokeWidth="1"
                />
              );
            })}

            {/* Axes lines */}
            {normalizedItems.map((_, i) => {
              const { x, y } = getCoordinates(i, 10);
              return (
                <line
                  key={i}
                  x1={center}
                  y1={center}
                  x2={x}
                  y2={y}
                  stroke="var(--color-border)"
                  strokeWidth="1"
                />
              );
            })}

            {/* Benchmark polygon */}
            <polygon
              points={benchmarkPoints}
              fill="none"
              stroke="var(--color-warning)"
              strokeWidth="1.5"
              strokeDasharray="4,4"
            />

            {/* Candidate polygon */}
            <polygon
              points={candidatePoints}
              fill="var(--color-accent)"
              fillOpacity="0.25"
              stroke="var(--color-accent)"
              strokeWidth="2.5"
            />

            {/* Points & Interactive Nodes */}
            {normalizedItems.map((item, i) => {
              const { x, y } = getCoordinates(i, item.score);
              const isSelected = selectedOLQIndex === i;
              return (
                <g key={i} className="cursor-pointer" onClick={() => {
                  setSelectedOLQIndex(i);
                  if (item.rawItem && onSelectOLQ) onSelectOLQ(item.rawItem);
                }}>
                  <circle
                    cx={x}
                    cy={y}
                    r={isSelected ? '6' : '4'}
                    fill={isSelected ? 'var(--color-warning)' : 'var(--color-accent)'}
                    stroke="var(--color-bg-card)"
                    strokeWidth="2"
                  />
                </g>
              );
            })}
          </svg>
        </div>

        {/* Legend & Selected OLQ Detail Panel */}
        <div className="flex-1 space-y-4 w-full">
          <div className="flex items-center gap-4 text-xs font-semibold">
            <span className="flex items-center gap-1.5 text-[var(--color-accent)]">
              <span className="w-3 h-3 rounded-full bg-[var(--color-accent)] inline-block" />
              {strings.radar.candidateScore}
            </span>
            <span className="flex items-center gap-1.5 text-[var(--color-warning)]">
              <span className="w-3 h-0.5 bg-[var(--color-warning)] inline-block" />
              {strings.radar.benchmarkLabel}
            </span>
          </div>

          <div className="p-4 rounded-lg bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] min-h-[120px] flex flex-col justify-center">
            {activeItem ? (
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-[var(--color-text-primary)] text-base">
                    {activeItem.name}
                  </span>
                  <span className="text-sm font-extrabold text-[var(--color-accent)]">
                    {activeItem.score.toFixed(1)} / 10
                  </span>
                </div>
                <p className="text-xs text-[var(--color-text-secondary)] mt-1">
                  {activeItem.reasoning || 'Assessment score evaluated based on psychological battery responses.'}
                </p>
              </div>
            ) : (
              <p className="text-xs italic text-[var(--color-text-muted)] text-center">
                {strings.radar.selectOlqHint}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
