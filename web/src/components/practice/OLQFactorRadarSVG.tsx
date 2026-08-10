import { FC, useState } from 'react';
import { Shield, Layers, BarChart2 } from 'lucide-react';
import { OLQ, OLQCategory, OLQCategoryValues } from '../../generated/contracts';
import { strings } from '../../constants/strings';

/**
 * Keyed by the generated OLQ id (SCREAMING_SNAKE, matches the wire format the
 * AI evaluation function writes) — see contracts/enums.yaml and
 * docs/plans/CrossPlatform_SSOT §3.4. Do not reintroduce camelCase keys here.
 */
export type OLQScores = Partial<Record<keyof typeof OLQ, number>>;

export interface OLQFactorRadarSVGProps {
  scores?: OLQScores;
  className?: string;
}

const FACTOR_LABELS: Record<OLQCategory, { name: string; code: string }> = {
  INTELLECTUAL: { name: 'Factor I: Planning & Reasoning', code: 'F1' },
  SOCIAL: { name: 'Factor II: Social Adjustment', code: 'F2' },
  DYNAMIC: { name: 'Factor III: Social Effectiveness', code: 'F3' },
  CHARACTER: { name: 'Factor IV: Dynamic & Courage', code: 'F4' },
};

// Sample values shown when no real score is supplied for an OLQ (demo/default state).
const DEFAULT_SCORES: Record<keyof typeof OLQ, number> = {
  EFFECTIVE_INTELLIGENCE: 85,
  REASONING_ABILITY: 80,
  ORGANIZING_ABILITY: 78,
  POWER_OF_EXPRESSION: 82,
  SOCIAL_ADJUSTMENT: 88,
  COOPERATION: 90,
  SENSE_OF_RESPONSIBILITY: 85,
  INITIATIVE: 84,
  SELF_CONFIDENCE: 86,
  SPEED_OF_DECISION: 79,
  INFLUENCE_GROUP: 81,
  LIVELINESS: 83,
  DETERMINATION: 88,
  COURAGE: 87,
  STAMINA: 85,
};

interface FactorGroup {
  category: OLQCategory;
  name: string;
  code: string;
  olqIds: Array<keyof typeof OLQ>;
}

const factorGroups: FactorGroup[] = OLQCategoryValues.map((category) => ({
  category,
  ...FACTOR_LABELS[category],
  olqIds: Object.values(OLQ)
    .filter((def) => def.category === category)
    .map((def) => def.id as keyof typeof OLQ),
}));

export const OLQFactorRadarSVG: FC<OLQFactorRadarSVGProps> = ({ scores = {}, className = '' }) => {
  const [viewMode, setViewMode] = useState<'4factor' | '15olq'>('4factor');

  // Compute Factor Averages
  const factorAverages = factorGroups.map((group) => {
    const total = group.olqIds.reduce((acc, id) => acc + (scores[id] ?? DEFAULT_SCORES[id]), 0);
    return Math.round(total / group.olqIds.length);
  });

  const getPoints = (values: number[], cx: number, cy: number, r: number) => {
    const numPoints = values.length;
    return values
      .map((val, i) => {
        const angle = (Math.PI * 2 * i) / numPoints - Math.PI / 2;
        const radius = (val / 100) * r;
        const x = cx + radius * Math.cos(angle);
        const y = cy + radius * Math.sin(angle);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
  };

  const valuesToRender =
    viewMode === '4factor'
      ? factorAverages
      : factorGroups.flatMap((g) => g.olqIds.map((id) => scores[id] ?? DEFAULT_SCORES[id]));

  const labelsToRender =
    viewMode === '4factor'
      ? factorGroups.map((g) => g.code)
      : factorGroups.flatMap((g) => g.olqIds.map((id) => OLQ[id].displayName.substring(0, 10)));

  const size = 300;
  const cx = size / 2;
  const cy = size / 2;
  const r = 100;
  const polygonPoints = getPoints(valuesToRender, cx, cy, r);

  return (
    <div className={`space-y-4 bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80 rounded-2xl p-5 shadow-sm dark:shadow-xl dark:shadow-slate-950/60 ${className}`} data-testid="olq-radar-svg">
      <div className="flex items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-700/60 pb-3">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-sky-600 dark:text-sky-400" />
          <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
            {strings.radar.factorTitle}
          </h3>
        </div>
        <button
          onClick={() => setViewMode(viewMode === '4factor' ? '15olq' : '4factor')}
          className="min-h-[44px] min-w-[44px] px-3 py-1.5 flex items-center gap-1.5 text-xs font-semibold rounded-xl bg-slate-100 dark:bg-slate-700/60 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600/50 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          data-testid="radar-view-toggle"
        >
          {viewMode === '4factor' ? <Layers className="w-4 h-4 text-sky-500" /> : <BarChart2 className="w-4 h-4 text-sky-500" />}
          <span>{viewMode === '4factor' ? strings.radar.toggleDetailed : strings.radar.toggleCore}</span>
        </button>
      </div>

      {/* Inline SVG Chart Primitive */}
      <div className="flex justify-center py-2">
        <svg viewBox={`0 0 ${size} ${size}`} className="w-full max-w-[280px] h-auto overflow-visible" data-testid="svg-chart-element">
          {/* Concentric grid circles */}
          {[0.25, 0.5, 0.75, 1.0].map((level) => (
            <circle
              key={level}
              cx={cx}
              cy={cy}
              r={r * level}
              fill="none"
              className="stroke-slate-200 dark:stroke-slate-700/80"
              strokeWidth="1"
              strokeDasharray={level < 1.0 ? '3 3' : undefined}
            />
          ))}

          {/* Radial axis lines */}
          {valuesToRender.map((_, i) => {
            const angle = (Math.PI * 2 * i) / valuesToRender.length - Math.PI / 2;
            const x2 = cx + r * Math.cos(angle);
            const y2 = cy + r * Math.sin(angle);
            return (
              <line
                key={i}
                x1={cx}
                y1={cy}
                x2={x2}
                y2={y2}
                className="stroke-slate-200 dark:stroke-slate-700/80"
                strokeWidth="1"
              />
            );
          })}

          {/* Polygon Score Overlay */}
          <polygon
            points={polygonPoints}
            className="fill-sky-500/25 stroke-sky-500"
            strokeWidth="2.5"
            strokeLinejoin="round"
          />

          {/* Axis Labels */}
          {labelsToRender.map((lbl, i) => {
            const angle = (Math.PI * 2 * i) / labelsToRender.length - Math.PI / 2;
            const labelR = r + 18;
            const lx = cx + labelR * Math.cos(angle);
            const ly = cy + labelR * Math.sin(angle);
            return (
              <text
                key={i}
                x={lx}
                y={ly}
                textAnchor="middle"
                dominantBaseline="central"
                className="text-[10px] font-bold fill-slate-700 dark:fill-slate-300 uppercase tracking-tighter"
              >
                {lbl}
              </text>
            );
          })}
        </svg>
      </div>

      {/* 4 Factor Summary Legend */}
      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200 dark:border-slate-700/60">
        {factorGroups.map((g, idx) => (
          <div key={g.code} className="p-2 rounded-xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200/60 dark:border-slate-800 flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-700 dark:text-slate-300">{g.name.split(':')[1] || g.name}</span>
            <span className="font-mono font-bold text-sky-600 dark:text-sky-400">{factorAverages[idx]}%</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default OLQFactorRadarSVG;
