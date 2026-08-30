import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSectionReadState } from '../../../src/hooks/useSectionReadState';

describe('useSectionReadState', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('starts with no sections marked read', () => {
    const { result } = renderHook(() => useSectionReadState());

    expect(result.current.isSectionRead('section-1')).toBe(false);
    expect(result.current.readSectionIds.size).toBe(0);
  });

  it('toggleSectionRead marks a section read, then unmarks it on a second call', () => {
    const { result } = renderHook(() => useSectionReadState());

    act(() => result.current.toggleSectionRead('section-1'));
    expect(result.current.isSectionRead('section-1')).toBe(true);

    act(() => result.current.toggleSectionRead('section-1'));
    expect(result.current.isSectionRead('section-1')).toBe(false);
  });

  it('persists read state to localStorage so it survives a remount', () => {
    // Study content is public (unauthenticated visitors included), so localStorage is the only
    // persistence available -- this is the guarantee that matters for an anonymous reader.
    const { result: first } = renderHook(() => useSectionReadState());
    act(() => first.current.toggleSectionRead('section-1'));

    const { result: second } = renderHook(() => useSectionReadState());
    expect(second.current.isSectionRead('section-1')).toBe(true);
  });

  it('tracks multiple sections independently', () => {
    const { result } = renderHook(() => useSectionReadState());

    act(() => {
      result.current.toggleSectionRead('section-1');
      result.current.toggleSectionRead('section-2');
    });

    expect(result.current.isSectionRead('section-1')).toBe(true);
    expect(result.current.isSectionRead('section-2')).toBe(true);
    expect(result.current.readSectionIds.size).toBe(2);
  });

  it('falls back to in-memory state when localStorage throws (private browsing / quota)', () => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = () => {
      throw new Error('QuotaExceededError');
    };

    try {
      const { result } = renderHook(() => useSectionReadState());
      act(() => result.current.toggleSectionRead('section-1'));

      expect(result.current.isSectionRead('section-1')).toBe(true);
    } finally {
      Storage.prototype.setItem = original;
    }
  });
});
