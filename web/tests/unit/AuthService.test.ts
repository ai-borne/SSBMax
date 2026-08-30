import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthService } from '../../src/services/AuthService';
import type { Auth, User } from 'firebase/auth';
import type { AnalyticsRepository } from '../../src/repositories/AnalyticsRepository';

let mockIsNewUser = false;

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
    }),
    getAdditionalUserInfo: vi.fn(() => ({ isNewUser: mockIsNewUser }))
  };
});

describe('AuthService Unit Tests', () => {
  let authService: AuthService;
  let mockAnalyticsRepository: { recordSignup: ReturnType<typeof vi.fn> };
  const mockAuth = {
    currentUser: {
      uid: 'test-uid-123',
      email: 'candidate@ssbmax.in',
      displayName: 'Test Candidate',
      photoURL: 'https://example.com/avatar.png'
    } as unknown as User
  } as unknown as Auth;

  beforeEach(() => {
    vi.clearAllMocks();
    mockIsNewUser = false;
    mockAnalyticsRepository = { recordSignup: vi.fn().mockResolvedValue(undefined) };
    authService = new AuthService(mockAuth, mockAnalyticsRepository as unknown as AnalyticsRepository);
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

  it('should record a signup when Firebase Auth reports a new user', async () => {
    mockIsNewUser = true;
    await authService.signInWithGoogle();
    expect(mockAnalyticsRepository.recordSignup).toHaveBeenCalledTimes(1);
  });

  it('should NOT record a signup for a returning user', async () => {
    mockIsNewUser = false;
    await authService.signInWithGoogle();
    expect(mockAnalyticsRepository.recordSignup).not.toHaveBeenCalled();
  });

  it('should still resolve sign-in successfully even if recording the signup fails', async () => {
    mockIsNewUser = true;
    mockAnalyticsRepository.recordSignup.mockRejectedValue(new Error('functions unavailable'));
    const user = await authService.signInWithGoogle();
    expect(user.uid).toBe('test-uid-123');
  });
});
