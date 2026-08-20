import { FC, useState, useEffect } from 'react';
import { ShieldAlert, ArrowRight, ArrowLeft, CheckCircle } from 'lucide-react';
import { BaseModal } from '../../common/BaseModal';
import { PIQChipsSelector } from './PIQChipsSelector';
import { strings } from '../../../constants/strings';

export interface PIQData {
  targetBoard: string;
  entryType: string;
  prepStatus: string;
  responsibilities: string;
  sportsActivities: string;
}

export interface PIQWizardContainerProps {
  isOpen: boolean;
  onClose: () => void;
  onSave?: (data: PIQData) => void;
}

const DEFAULT_PIQ: PIQData = {
  targetBoard: 'Indian Army (SSB)',
  entryType: 'NDA',
  prepStatus: 'Beginner',
  responsibilities: 'School Captain / Group Leader',
  sportsActivities: 'Football / Athletics'
};

export const PIQWizardContainer: FC<PIQWizardContainerProps> = ({
  isOpen,
  onClose,
  onSave
}) => {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<PIQData>(() => {
    if (typeof window !== 'undefined') {
      const saved = sessionStorage.getItem('ssbmax_piq_draft');
      if (saved) {
        try { return JSON.parse(saved); } catch (e) { /* ignore */ }
      }
    }
    return DEFAULT_PIQ;
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('ssbmax_piq_draft', JSON.stringify(formData));
    }
  }, [formData]);

  const handleUpdate = (key: keyof PIQData, value: string) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const handleFinish = () => {
    onSave?.(formData);
    onClose();
  };

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title={strings.piq.modalTitle}
      testId="piq-wizard-container"
      ariaLabelledBy="piq-modal-title"
    >
      <div className="space-y-5">
        {/* No PII Security Warning Banner */}
        <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-2.5 text-xs text-amber-700 dark:text-amber-400" data-testid="piq-pii-warning">
          <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
          <p>
            <strong className="font-bold">{strings.piq.privacyGuardLabel}</strong> {strings.piq.privacyGuardText}
          </p>
        </div>

        {/* Step Progress Bar */}
        <div className="flex items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-3 text-xs font-bold text-slate-500">
          <span className={step === 1 ? 'text-sky-600 dark:text-sky-400 font-bold' : ''}>{strings.piq.step1Label}</span>
          <span>→</span>
          <span className={step === 2 ? 'text-sky-600 dark:text-sky-400 font-bold' : ''}>{strings.piq.step2Label}</span>
          <span>→</span>
          <span className={step === 3 ? 'text-sky-600 dark:text-sky-400 font-bold' : ''}>{strings.piq.step3Label}</span>
        </div>

        {/* Step 1: Entry & Board */}
        {step === 1 && (
          <div className="space-y-4">
            <PIQChipsSelector
              label={strings.piq.targetBoardLabel}
              options={[...strings.piq.targetBoardOptions]}
              selectedOption={formData.targetBoard}
              onSelect={(val) => handleUpdate('targetBoard', val)}
            />
            <PIQChipsSelector
              label={strings.piq.entryStreamLabel}
              options={[...strings.piq.entryStreamOptions]}
              selectedOption={formData.entryType}
              onSelect={(val) => handleUpdate('entryType', val)}
            />
            <PIQChipsSelector
              label={strings.piq.prepStatusLabel}
              options={[...strings.piq.prepStatusOptions]}
              selectedOption={formData.prepStatus}
              onSelect={(val) => handleUpdate('prepStatus', val)}
            />
          </div>
        )}

        {/* Step 2: Activities & Responsibilities */}
        {step === 2 && (
          <div className="space-y-4">
            <PIQChipsSelector
              label={strings.piq.responsibilitiesLabel}
              options={[...strings.piq.responsibilitiesOptions]}
              selectedOption={formData.responsibilities}
              onSelect={(val) => handleUpdate('responsibilities', val)}
            />
            <PIQChipsSelector
              label={strings.piq.sportsLabel}
              options={[...strings.piq.sportsOptions]}
              selectedOption={formData.sportsActivities}
              onSelect={(val) => handleUpdate('sportsActivities', val)}
            />
          </div>
        )}

        {/* Step 3: Summary Review */}
        {step === 3 && (
          <div className="space-y-3 bg-slate-50 dark:bg-slate-950/60 p-4 rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
            <h4 className="font-bold text-slate-900 dark:text-white uppercase tracking-wider">{strings.piq.summaryTitle}</h4>
            <div className="grid grid-cols-2 gap-2 text-slate-700 dark:text-slate-300">
              <div><strong>{strings.piq.summaryTargetBoard}</strong> {formData.targetBoard}</div>
              <div><strong>{strings.piq.summaryEntryStream}</strong> {formData.entryType}</div>
              <div><strong>{strings.piq.summaryPrepLevel}</strong> {formData.prepStatus}</div>
              <div><strong>{strings.piq.summaryResponsibilities}</strong> {formData.responsibilities}</div>
              <div><strong>{strings.piq.summarySports}</strong> {formData.sportsActivities}</div>
            </div>
          </div>
        )}

        {/* Navigation Buttons */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-slate-800">
          {step > 1 ? (
            <button
              onClick={() => setStep(step - 1)}
              className="min-h-[44px] min-w-[44px] px-4 py-2 flex items-center gap-1 text-xs font-semibold rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>{strings.common.back}</span>
            </button>
          ) : <div />}

          {step < 3 ? (
            <button
              onClick={() => setStep(step + 1)}
              className="min-h-[44px] min-w-[44px] px-4 py-2 flex items-center gap-1 text-xs font-bold rounded-xl bg-sky-600 text-white"
            >
              <span>{strings.common.next}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleFinish}
              className="min-h-[44px] min-w-[44px] px-4 py-2 flex items-center gap-1.5 text-xs font-bold rounded-xl bg-emerald-600 text-white shadow-sm"
              data-testid="save-piq-button"
            >
              <CheckCircle className="w-4 h-4" />
              <span>{strings.piq.savePiq}</span>
            </button>
          )}
        </div>
      </div>
    </BaseModal>
  );
};

export default PIQWizardContainer;
