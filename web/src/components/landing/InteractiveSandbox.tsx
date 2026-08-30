import { FC, useState } from 'react';
import { Zap, CheckCircle2, AlertCircle, ArrowRight, RefreshCw } from 'lucide-react';
import { strings } from '../../constants/strings';
import { evaluateResponseLocally, HeuristicResult } from './evaluateResponseLocally';

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
    <section className="w-full py-12 px-4 bg-white dark:bg-slate-800/90 dark:bg-slate-900 text-slate-900 dark:text-white rounded-3xl border border-slate-200 dark:border-slate-700/80 shadow-md dark:shadow-xl dark:shadow-slate-950/60 overflow-hidden my-8" data-testid="interactive-sandbox">
      <div className="max-w-4xl mx-auto flex flex-col items-center text-center">
        {/* Header Badges */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-500/10 border border-sky-500/30 text-sky-700 dark:text-sky-400 text-xs font-bold uppercase tracking-wider mb-4">
          <Zap className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
          <span>{strings.landing.instantBadge}</span>
        </div>

        <h2 className="text-2xl md:text-4xl font-black tracking-tight mb-3 text-slate-900 dark:text-white">{strings.landing.sandboxTitle}</h2>
        <p className="text-sm md:text-base text-slate-600 dark:text-slate-300 max-w-2xl mb-8">{strings.landing.sandboxSubtitle}</p>

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
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-700'
              }`}
              data-testid={`prompt-pill-${idx}`}
            >
              {strings.landing.sandboxSituationPrefix}{idx + 1}
            </button>
          ))}
        </div>

        {/* Selected Situation Prompt Card */}
        <div className="w-full p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80 text-left mb-6 shadow-sm dark:shadow-xl dark:shadow-slate-950/60" data-testid="active-situation-prompt">
          <span className="text-[10px] font-bold uppercase tracking-widest text-sky-600 dark:text-sky-400 block mb-1">{strings.landing.sandboxSrtPromptHeader}</span>
          <p className="text-base font-semibold text-slate-900 dark:text-slate-100">{prompts[selectedPromptIndex]}</p>
        </div>

        {/* 1-Tap Mobile Preset Action Chips */}
        <div className="w-full text-left mb-4" data-testid="preset-chips-container">
          <span className="text-xs font-bold text-slate-600 dark:text-slate-400 block mb-2">{strings.landing.sandboxPresetHeader}</span>
          <div className="flex flex-col sm:flex-row gap-2.5">
            <button
              onClick={() => handleChipClick(strings.landing.chipOfficer)}
              className="flex-1 p-3 text-left rounded-xl bg-slate-50 dark:bg-slate-800/90 hover:bg-slate-100 dark:hover:bg-slate-700/80 border border-sky-500/40 text-xs font-medium text-sky-700 dark:text-sky-200 transition-all active:scale-[0.99] min-h-[44px]"
              data-testid="chip-officer"
            >
              {strings.landing.chipOfficer}
            </button>
            <button
              onClick={() => handleChipClick(strings.landing.chipAverage)}
              className="flex-1 p-3 text-left rounded-xl bg-slate-50 dark:bg-slate-800/90 hover:bg-slate-100 dark:hover:bg-slate-700/80 border border-slate-200 dark:border-slate-700/80 text-xs font-medium text-slate-700 dark:text-slate-300 transition-all active:scale-[0.99] min-h-[44px]"
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
            placeholder={strings.landing.sandboxCustomPlaceholder}
            className="w-full p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-sky-500 transition-colors resize-none h-24 placeholder:text-slate-400 dark:placeholder:text-slate-500"
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
          <div className="w-full p-6 rounded-2xl bg-slate-50 dark:bg-slate-800/90 border border-sky-500/40 text-left animate-fadeIn shadow-2xl dark:shadow-slate-950/60" data-testid="sandbox-result-card">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4 mb-4">
              <div className="flex items-center gap-2">
                {analysis.isOfficerGrade ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                )}
                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">{analysis.ratingLabel}</h4>
                  <p className="text-xs text-slate-600 dark:text-slate-400">{analysis.assessorFeedback}</p>
                </div>
              </div>
              <div className="text-right">
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 block">{strings.landing.sandboxFactorScoreHeader}</span>
                <span className="text-xl font-black text-sky-600 dark:text-sky-400">{analysis.factorScore} / 10</span>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <span className="text-xs font-bold text-slate-600 dark:text-slate-400 self-center mr-2">{strings.landing.sandboxAssessedOlqsHeader}</span>
              {analysis.matchedOlqs.map((olq, i) => (
                <span key={i} className="px-2.5 py-1 rounded-md bg-sky-500/10 dark:bg-sky-500/20 text-sky-700 dark:text-sky-300 border border-sky-500/30 text-[11px] font-bold">
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

