import { useState, useEffect, useCallback } from 'react';

export type TabId = 'home' | 'study' | 'tests' | 'settings' | 'privacy' | 'terms';

export const CORE_TABS: TabId[] = ['home', 'study', 'tests', 'settings'];
export const VALID_TABS: TabId[] = ['home', 'study', 'tests', 'settings', 'privacy', 'terms'];

export const TAB_ALIASES: Record<string, TabId> = {
  practice: 'tests',
  dashboard: 'home',
  reports: 'tests',
  pricing: 'settings',
  account: 'settings'
};

export const getTabFromUrl = (searchString?: string): TabId => {
  const search = searchString ?? (typeof window !== 'undefined' ? window.location.search : '');
  const params = new URLSearchParams(search);
  const rawTab = params.get('tab')?.toLowerCase() || 'home';
  if (VALID_TABS.includes(rawTab as TabId)) {
    return rawTab as TabId;
  }
  if (rawTab in TAB_ALIASES) {
    return TAB_ALIASES[rawTab];
  }
  return 'home';
};

export function useTabRouting(defaultTab: TabId = 'home') {
  const [activeTab, setActiveTabState] = useState<TabId>(() => getTabFromUrl() || defaultTab);

  useEffect(() => {
    const handlePopState = () => {
      const currentTab = getTabFromUrl();
      setActiveTabState(currentTab);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const setActiveTab = useCallback((tab: string) => {
    const targetTab = (VALID_TABS.includes(tab as TabId)
      ? tab
      : (TAB_ALIASES[tab] || 'home')) as TabId;

    setActiveTabState(targetTab);

    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      if (targetTab === 'home') {
        url.searchParams.delete('tab');
      } else {
        url.searchParams.set('tab', targetTab);
      }
      window.history.pushState({ tab: targetTab }, '', url.toString());
    }
  }, []);

  return { activeTab, setActiveTab };
}
