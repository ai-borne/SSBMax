import { FC } from 'react';
import { Shield, FileText, Brain, Users, ArrowRight } from 'lucide-react';
import { strings } from '../../constants/strings';

export interface TestGridSectionProps {
  onStartTestClick?: (testId: string) => void;
}

export const TestGridSection: FC<TestGridSectionProps> = ({ onStartTestClick }) => {
  const tests = [
    {
      id: 'oir',
      stage: strings.landing.stage1,
      title: strings.practice.oirTitle,
      desc: strings.practice.oirDesc,
      icon: Shield,
      badge: strings.practice.freeBadge,
      badgeColor: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
    },
    {
      id: 'ppdt',
      stage: strings.landing.stage1,
      title: strings.practice.ppdtTitle,
      desc: strings.practice.ppdtDesc,
      icon: FileText,
      badge: strings.practice.proBadge,
      badgeColor: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30'
    },
    {
      id: 'tat',
      stage: strings.landing.stage2,
      title: strings.practice.tatTitle,
      desc: strings.practice.tatDesc,
      icon: Brain,
      badge: strings.practice.proBadge,
      badgeColor: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30'
    },
    {
      id: 'wat',
      stage: strings.landing.stage2,
      title: strings.practice.watTitle,
      desc: strings.practice.watDesc,
      icon: Brain,
      badge: strings.practice.proBadge,
      badgeColor: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30'
    },
    {
      id: 'srt',
      stage: strings.landing.stage2,
      title: strings.practice.srtTitle,
      desc: strings.practice.srtDesc,
      icon: Brain,
      badge: strings.practice.proBadge,
      badgeColor: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30'
    },
    {
      id: 'sd',
      stage: strings.landing.stage2,
      title: strings.practice.sdTitle,
      desc: strings.practice.sdDesc,
      icon: Users,
      badge: strings.practice.proBadge,
      badgeColor: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30'
    }
  ];

  return (
    <section className="w-full py-12 px-4 my-8" data-testid="test-grid-section">
      <div className="max-w-6xl mx-auto flex flex-col items-center">
        {/* Section Header */}
        <div className="text-center max-w-3xl mb-10">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/30 text-xs font-bold uppercase tracking-wider mb-4">
            <Shield className="w-4 h-4 text-sky-600 dark:text-sky-400" />
            <span>{strings.landing.gridBadge}</span>
          </div>
          <h2 className="text-2xl md:text-4xl font-black text-slate-900 dark:text-white tracking-tight mb-3">
            {strings.landing.featureTitle}
          </h2>
          <p className="text-sm md:text-base text-slate-600 dark:text-slate-400">
            {strings.landing.featureSubtitle}
          </p>
        </div>

        {/* 6-Card Test Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full mb-8">
          {tests.map((t) => {
            const Icon = t.icon;
            return (
              <div
                key={t.id}
                className="p-6 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-800 shadow-md hover:shadow-xl transition-all flex flex-col justify-between group"
                data-testid={`grid-card-${t.id}`}
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="p-2.5 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20 group-hover:scale-105 transition-transform">
                      <Icon className="w-5 h-5" />
                    </div>
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase border ${t.badgeColor}`}>
                      {t.badge}
                    </span>
                  </div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">{t.stage}</span>
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white mb-2">{t.title}</h3>
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed mb-6">{t.desc}</p>
                </div>

                <button
                  onClick={() => onStartTestClick?.(t.id)}
                  className="w-full py-2.5 px-4 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-sky-600 hover:text-white dark:hover:bg-sky-600 text-slate-800 dark:text-slate-200 text-xs font-bold flex items-center justify-center gap-2 transition-all"
                  data-testid={`start-btn-${t.id}`}
                >
                  <span>{strings.practice.startTest}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
