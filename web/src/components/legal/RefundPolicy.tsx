import { FC } from 'react';
import { RefreshCw } from 'lucide-react';
import { strings } from '../../constants/strings';
import { CONTACT_DETAILS } from '../../constants/contact';
import { LegalPageHeader } from './LegalPageHeader';
import { LegalCard } from './LegalCard';

export interface RefundPolicyProps {
  onBackClick?: () => void;
}

/** Standalone Refund & Cancellation page. Policy wording is reused from Terms and the cancel dialog. */
export const RefundPolicy: FC<RefundPolicyProps> = ({ onBackClick }) => {
  const s = strings.refundPolicy;
  return (
    <div className="max-w-4xl mx-auto space-y-6 py-4">
      <LegalPageHeader icon={<RefreshCw className="w-8 h-8" />} title={s.title} subtitle={s.subtitle} testIdPrefix="refund" onBackClick={onBackClick} />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <LegalCard heading={s.refundHeading}>
          <p>{strings.terms.sec2Text}</p>
        </LegalCard>
        <LegalCard heading={s.cancelHeading}>
          <p>{strings.subscription.cancelConfirmBody}</p>
        </LegalCard>
        <LegalCard heading={s.howHeading}>
          <p>{s.howText}</p>
          <a className="text-sky-400 underline" href={`mailto:${CONTACT_DETAILS.email}`}>{CONTACT_DETAILS.email}</a>
        </LegalCard>
        <LegalCard heading={s.timelineHeading}>
          <p>{s.timelineText}</p>
        </LegalCard>
      </div>
    </div>
  );
};

export default RefundPolicy;
