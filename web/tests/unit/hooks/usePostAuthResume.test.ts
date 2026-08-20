import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import {
  usePostAuthResume,
  savePostAuthResume,
  getPostAuthResume,
  clearPostAuthResume,
  POST_AUTH_RESUME_KEY
} from '../../../src/hooks/usePostAuthResume';

describe('usePostAuthResume Unit Tests', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.clearAllMocks();
  });

  it('should save and retrieve post-auth payload in sessionStorage', () => {
    savePostAuthResume('fallback-oir');
    const payload = getPostAuthResume();

    expect(payload).not.toBeNull();
    expect(payload?.targetId).toBe('fallback-oir');
    expect(payload?.timestamp).toBeGreaterThan(0);
  });

  it('should explicitly clear post-auth storage key using clearPostAuthResume', () => {
    savePostAuthResume('fallback-gpe');
    expect(getPostAuthResume()?.targetId).toBe('fallback-gpe');

    clearPostAuthResume();
    expect(getPostAuthResume()).toBeNull();
    expect(sessionStorage.getItem(POST_AUTH_RESUME_KEY)).toBeNull();
  });

  it('should return null and clear storage if payload is older than TTL', () => {
    const expiredTimestamp = Date.now() - (16 * 60 * 1000); // 16 minutes ago
    sessionStorage.setItem(
      POST_AUTH_RESUME_KEY,
      JSON.stringify({ targetId: 'fallback-tat', timestamp: expiredTimestamp })
    );

    const payload = getPostAuthResume(15 * 60 * 1000); // 15 mins TTL
    expect(payload).toBeNull();
    expect(sessionStorage.getItem(POST_AUTH_RESUME_KEY)).toBeNull();
  });

  it('should not trigger callback if user is null', () => {
    savePostAuthResume('fallback-wat');
    const onOpenMaterial = vi.fn();

    renderHook(() =>
      usePostAuthResume({
        user: null,
        materialsLoaded: true,
        onOpenMaterial
      })
    );

    expect(onOpenMaterial).not.toHaveBeenCalled();
    expect(sessionStorage.getItem(POST_AUTH_RESUME_KEY)).not.toBeNull();
  });

  it('should not trigger callback if materialsLoaded is false', () => {
    savePostAuthResume('fallback-srt');
    const onOpenMaterial = vi.fn();

    renderHook(() =>
      usePostAuthResume({
        user: { uid: 'user_123' },
        materialsLoaded: false,
        onOpenMaterial
      })
    );

    expect(onOpenMaterial).not.toHaveBeenCalled();
    expect(sessionStorage.getItem(POST_AUTH_RESUME_KEY)).not.toBeNull();
  });

  it('should trigger callback and clear storage when user exists AND materialsLoaded is true', () => {
    savePostAuthResume('fallback-sd');
    const onOpenMaterial = vi.fn();

    renderHook(() =>
      usePostAuthResume({
        user: { uid: 'user_123' },
        materialsLoaded: true,
        onOpenMaterial
      })
    );

    expect(onOpenMaterial).toHaveBeenCalledTimes(1);
    expect(onOpenMaterial).toHaveBeenCalledWith('fallback-sd');
    expect(sessionStorage.getItem(POST_AUTH_RESUME_KEY)).toBeNull();
  });

  it('should handle corrupt JSON in sessionStorage gracefully', () => {
    sessionStorage.setItem(POST_AUTH_RESUME_KEY, 'invalid-json-{');
    const payload = getPostAuthResume();

    expect(payload).toBeNull();
    expect(sessionStorage.getItem(POST_AUTH_RESUME_KEY)).toBeNull();
  });
});
