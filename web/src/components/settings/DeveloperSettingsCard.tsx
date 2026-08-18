import { FC } from 'react';
import { Wrench, RotateCcw, ShieldOff, Star, Award, Crown, AlertTriangle } from 'lucide-react';
import { strings } from '../../constants/strings';
import { DevTierOverride } from '../../constants/ssbSelectionProcess';
import { GridCardContainer } from '../common/GridCardContainer';

export interface DeveloperSettingsCardProps {
  devTierOverride: DevTierOverride;
  onSelectOverride: (override: DevTierOverride) => void;
}

const OVERRIDE_CHIPS: {
  value: DevTierOverride;
  labelKey: keyof typeof strings.devSettings;
  icon: FC<{ className?: string }>;
}[] = [
  { value: 'FOLLOW_REAL', labelKey: 'realLabel', icon: RotateCcw },
  { value: 'FORCE_FREE', labelKey: 'freeLabel', icon: ShieldOff },
  { value: 'FORCE_BASIC', labelKey: 'basicLabel', icon: Star },
  { value: 'FORCE_PRO', labelKey: 'proLabel', icon: Award },
  { value: 'FORCE_PREMIUM', labelKey: 'premiumLabel', icon: Crown },
];

export const DeveloperSettingsCard: FC<DeveloperSettingsCardProps> = ({
  devTierOverride,
  onSelectOverride,
}) => {
  const isOverrideActive = devTierOverride !== 'FOLLOW_REAL';

  return (
    <GridCardContainer variant="free" testId="dev-settings-card" className="p-6 space-y-4">
      <div className="space-y-1 pb-2 border-b border-slate-200 dark:border-slate-800">
        <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Wrench className="w-5 h-5 text-amber-600 dark:text-amber-400" />
          <span>{strings.devSettings.cardTitle}</span>
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">{strings.devSettings.cardSubtitle}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2" role="group" aria-label={strings.devSettings.cardTitle}>
        {OVERRIDE_CHIPS.map(({ value, labelKey, icon: Icon }) => {
          const isActive = devTierOverride === value;
          return (
            <button
              key={value}
              onClick={() => onSelectOverride(value)}
              aria-pressed={isActive}
              data-testid={`dev-tier-chip-${value}`}
              className={`min-h-[44px] px-4 py-2.5 rounded-xl text-xs font-semibold border transition-all flex items-center gap-2 ${
                isActive
                  ? 'bg-amber-500/15 border-amber-500/50 text-amber-700 dark:text-amber-300'
                  : 'bg-slate-50 dark:bg-slate-950/60 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-900'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{strings.devSettings[labelKey]}</span>
            </button>
          );
        })}
      </div>

      {isOverrideActive && (
        <div
          className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 text-xs flex items-center gap-2.5"
          data-testid="dev-override-active-banner"
        >
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>
            {strings.devSettings.activeOverrideNotice}{' '}
            <strong>{strings.devSettings[OVERRIDE_CHIPS.find((c) => c.value === devTierOverride)!.labelKey]}</strong>
          </span>
        </div>
      )}
    </GridCardContainer>
  );
};

export default DeveloperSettingsCard;
