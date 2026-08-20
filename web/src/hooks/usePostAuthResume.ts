import { useEffect } from 'react';

export const POST_AUTH_RESUME_KEY = 'ssbmax_post_auth_resume';
const DEFAULT_TTL_MS = 15 * 60 * 1000; // 15 minutes TTL

export interface PostAuthPayload {
  targetId: string;
  timestamp: number;
}

export interface UsePostAuthResumeOptions {
  user: unknown | null;
  materialsLoaded: boolean;
  onOpenMaterial: (targetId: string) => void;
  ttlMs?: number;
}

/**
 * Save a timestamped targetId payload to sessionStorage prior to OAuth trigger.
 */
export function savePostAuthResume(targetId: string): void {
  try {
    const payload: PostAuthPayload = {
      targetId,
      timestamp: Date.now()
    };
    sessionStorage.setItem(POST_AUTH_RESUME_KEY, JSON.stringify(payload));
  } catch (error) {
    console.warn('Failed to save post-auth resume payload to sessionStorage', error);
  }
}

/**
 * Clear the post-auth resume key from sessionStorage.
 */
export function clearPostAuthResume(): void {
  try {
    sessionStorage.removeItem(POST_AUTH_RESUME_KEY);
  } catch (error) {
    console.warn('Failed to clear post-auth resume payload from sessionStorage', error);
  }
}

/**
 * Retrieve and validate the post-auth resume payload against TTL.
 */
export function getPostAuthResume(ttlMs = DEFAULT_TTL_MS): PostAuthPayload | null {
  try {
    const raw = sessionStorage.getItem(POST_AUTH_RESUME_KEY);
    if (!raw) return null;

    const payload: PostAuthPayload = JSON.parse(raw);
    if (!payload || typeof payload.targetId !== 'string' || typeof payload.timestamp !== 'number') {
      clearPostAuthResume();
      return null;
    }

    const isExpired = Date.now() - payload.timestamp > ttlMs;
    if (isExpired) {
      clearPostAuthResume();
      return null;
    }

    return payload;
  } catch (error) {
    clearPostAuthResume();
    return null;
  }
}

/**
 * Custom hook evaluating double hydration (user authenticated AND materials loaded).
 * Auto-triggers onOpenMaterial and clears storage key once condition is satisfied.
 */
export function usePostAuthResume({
  user,
  materialsLoaded,
  onOpenMaterial,
  ttlMs = DEFAULT_TTL_MS
}: UsePostAuthResumeOptions): {
  saveResume: (targetId: string) => void;
  clearResume: () => void;
  getResume: () => PostAuthPayload | null;
} {
  useEffect(() => {
    if (!user || !materialsLoaded) {
      return;
    }

    const payload = getPostAuthResume(ttlMs);
    if (payload && payload.targetId) {
      clearPostAuthResume();
      onOpenMaterial(payload.targetId);
    }
  }, [user, materialsLoaded, onOpenMaterial, ttlMs]);

  return {
    saveResume: savePostAuthResume,
    clearResume: clearPostAuthResume,
    getResume: () => getPostAuthResume(ttlMs)
  };
}
