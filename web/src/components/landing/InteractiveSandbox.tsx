import { FC, useState } from 'react';
import { Zap, CheckCircle2, AlertCircle, ArrowRight, RefreshCw } from 'lucide-react';
import { strings } from '../../constants/strings';

interface HeuristicResult {
  factorScore: number;
  ratingLabel: string;
  matchedOlqs: string[];
  assessorFeedback: string;
  isOfficerGrade: boolean;
}

export const evaluateResponseLocally = (text: string): HeuristicResult => {
  const lower = text.toLowerCase();
  const officerKeywords = ['took charge', 'delegated', 'immediately', 'planned', 'led', 'organized', 'completed', 'extinguished', 'rescued', 'decided', 'action', 'helped'];
  const matched = officerKeywords.filter((k) => lower.includes(k));

  if (matched.length >= 2 || lower.includes('officer action')) {
    return {
      factorScore: 8.8,
      ratingLabel: 'Factor I & III High Command Output',
      matchedOlqs: ['Initiative (OLQ-6)', 'Speed of Decision (OLQ-8)', 'Organizing Ability (OLQ-3)'],
      assessorFeedback: 'Outstanding Officer Mindset: Immediate initiative, structured delegation, and goal completion.',
      isOfficerGrade: true
    };
  }

  if (matched.length === 1 || lower.includes('standard response') || lower.length > 15) {
    return {
      factorScore: 6.8,
      ratingLabel: 'Factor II Moderate Social Response',
      matchedOlqs: ['Cooperation (OLQ-5)', 'Sense of Duty (OLQ-4)'],
      assessorFeedback: 'Good Cooperative Reaction: Follows procedure, but could demonstrate stronger direct leadership.',
      isOfficerGrade: false
    };
  }

  return {
    factorScore: 5.2,
    ratingLabel: 'Passive Initial Reaction',
    matchedOlqs: ['Requires Proactive Action'],
    assessorFeedback: 'Passive Response: Add explicit personal action verbs (e.g. "immediately organized", "took charge").',
    isOfficerGrade: false
  };
};

