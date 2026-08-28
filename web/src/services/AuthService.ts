import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged as firebaseOnAuthStateChanged,
  getAdditionalUserInfo,
  User,
  Auth
} from 'firebase/auth';
import { auth as defaultAuth } from '../config/firebase';
import { AnalyticsRepository } from '../repositories/AnalyticsRepository';

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

export class AuthService {
  private auth: Auth;
  private analyticsRepository: AnalyticsRepository;

  constructor(authInstance: Auth = defaultAuth, analyticsRepository: AnalyticsRepository = new AnalyticsRepository()) {
    this.auth = authInstance;
    this.analyticsRepository = analyticsRepository;
  }

  /**
   * Triggers Google Popup Sign In
   */
  async signInWithGoogle(): Promise<UserProfile> {
    const provider = new GoogleAuthProvider();
    provider.addScope('email');
    provider.addScope('profile');

    const result = await signInWithPopup(this.auth, provider);

    // Phase 8 (ai_search_readiness plan): signup-rate is the one metric root CLAUDE.md's
    // MEDIUM 8 fix requires measuring before/after un-gating Study. `isNewUser` is Firebase
    // Auth's own signal for "this uid was just created", not a heuristic we compute -- fired
    // fire-and-forget so an analytics outage can never block a real sign-in.
    if (getAdditionalUserInfo(result)?.isNewUser) {
      this.analyticsRepository.recordSignup().catch((error) => {
        console.error('AuthService: recordSignup failed (sign-in still succeeded)', error);
      });
    }

    return this.mapFirebaseUser(result.user);
  }

  /**
   * Signs out the current user
   */
  async signOut(): Promise<void> {
    await firebaseSignOut(this.auth);
  }

  /**
   * Gets the current authenticated user profile
   */
  getCurrentUser(): UserProfile | null {
    const user = this.auth.currentUser;
    return user ? this.mapFirebaseUser(user) : null;
  }

  /**
   * Listens for authentication state changes
   */
  onAuthStateChanged(callback: (user: UserProfile | null) => void): () => void {
    return firebaseOnAuthStateChanged(this.auth, (user: User | null) => {
      callback(user ? this.mapFirebaseUser(user) : null);
    });
  }

  private mapFirebaseUser(user: User): UserProfile {
    return {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      photoURL: user.photoURL
    };
  }
}

export const authService = new AuthService();
