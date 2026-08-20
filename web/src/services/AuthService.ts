import { 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut as firebaseSignOut, 
  onAuthStateChanged as firebaseOnAuthStateChanged,
  User,
  Auth
} from 'firebase/auth';
import { auth as defaultAuth } from '../config/firebase';

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

export class AuthService {
  private auth: Auth;

  constructor(authInstance: Auth = defaultAuth) {
    this.auth = authInstance;
  }

  /**
   * Triggers Google Popup Sign In
   */
  async signInWithGoogle(): Promise<UserProfile> {
    const provider = new GoogleAuthProvider();
    provider.addScope('email');
    provider.addScope('profile');
    
    const result = await signInWithPopup(this.auth, provider);
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