export const InteractiveSandbox: FC = () => {
  const [selectedPromptIndex, setSelectedPromptIndex] = useState(0);
  const [responseText, setResponseText] = useState('');
  const [analysis, setAnalysis] = useState<HeuristicResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const prompts = [
    strings.landing.sandboxPrompt1,
    strings.landing.sandboxPrompt2,
    strings.landing.sandboxPrompt3
  ];

  const handleChipClick = (chipText: string) => {
    setResponseText(chipText);
    runAnalysis(chipText);
  };

  const runAnalysis = (textToEvaluate = responseText) => {
    if (!textToEvaluate.trim()) return;
    setIsAnalyzing(true);
    setTimeout(() => {
      const result = evaluateResponseLocally(textToEvaluate);
      setAnalysis(result);
      setIsAnalyzing(false);
    }, 40);
  };

  return (
    <section className="w-full py-12 px-4 bg-slate-900 text-white rounded-3xl border border-slate-800 shadow-2xl overflow-hidden my-8" data-testid="interactive-sandbox">
      <div className="max-w-4xl mx-auto flex flex-col items-center text-center">
        {/* Header Badges */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-500/10 border border-sky-500/30 text-sky-400 text-xs font-bold uppercase tracking-wider mb-4">
          <Zap className="w-3.5 h-3.5 text-amber-400" />
          <span>{strings.landing.instantBadge}</span>
        </div>

        <h2 className="text-2xl md:text-4xl font-black tracking-tight mb-3">{strings.landing.sandboxTitle}</h2>
        <p className="text-sm md:text-base text-slate-300 max-w-2xl mb-8">{strings.landing.sandboxSubtitle}</p>

        {/* Prompt Selector Pills */}
        <div className="w-full flex flex-wrap justify-center gap-2 mb-6" data-testid="prompt-selector-group">
          {prompts.map((_, idx) => (
            <button
              key={idx}
              onClick={() => {
                setSelectedPromptIndex(idx);
                setAnalysis(null);
              }}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                selectedPromptIndex === idx
                  ? 'bg-sky-600 text-white shadow-lg shadow-sky-600/30 border border-sky-400'
                  : 'bg-slate-800 text-slate-400 hover:text-white border border-slate-700'
              }`}
              data-testid={`prompt-pill-${idx}`}
            >
              Situation #{idx + 1}
            </button>
          ))}
        </div>

        {/* Selected Situation Prompt Card */}
        <div className="w-full p-4 rounded-2xl bg-slate-800/80 border border-slate-700 text-left mb-6 shadow-inner" data-testid="active-situation-prompt">
          <span className="text-[10px] font-bold uppercase tracking-widest text-sky-400 block mb-1">Standardized SRT Prompt</span>
          <p className="text-base font-semibold text-slate-100">{prompts[selectedPromptIndex]}</p>
        </div>

        {/* 1-Tap Mobile Preset Action Chips */}
        <div className="w-full text-left mb-4" data-testid="preset-chips-container">
          <span className="text-xs font-bold text-slate-400 block mb-2">⚡ Tap 1-Click Mobile Preset Response:</span>
          <div className="flex flex-col sm:flex-row gap-2.5">
            <button
              onClick={() => handleChipClick(strings.landing.chipOfficer)}
              className="flex-1 p-3 text-left rounded-xl bg-slate-800 hover:bg-slate-700/80 border border-sky-500/40 text-xs font-medium text-sky-200 transition-all active:scale-[0.99]"
              data-testid="chip-officer"
            >
              {strings.landing.chipOfficer}
            </button>
            <button
              onClick={() => handleChipClick(strings.landing.chipAverage)}
              className="flex-1 p-3 text-left rounded-xl bg-slate-800 hover:bg-slate-700/80 border border-slate-700 text-xs font-medium text-slate-300 transition-all active:scale-[0.99]"
              data-testid="chip-average"
            >
              {strings.landing.chipAverage}
            </button>
          </div>
        </div>

        {/* Interactive Text Input & Button */}
        <div className="w-full space-y-3 mb-6">
          <textarea
            value={responseText}
            onChange={(e) => setResponseText(e.target.value)}
            placeholder="Or type custom reaction here..."
            className="w-full p-4 rounded-2xl bg-slate-950 border border-slate-800 text-white text-sm focus:outline-none focus:border-sky-500 transition-colors resize-none h-24"
            data-testid="sandbox-text-input"
          />
          <button
            onClick={() => runAnalysis()}
            disabled={!responseText.trim() || isAnalyzing}
            className="w-full py-3.5 bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 disabled:opacity-50 text-white font-bold text-sm rounded-xl shadow-lg transition-all flex items-center justify-center gap-2"
            data-testid="analyze-olq-btn"
          >
            {isAnalyzing ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>{strings.landing.analyzing}</span>
              </>
            ) : (
              <>
                <span>{strings.landing.analyzeOlqButton}</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>

        {/* Local Heuristic Result Output Card */}
        {analysis && (
          <div className="w-full p-6 rounded-2xl bg-slate-950 border border-sky-500/40 text-left animate-fadeIn shadow-2xl" data-testid="sandbox-result-card">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
              <div className="flex items-center gap-2">
                {analysis.isOfficerGrade ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-amber-400" />
                )}
                <div>
                  <h4 className="text-sm font-bold text-white">{analysis.ratingLabel}</h4>
                  <p className="text-xs text-slate-400">{analysis.assessorFeedback}</p>
                </div>
              </div>
              <div className="text-right">
                <span className="text-xs font-bold text-slate-400 block">Factor Score</span>
                <span className="text-xl font-black text-sky-400">{analysis.factorScore} / 10</span>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <span className="text-xs font-bold text-slate-400 self-center mr-2">Assessed OLQs:</span>
              {analysis.matchedOlqs.map((olq, i) => (
                <span key={i} className="px-2.5 py-1 rounded-md bg-sky-500/20 text-sky-300 border border-sky-500/30 text-[11px] font-bold">
                  {olq}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
};
