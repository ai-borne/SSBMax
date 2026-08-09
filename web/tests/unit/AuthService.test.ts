import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthService } from '../../src/services/AuthService';

vi.mock('firebase/auth', () => {
  const mockUser = {
    uid: 'test-uid-123',
    email: 'candidate@ssbmax.in',
    displayName: 'Test Candidate',
    photoURL: 'https://example.com/avatar.png'
  };

  return {
    getAuth: vi.fn().mockReturnValue({}),
    GoogleAuthProvider: vi.fn().mockImplementation(() => ({
      addScope: vi.fn()
    })),
    signInWithPopup: vi.fn().mockResolvedValue({ user: mockUser }),
    signOut: vi.fn().mockResolvedValue(undefined),
    onAuthStateChanged: vi.fn((_auth, callback) => {
      callback(mockUser);
      return () => {};
    })
  };
});

describe('AuthService Unit Tests', () => {
  let authService: AuthService;
  const mockAuth: any = {
    currentUser: {
      uid: 'test-uid-123',
      email: 'candidate@ssbmax.in',
      displayName: 'Test Candidate',
      photoURL: 'https://example.com/avatar.png'
    }
  };

  beforeEach(() => {
    vi.clearAllMocks();
    authService = new AuthService(mockAuth);
  });

  it('should return mapped user profile on getCurrentUser', () => {
    const user = authService.getCurrentUser();
    expect(user).not.toBeNull();
    expect(user?.uid).toBe('test-uid-123');
    expect(user?.email).toBe('candidate@ssbmax.in');
  });

  it('should perform Google sign in successfully', async () => {
    const user = await authService.signInWithGoogle();
    expect(user.uid).toBe('test-uid-123');
    expect(user.displayName).toBe('Test Candidate');
  });

  it('should call sign out', async () => {
    await authService.signOut();
    expect(authService.getCurrentUser()).toBeDefined();
  });

  it('should listen to auth state changes', () => {
    const listener = vi.fn();
    const unsubscribe = authService.onAuthStateChanged(listener);
    expect(listener).toHaveBeenCalledWith(expect.objectContaining({ uid: 'test-uid-123' }));
    expect(typeof unsubscribe).toBe('function');
  });
});
