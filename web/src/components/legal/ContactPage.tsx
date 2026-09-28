import { FC } from 'react';
import { Mail } from 'lucide-react';
import { strings } from '../../constants/strings';
import { CONTACT_DETAILS } from '../../constants/contact';
import { LegalPageHeader } from './LegalPageHeader';
import { LegalCard } from './LegalCard';

export interface ContactPageProps {
  onBackClick?: () => void;
}

const LINK_CLASS = 'text-sky-400 underline';

export const ContactPage: FC<ContactPageProps> = ({ onBackClick }) => {
  const s = strings.contact;
  return (
    <div className="max-w-4xl mx-auto space-y-6 py-4">
      <LegalPageHeader icon={<Mail className="w-8 h-8" />} title={s.title} subtitle={s.subtitle} testIdPrefix="contact" onBackClick={onBackClick} />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <LegalCard heading={s.emailHeading}>
          <a className={LINK_CLASS} href={`mailto:${CONTACT_DETAILS.email}`}>{CONTACT_DETAILS.email}</a>
        </LegalCard>
        <LegalCard heading={s.responseHeading}>
          <p>{s.responseText}</p>
        </LegalCard>
      </div>
    </div>
  );
};

export default ContactPage;
