import { FC, useState } from 'react';
import { ShieldCheck, BarChart3, ChevronDown, ChevronUp, Eye } from 'lucide-react';
import { strings } from '../../constants/strings';
import { themeColors } from '../../constants/colors';

export interface FactorItem {
  id: string;
  name: string;
  score: number;
  benchmark: number;
}

export const SampleDossierPreview: FC = () => {
  const [showDetailed15, setShowDetailed15] = useState(false);

  const coreFactors: FactorItem[] = [
    { id: 'factor1', name: 'Factor I: Planning & Reasoning', score: 8.5, benchmark: 7.0 },
    { id: 'factor2', name: 'Factor II: Social Adjustment', score: 8.0, benchmark: 7.0 },
    { id: 'factor3', name: 'Factor III: Social Effectiveness', score: 8.8, benchmark: 7.0 },
    { id: 'factor4', name: 'Factor IV: Dynamic & Courage', score: 8.2, benchmark: 7.0 }
  ];

  const olq15List = [
    { name: 'Effective Intelligence (OLQ-1)', score: 8.5, factor: 'Factor I' },
    { name: 'Reasoning Ability (OLQ-2)', score: 8.4, factor: 'Factor I' },
    { name: 'Organizing Ability (OLQ-3)', score: 8.6, factor: 'Factor I' },
    { name: 'Power of Expression (OLQ-4)', score: 8.2, factor: 'Factor I' },
    { name: 'Social Adaptability (OLQ-5)', score: 8.1, factor: 'Factor II' },
    { name: 'Cooperation (OLQ-6)', score: 8.0, factor: 'Factor II' },
    { name: 'Sense of Duty (OLQ-7)', score: 8.5, factor: 'Factor II' },
    { name: 'Initiative (OLQ-8)', score: 9.0, factor: 'Factor III' },
    { name: 'Self Confidence (OLQ-9)', score: 8.7, factor: 'Factor III' },
    { name: 'Speed of Decision (OLQ-10)', score: 8.8, factor: 'Factor III' },
    { name: 'Power of Influence (OLQ-11)', score: 8.6, factor: 'Factor III' },
    { name: 'Determination (OLQ-12)', score: 8.7, factor: 'Factor III' },
    { name: 'Liveliness (OLQ-13)', score: 8.2, factor: 'Factor IV' },
    { name: 'Courage (OLQ-14)', score: 8.4, factor: 'Factor IV' },
    { name: 'Stamina (OLQ-15)', score: 8.3, factor: 'Factor IV' }
  ];

  // Inline SVG Radar Math Coordinates (Center 100, 100, Radius 70)
  const cx = 100;
  const cy = 100;
  const r = 70;
  // 4 Axes Angles: Top (0), Right (90), Bottom (180), Left (270)
  const angles = [-Math.PI / 2, 0, Math.PI / 2, Math.PI];

  const getPoint = (val: number, maxVal: number, angle: number) => {
    const dist = (val / maxVal) * r;
    const x = cx + dist * Math.cos(angle);
    const y = cy + dist * Math.sin(angle);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  };

  const candidatePoints = coreFactors
    .map((f, i) => getPoint(f.score, 10, angles[i]))
    .join(' ');

  const benchmarkPoints = coreFactors
    .map((f, i) => getPoint(f.benchmark, 10, angles[i]))
    .join(' ');

  return (
    <section className="w-full py-12 px-4 my-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-xl" data-testid="sample-dossier-preview">
      <div className="max-w-5xl mx-auto flex flex-col items-center">
        {/* Header Badge */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 text-xs font-bold uppercase tracking-wider mb-4">
          <Eye className="w-4 h-4 text-amber-500" />
          <span>OFFICER ASSESSOR DOSSIER PROOF</span>
        </div>

        <h2 className="text-2xl md:text-4xl font-black text-slate-900 dark:text-white tracking-tight text-center mb-3">
          {strings.radar.title}
        </h2>
        <p className="text-sm md:text-base text-slate-600 dark:text-slate-400 max-w-2xl text-center mb-8">
          {strings.radar.subtitle}
        </p>

        {/* 4-Factor Core vs Detailed View Container */}
        <div className="w-full grid grid-cols-1 lg:grid-cols-2 gap-8 items-center mb-8">
          {/* Left: Lightweight Inline SVG Radar Chart */}
          <div className="flex flex-col items-center p-6 bg-slate-50 dark:bg-slate-850 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-inner w-full">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-2">4 SSB Core Factor Radar Polygon</h3>
            
            <svg viewBox="0 0 200 200" className="w-64 h-64 my-2" data-testid="inline-svg-radar">
              {/* Outer & Inner Grid Rings */}
              <circle cx={cx} cy={cy} r={r} fill="none" stroke="currentColor" className="text-slate-300 dark:text-slate-700" strokeWidth="1" strokeDasharray="3 3" />
              <circle cx={cx} cy={cy} r={r * 0.7} fill="none" stroke="currentColor" className="text-slate-300 dark:text-slate-700" strokeWidth="1" strokeDasharray="2 2" />
              <circle cx={cx} cy={cy} r={r * 0.4} fill="none" stroke="currentColor" className="text-slate-300 dark:text-slate-700" strokeWidth="1" strokeDasharray="2 2" />

              {/* Axes Lines */}
              {angles.map((angle, idx) => {
                const ep = getPoint(10, 10, angle);
                const [x2, y2] = ep.split(',');
                return <line key={idx} x1={cx} y1={cy} x2={x2} y2={y2} stroke="currentColor" className="text-slate-300 dark:text-slate-700" strokeWidth="1" />;
              })}

              {/* Baseline Threshold Polygon (Amber) */}
              <polygon points={benchmarkPoints} fill="rgba(245, 158, 11, 0.1)" stroke={themeColors.dark.warning} strokeWidth="1.5" strokeDasharray="4 4" />

              {/* Candidate Score Polygon (Sky Blue) */}
              <polygon points={candidatePoints} fill="rgba(2, 132, 199, 0.3)" stroke={themeColors.dark.accentHover} strokeWidth="2.5" />
            </svg>

            {/* Legend */}
            <div className="flex items-center gap-4 text-xs font-semibold mt-2">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm bg-sky-600 inline-block" />
                <span className="text-slate-700 dark:text-slate-300">{strings.radar.candidateScore} (8.4 Avg)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm bg-amber-500 inline-block" />
                <span className="text-slate-700 dark:text-slate-300">{strings.radar.benchmarkLabel}</span>
              </div>
            </div>
          </div>

          {/* Right: Core Factors List & Expandable Toggle */}
          <div className="flex flex-col gap-4 w-full">
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60">
              <div className="flex justify-between items-center mb-3">
                <h4 className="text-sm font-extrabold text-slate-900 dark:text-white">Assessor Recommendation Overview</h4>
                <span className="px-2.5 py-1 rounded-md text-[10px] font-black bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 uppercase">
                  RECOMMENDED
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed mb-3">
                Candidate exhibits high Factor I & III command output with strong decision speed and group initiative. Recommended for conference probe on minor social adaptability details.
              </p>
            </div>

            {/* Core Factors Progress Bars */}
            <div className="space-y-3">
              {coreFactors.map((factor) => (
                <div key={factor.id} className="space-y-1">
                  <div className="flex justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                    <span>{factor.name}</span>
                    <span className="text-sky-600 dark:text-sky-400">{factor.score} / 10</span>
                  </div>
                  <div className="w-full h-2.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-sky-600 to-blue-500 rounded-full" style={{ width: `${(factor.score / 10) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>

            {/* Interactive Toggle for 15 OLQ Micro Breakdown */}
            <button
              onClick={() => setShowDetailed15(!showDetailed15)}
              className="mt-2 w-full py-2.5 px-4 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center justify-center gap-2 transition-colors border border-slate-300/80 dark:border-slate-700"
              data-testid="toggle-15-olq-btn"
            >
              <BarChart3 className="w-4 h-4 text-sky-600 dark:text-sky-400" />
              <span>{showDetailed15 ? strings.radar.toggleCore : strings.radar.toggleDetailed}</span>
              {showDetailed15 ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* 15 OLQ Detailed Breakdown Card (Collapsible) */}
        {showDetailed15 && (
          <div className="w-full p-6 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 mb-8 animate-fadeIn" data-testid="detailed-15-olq-grid">
            <h4 className="text-sm font-extrabold text-slate-900 dark:text-white mb-4">Complete 15 Officer Like Qualities (OLQ) Micro Scorecard</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {olq15List.map((item, idx) => (
                <div key={idx} className="p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/60 flex items-center justify-between shadow-sm">
                  <div>
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-200">{item.name}</p>
                    <span className="text-[10px] text-slate-500 font-medium">{item.factor}</span>
                  </div>
                  <span className="text-xs font-black text-sky-600 dark:text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded border border-sky-500/20">
                    {item.score}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Side-by-Side Candidate Response Diff Proof */}
        <div className="w-full p-6 rounded-2xl bg-slate-900 text-white border border-slate-800 shadow-xl text-left" data-testid="response-diff-card">
          <div className="flex items-center gap-2 mb-4">
            <ShieldCheck className="w-5 h-5 text-sky-400" />
            <h4 className="text-sm font-bold text-white">Assessor Response Comparison Diff (SRT Sample)</h4>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
              <span className="text-[10px] font-bold text-amber-400 uppercase tracking-widest block mb-1">Average Candidate Response</span>
              <p className="text-slate-300">"He informed the police station and waited for help to arrive."</p>
              <span className="mt-2 inline-block px-2 py-0.5 text-[10px] font-bold bg-amber-500/10 text-amber-400 rounded">Passive (Score: 6.0)</span>
            </div>
            <div className="p-3.5 rounded-xl bg-sky-950/40 border border-sky-500/40">
              <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest block mb-1">Recommended Officer Action</span>
              <p className="text-slate-200 font-medium">"Immediately pulled emergency chain, alerted passengers, organized bucket relay, and safely extinguished fire."</p>
              <span className="mt-2 inline-block px-2 py-0.5 text-[10px] font-bold bg-emerald-500/20 text-emerald-300 rounded">Officer Grade (Score: 9.2)</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
