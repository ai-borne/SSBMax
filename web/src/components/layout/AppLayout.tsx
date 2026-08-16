import { FC, ReactNode, useState, useEffect } from 'react';
import { Menu, X, Sun, Moon, Monitor, Wifi, WifiOff, FileText, BookOpen, Settings, Download, LogIn } from 'lucide-react';
import { SSBMaxLogoIcon } from '../common/SSBMaxLogoIcon';
import { authService, UserProfile } from '../../services/AuthService';
import { strings } from '../../constants/strings';
import { useTheme } from '../../hooks/useTheme';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { Footer } from '../legal/Footer';
import { NotificationBell } from '../notifications/NotificationBell';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export interface AppLayoutProps {
  children: ReactNode;
  activeTab?: string;
  onTabChange?: (tab: string) => void;
  isTestMode?: boolean;
  user?: UserProfile | null;
  onSignInClick?: () => void;
}

export const AppLayout: FC<AppLayoutProps> = ({
  children,
  activeTab = 'home',
  onTabChange,
  isTestMode = false,
  user: propUser,
  onSignInClick
}) => {
  const { theme, toggleTheme } = useTheme();
  const isOnline = useOnlineStatus();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [authUser, setAuthUser] = useState<UserProfile | null>(propUser !== undefined ? propUser : authService.getCurrentUser());
  const [authInitializing, setAuthInitializing] = useState<boolean>(false);

  useEffect(() => {
    if (propUser !== undefined) {
      setAuthUser(propUser);
      return;
    }
    const unsubscribe = authService.onAuthStateChanged((user) => {
      setAuthUser(user);
      setAuthInitializing(false);
    });
    return () => unsubscribe();
  }, [propUser]);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const choiceResult = await deferredPrompt.userChoice;
    if (choiceResult.outcome === 'accepted') setDeferredPrompt(null);
  };

  const navItems = [
    { id: 'home', label: strings.nav.landing, icon: SSBMaxLogoIcon },
    { id: 'study', label: strings.nav.study, icon: BookOpen },
    { id: 'tests', label: strings.nav.tests, icon: FileText },
    { id: 'settings', label: strings.nav.settings, icon: Settings }
  ];

  const handleNavClick = (tabId: string) => {
    onTabChange?.(tabId);
    setMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 flex flex-col font-sans selection:bg-sky-500 selection:text-white transition-colors duration-200 overflow-x-hidden relative">
      {/* ── Full-Page Ambient Radial Depth Gradient ── */}
      <div className="fixed inset-0 bg-gradient-to-b from-sky-950/20 via-sky-900/5 to-transparent dark:from-sky-900/30 pointer-events-none z-0" />

      {/* ── Full-Page Subtle Chequered Grid Pattern Overlay (Edge-to-Edge) ── */}
      <div className="fixed inset-0 ssb-grid-pattern pointer-events-none opacity-50 dark:opacity-75 z-0" />

      {!isTestMode && (
        <div className="sticky top-0 z-50 w-full h-16 min-h-[64px]" data-testid="header-container">
          {authInitializing ? (
            <div className="w-full h-16 bg-white/90 dark:bg-slate-900/90 border-b border-slate-200 dark:border-slate-800 px-4 flex items-center justify-between animate-pulse" data-testid="header-skeleton">
              <div className="h-8 w-32 bg-slate-200 dark:bg-slate-800 rounded-lg" />
              <div className="h-8 w-64 bg-slate-200 dark:bg-slate-800 rounded-lg hidden md:block" />
              <div className="h-8 w-24 bg-slate-200 dark:bg-slate-800 rounded-lg" />
            </div>
          ) : (
            <header className="w-full h-16 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-4 flex items-center shadow-sm" data-testid="command-header">
              <div className="max-w-7xl w-full mx-auto flex items-center justify-between relative">
                {/* Brand Logo & Title */}
                <div className="flex items-center gap-3 cursor-pointer group" onClick={() => handleNavClick('home')} data-testid="brand-logo">
                  <div className="p-2 rounded-xl bg-gradient-to-tr from-sky-600 to-blue-600 text-white shadow-md shadow-sky-600/20 group-hover:scale-105 transition-transform flex items-center justify-center">
                    <SSBMaxLogoIcon className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-base font-black tracking-wider text-slate-900 dark:text-white uppercase">{strings.header.title}</span>
                      {authUser?.isPaidMember && (
                        <span className="px-1.5 py-0.5 text-[10px] font-bold bg-amber-500/10 text-amber-600 border border-amber-500/30 rounded uppercase tracking-widest" data-testid="pro-membership-badge">
                          PRO
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">{strings.header.tagline}</p>
                  </div>
                </div>

                {/* Unified Pill Segmented Control Navigation Bar (Mathematically Centered) */}
                <nav className="hidden md:flex items-center gap-1 bg-slate-100 dark:bg-slate-800/60 p-1 rounded-xl border border-slate-200 dark:border-slate-700/50 absolute left-1/2 -translate-x-1/2" data-testid="unified-pill-nav">
                  {navItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeTab === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => handleNavClick(item.id)}
                        className={`min-h-[44px] flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                          isActive
                            ? 'bg-gradient-to-r from-sky-600 to-blue-600 text-white shadow-md shadow-sky-600/25 font-bold'
                            : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-700/50'
                        }`}
                        data-testid={`nav-item-${item.id}`}
                      >
                        <Icon className="w-4 h-4" />
                        <span>{item.label}</span>
                      </button>
                    );
                  })}
                </nav>

                {/* Status Controls & Action Buttons */}
                <div className="flex items-center gap-2">
                  <div className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border ${isOnline ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30' : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30'}`} data-testid="online-status-badge">
                    {isOnline ? <Wifi className="w-3.5 h-3.5 text-emerald-500" /> : <WifiOff className="w-3.5 h-3.5 text-amber-500" />}
                    <span>{isOnline ? strings.header.statusOnline : strings.header.statusOffline}</span>
                  </div>

                  {deferredPrompt && (
                    <button
                      onClick={handleInstallClick}
                      className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
                      aria-label={strings.header.installPwa}
                      title={strings.header.installPwa}
                      data-testid="pwa-install-button"
                    >
                      <Download className="w-4 h-4 text-sky-500 dark:text-sky-400" />
                    </button>
                  )}

                  <button onClick={toggleTheme} className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors" aria-label="Toggle theme" data-testid="theme-toggle-button">
                    {theme === 'dark' ? <Moon className="w-4 h-4 text-sky-400" /> : theme === 'light' ? <Sun className="w-4 h-4 text-amber-500" /> : <Monitor className="w-4 h-4 text-emerald-500" />}
                  </button>

                  <NotificationBell userId={authUser?.uid} />

                  {!authUser && (
                    <button onClick={onSignInClick} className="min-h-[44px] px-4 rounded-xl text-xs font-bold bg-sky-600 hover:bg-sky-500 text-white shadow-sm transition-colors flex items-center gap-1.5" data-testid="sign-in-cta-button">
                      <LogIn className="w-3.5 h-3.5" />
                      <span>{strings.header.signIn}</span>
                    </button>
                  )}

                  <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="md:hidden min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-600 dark:text-slate-300" aria-label="Toggle menu" data-testid="mobile-menu-button">
                    {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {/* Mobile Drawer Menu */}
              {mobileMenuOpen && (
                <div className="absolute top-16 left-0 w-full bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 p-4 flex flex-col gap-2 shadow-lg md:hidden" data-testid="mobile-menu-drawer">
                  {navItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeTab === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => handleNavClick(item.id)}
                        className={`min-h-[44px] flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all ${isActive ? 'bg-sky-600 text-white font-bold' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                      >
                        <Icon className="w-4 h-4" />
                        <span>{item.label}</span>
                      </button>
                    );
                  })}
                  {!authUser && (
                    <button
                      onClick={() => {
                        setMobileMenuOpen(false);
                        onSignInClick?.();
                      }}
                      className="min-h-[44px] w-full bg-sky-600 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 mt-1"
                    >
                      <LogIn className="w-4 h-4" />
                      <span>{strings.header.signIn}</span>
                    </button>
                  )}
                </div>
              )}
            </header>
          )}
        </div>
      )}

      <main className={`flex-1 w-full relative z-10 ${isTestMode ? 'flex flex-col justify-center' : ''}`}>
        {children}
      </main>

      {!isTestMode && <div className="relative z-10"><Footer onNavClick={handleNavClick} /></div>}
    </div>
  );
};

export default AppLayout;
