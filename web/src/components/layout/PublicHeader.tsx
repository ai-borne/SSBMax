import { FC, useState } from 'react';
import { ShieldCheck, Menu, X, Sun, Moon, Monitor, Download, ArrowRight } from 'lucide-react';
import { strings } from '../../constants/strings';

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export interface PublicHeaderProps {
  activeTab: string;
  onNavClick: (tabId: string) => void;
  theme: string;
  toggleTheme: () => void;
  deferredPrompt: BeforeInstallPromptEvent | null;
  onInstallClick: () => void;
  onSignInClick?: () => void;
}

export const PublicHeader: FC<PublicHeaderProps> = ({
  onNavClick,
  theme,
  toggleTheme,
  deferredPrompt,
  onInstallClick,
  onSignInClick
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLinkClick = (tabId: string) => {
    onNavClick(tabId);
    setMobileMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-50 w-full h-16 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-4 flex items-center shadow-sm" data-testid="public-header">
      <div className="max-w-7xl w-full mx-auto flex items-center justify-between">
        {/* Brand Logo & Title */}
        <div className="flex items-center gap-3 cursor-pointer group" onClick={() => handleLinkClick('home')} data-testid="public-brand-logo">
          <div className="p-2 rounded-xl bg-gradient-to-tr from-sky-600 to-blue-600 text-white shadow-md shadow-sky-600/20 group-hover:scale-105 transition-transform">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <span className="text-base font-black tracking-wider text-slate-900 dark:text-white uppercase">{strings.header.title}</span>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">{strings.header.tagline}</p>
          </div>
        </div>

        {/* Public Streamlined Links */}
        <nav className="hidden md:flex items-center gap-6">
          <button onClick={() => handleLinkClick('home')} className="text-xs font-bold text-slate-700 dark:text-slate-300 hover:text-sky-600 dark:hover:text-sky-400 transition-colors" data-testid="public-nav-home">
            {strings.nav.landing}
          </button>
          <button onClick={() => handleLinkClick('study')} className="text-xs font-bold text-slate-700 dark:text-slate-300 hover:text-sky-600 dark:hover:text-sky-400 transition-colors" data-testid="public-nav-study">
            {strings.nav.study}
          </button>
          <button onClick={() => handleLinkClick('tests')} className="text-xs font-bold text-slate-700 dark:text-slate-300 hover:text-sky-600 dark:hover:text-sky-400 transition-colors" data-testid="public-nav-tests">
            {strings.nav.tests}
          </button>
          <button onClick={() => handleLinkClick('settings')} className="text-xs font-bold text-slate-700 dark:text-slate-300 hover:text-sky-600 dark:hover:text-sky-400 transition-colors" data-testid="public-nav-settings">
            {strings.nav.settings}
          </button>
          <button onClick={() => handleLinkClick('tests')} className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold bg-sky-600 text-white hover:bg-sky-500 shadow-sm transition-colors" data-testid="public-cta-start-free">
            <span>{strings.landing.startFree}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </nav>

        {/* Controls & Sign In */}
        <div className="flex items-center gap-2">
          {deferredPrompt && (
            <button onClick={onInstallClick} className="p-2 text-xs font-bold bg-sky-600 text-white rounded-lg shadow-sm" title={strings.header.installPwa} data-testid="public-pwa-button">
              <Download className="w-4 h-4" />
            </button>
          )}

          <button onClick={toggleTheme} className="p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors" aria-label="Toggle theme" data-testid="public-theme-button">
            {theme === 'dark' ? <Moon className="w-4 h-4 text-sky-400" /> : theme === 'light' ? <Sun className="w-4 h-4 text-amber-500" /> : <Monitor className="w-4 h-4 text-emerald-500" />}
          </button>

          <button onClick={onSignInClick} className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-white transition-colors" data-testid="public-sign-in-button">
            {strings.header.signIn}
          </button>

          <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="md:hidden p-2 text-slate-600 dark:text-slate-300" aria-label="Toggle menu" data-testid="public-mobile-button">
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {mobileMenuOpen && (
        <div className="absolute top-16 left-0 w-full bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 p-4 flex flex-col gap-3 shadow-lg md:hidden" data-testid="public-mobile-menu">
          <button onClick={() => handleLinkClick('home')} className="text-left text-sm font-bold text-slate-800 dark:text-slate-200 py-1" data-testid="public-mobile-home">{strings.nav.landing}</button>
          <button onClick={() => handleLinkClick('study')} className="text-left text-sm font-bold text-slate-800 dark:text-slate-200 py-1" data-testid="public-mobile-study">{strings.nav.study}</button>
          <button onClick={() => handleLinkClick('tests')} className="text-left text-sm font-bold text-slate-800 dark:text-slate-200 py-1" data-testid="public-mobile-tests">{strings.nav.tests}</button>
          <button onClick={() => handleLinkClick('settings')} className="text-left text-sm font-bold text-slate-800 dark:text-slate-200 py-1" data-testid="public-mobile-settings">{strings.nav.settings}</button>
          <button onClick={() => handleLinkClick('tests')} className="w-full py-2 bg-sky-600 text-white rounded-lg font-bold text-xs flex items-center justify-center gap-1.5" data-testid="public-mobile-start-free">{strings.landing.startFree}</button>
        </div>
      )}
    </header>
  );
};
