import { FC } from 'react';
import { Lock, FileText, ExternalLink } from 'lucide-react';
import { SSBMaxLogoIcon } from '../common/SSBMaxLogoIcon';
import { strings } from '../../constants/strings';

export interface FooterProps {
  onNavClick?: (tab: string) => void;
}

export const Footer: FC<FooterProps> = ({ onNavClick }) => {
  return (
    <footer className="w-full bg-slate-100 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 py-8 px-4 mt-auto transition-colors">
      <div className="max-w-7xl mx-auto flex flex-col gap-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-center md:text-left border-b border-slate-200 dark:border-slate-800/80 pb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-tr from-sky-600 to-blue-600 text-white shadow-md flex items-center justify-center">
              <SSBMaxLogoIcon className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="text-sm font-bold text-slate-900 dark:text-slate-100 tracking-wide uppercase">{strings.common.appName}</span>
              <span className="text-xs text-slate-500 block">{strings.footer.rights}</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-4 text-xs font-semibold">
            <button
              onClick={() => onNavClick?.('privacy')}
              className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300 hover:text-sky-600 dark:hover:text-sky-400 transition-colors"
              data-testid="footer-link-privacy"
            >
              <Lock className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
              <span>{strings.footer.privacy}</span>
            </button>
            <span className="text-slate-300 dark:text-slate-700">|</span>
            <button
              onClick={() => onNavClick?.('terms')}
              className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300 hover:text-sky-600 dark:hover:text-sky-400 transition-colors"
              data-testid="footer-link-terms"
            >
              <FileText className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
              <span>{strings.footer.terms}</span>
            </button>
            <span className="text-slate-300 dark:text-slate-700">|</span>
            <a
              href="mailto:support@ssbmax.in"
              className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 transition-colors"
              data-testid="footer-link-contact"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>{strings.footer.contact}</span>
            </a>
          </div>
        </div>

        <div className="text-center md:text-left text-xs text-slate-500 space-y-2">
          <p>{strings.footer.disclaimer}</p>
          <p>&copy; {new Date().getFullYear()} {strings.common.appName}. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
