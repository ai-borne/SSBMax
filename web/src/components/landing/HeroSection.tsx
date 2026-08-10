import { FC } from 'react';
import { Shield, Sparkles, ArrowRight, CheckCircle2, Eye, Zap, BarChart, Award } from 'lucide-react';
import { strings } from '../../constants/strings';

export interface HeroSectionProps {
  onStartFreeClick?: () => void;
  onUnlockProClick?: () => void;
  onViewSampleDossierClick?: () => void;
}

export const HeroSection: FC<HeroSectionProps> = ({
  onStartFreeClick,
  onUnlockProClick,
  onViewSampleDossierClick
}) => {
  // Shared className for the three stat cards — DRY (repeated 3×, now SSOT)
  const STAT_CARD_CLS =
    'flex items-center gap-3 p-4 rounded-2xl bg-white dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/60 text-left shadow-md shadow-slate-200/50 dark:shadow-none backdrop-blur-sm hover:-translate-y-1 hover:shadow-lg transition-all duration-200';
  return (
    <section
      className="relative w-full overflow-hidden py-12 md:py-20 flex flex-col items-center text-center border-b border-slate-200/40 dark:border-slate-800/40"
      data-testid="hero-section"
    >
      {/* ── Layer 1: Radial depth gradient (dark = navy bloom, light = subtle sky tint) ── */}
      <div className="absolute inset-0 bg-gradient-to-b from-sky-950/40 via-sky-900/10 to-transparent dark:from-sky-900/30 pointer-events-none" />

      {/* ── Layer 2: Subtle grid pattern overlay — spans full screen edge-to-edge ── */}
      <div className="absolute inset-0 hero-grid-pattern pointer-events-none opacity-70 dark:opacity-100" />

      {/* ── Layer 3: Legacy glow orbs (preserved) ── */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[32rem] h-[32rem] bg-sky-500/15 dark:bg-sky-500/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/3 right-10 w-80 h-80 bg-amber-500/10 dark:bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 max-w-4xl mx-auto px-4 flex flex-col items-center">

        {/* ── Platform Badge — glow shadow added ── */}
        <div
          data-testid="hero-platform-badge"
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800/90 border border-sky-500/30 text-sky-700 dark:text-sky-400 text-xs font-bold tracking-wide uppercase shadow-md shadow-sky-500/20 dark:shadow-sky-950/40 mb-6"
        >
          <Sparkles className="w-4 h-4 text-amber-500 dark:text-amber-400" />
          <span>{strings.landing.heroBadge}</span>
        </div>

        {/* ── Main Headline — "AI" span carries shimmer animation ── */}
        <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight text-slate-900 dark:text-white leading-tight mb-6">
          {strings.landing.heroTitle.split('AI')[0]}
          <span className="animate-shimmer animate-text-shimmer inline-block font-black relative">
            AI
          </span>
        </h1>

        {/* ── Subtitle ── */}
        <p className="text-lg md:text-xl text-slate-600 dark:text-slate-300 max-w-2xl font-normal leading-relaxed mb-6">
          {strings.landing.heroSubtitle}
        </p>

        {/* ── 4-Step Guided Journey Badge ── */}
        <div
          className="inline-flex flex-wrap items-center justify-center gap-2 px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 mb-8"
          data-testid="guided-journey-steps"
        >
          <span className="text-sky-600 dark:text-sky-400">{strings.landing.step1}</span>
          <span className="text-slate-400">➔</span>
          <span className="text-amber-600 dark:text-amber-400">{strings.landing.step2}</span>
          <span className="text-slate-400">➔</span>
          <span className="text-purple-600 dark:text-purple-400">{strings.landing.step3}</span>
          <span className="text-slate-400">➔</span>
          <span className="text-emerald-600 dark:text-emerald-400">{strings.landing.step4}</span>
        </div>

        {/* ── Call-to-Action Buttons ── */}
        <div className="flex flex-col sm:flex-row items-center gap-4 w-full justify-center mb-12">
          {/* Primary CTA — shimmer + overflow-hidden for sweep effect */}
          <button
            onClick={onStartFreeClick}
            className="animate-shimmer relative overflow-hidden w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-4 bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 text-white font-bold text-base rounded-xl shadow-xl shadow-sky-600/20 dark:shadow-sky-900/40 transform hover:-translate-y-0.5 transition-all"
            data-testid="start-free-btn"
          >
            <span>{strings.landing.startFree}</span>
            <ArrowRight className="w-5 h-5" />
          </button>

          {/* Secondary CTA */}
          <button
            onClick={onViewSampleDossierClick ?? onUnlockProClick}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-4 bg-white dark:bg-slate-800/80 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-300/80 dark:border-slate-700 font-bold text-base rounded-xl shadow-md transition-all"
            data-testid="view-sample-dossier-btn"
          >
            <Eye className="w-5 h-5 text-amber-500" />
            <span>{strings.landing.viewSampleDossier}</span>
          </button>

          {/* Pro Upgrade CTA (conditional) */}
          {onUnlockProClick && (
            <button
              onClick={onUnlockProClick}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-4 bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/40 font-bold text-base rounded-xl transition-all"
              data-testid="unlock-pro-btn"
            >
              <Award className="w-5 h-5 text-amber-500" />
              <span>{strings.landing.unlockPro}</span>
            </button>
          )}
        </div>

        {/* ── Key Tactical Stats Grid — hover-lift applied ── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full max-w-3xl">
          <div data-testid="hero-stat-card" className={STAT_CARD_CLS}>
            <div className="p-2.5 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
              <BarChart className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900 dark:text-white">{strings.landing.statOlq}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">{strings.landing.statOlqSub}</p>
            </div>
          </div>

          <div data-testid="hero-stat-card" className={STAT_CARD_CLS}>
            <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900 dark:text-white">{strings.landing.statStage}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">{strings.landing.statStageSub}</p>
            </div>
          </div>

          <div data-testid="hero-stat-card" className={STAT_CARD_CLS}>
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <Zap className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900 dark:text-white">{strings.landing.statAi}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">{strings.landing.statAiSub}</p>
            </div>
          </div>
        </div>

        {/* ── Defence Standards Notice ── */}
        <div className="mt-8 flex items-center justify-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-medium">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          <span>{strings.landing.featureSubtitle}</span>
        </div>

      </div>
    </section>
  );
};

export default HeroSection;
