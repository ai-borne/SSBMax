import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTabRouting, getTabFromUrl } from '../../../src/hooks/useTabRouting';

describe('useTabRouting Hook', () => {
  beforeEach(() => {
    window.history.pushState({}, '', '/');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('correctly parses tab parameter from URL search string', () => {
    expect(getTabFromUrl('?tab=study')).toBe('study');
    expect(getTabFromUrl('?tab=tests')).toBe('tests');
    expect(getTabFromUrl('?tab=settings')).toBe('settings');
    expect(getTabFromUrl('?tab=home')).toBe('home');
  });

  it('maps legacy tab aliases to core tabs', () => {
    expect(getTabFromUrl('?tab=practice')).toBe('tests');
    expect(getTabFromUrl('?tab=dashboard')).toBe('home');
    expect(getTabFromUrl('?tab=pricing')).toBe('settings');
    expect(getTabFromUrl('?tab=account')).toBe('settings');
  });

  it('routes reports as its own real tab -- Phase 11e wires AIReportsPage into it, no longer a redirect to tests', () => {
    expect(getTabFromUrl('?tab=reports')).toBe('reports');
  });

  it('defaults to home tab when query param is missing or unknown', () => {
    expect(getTabFromUrl('')).toBe('home');
    expect(getTabFromUrl('?tab=invalid_tab')).toBe('home');
  });

  it('updates activeTab and updates window history pushState on tab change', () => {
    const pushStateSpy = vi.spyOn(window.history, 'pushState');
    const { result } = renderHook(() => useTabRouting());

    expect(result.current.activeTab).toBe('home');

    act(() => {
      result.current.setActiveTab('study');
    });

    expect(result.current.activeTab).toBe('study');
    expect(pushStateSpy).toHaveBeenCalledWith(
      { tab: 'study' },
      '',
      'http://localhost:3000/?tab=study'
    );
  });

  it('removes tab query param when navigating back to home tab', () => {
    window.history.pushState({}, '', '/?tab=study');
    const pushStateSpy = vi.spyOn(window.history, 'pushState');
    const { result } = renderHook(() => useTabRouting());

    expect(result.current.activeTab).toBe('study');

    act(() => {
      result.current.setActiveTab('home');
    });

    expect(result.current.activeTab).toBe('home');
    expect(pushStateSpy).toHaveBeenCalledWith(
      { tab: 'home' },
      '',
      'http://localhost:3000/'
    );
  });

  it('syncs tab state on popstate event', () => {
    const { result } = renderHook(() => useTabRouting());
    expect(result.current.activeTab).toBe('home');

    act(() => {
      window.history.pushState({}, '', '/?tab=settings');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });

    expect(result.current.activeTab).toBe('settings');
  });
});
