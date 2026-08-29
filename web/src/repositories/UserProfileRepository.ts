import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { FirestorePaths } from '../generated/contracts';
import { IUserProfileRepository } from './interfaces/IUserProfileRepository';
import { UserProfile } from '../types/userProfile';
import { ProfileValidationError } from '../types/errors';

const profileDocRef = (userId: string) =>
  doc(db, FirestorePaths.USERS, userId, FirestorePaths.USER_DATA_SUBCOLLECTION, FirestorePaths.USER_PROFILE_DOC_ID);

/**
 * Reads/writes `users/{userId}/data/profile` -- the exact Firestore document and
 * fields KMP's `GitLiveUserProfileRepository` uses (no `@SerialName` renames).
 * firestore.rules:63-72 makes this doc client-writable, so writes go directly
 * through the client SDK (no Cloud Function needed).
 */
export class UserProfileRepository implements IUserProfileRepository {
  async getUserProfile(userId: string): Promise<UserProfile | null> {
    try {
      const docSnap = await getDoc(profileDocRef(userId));
      if (!docSnap.exists()) {
        return null;
      }
      return docSnap.data() as UserProfile;
    } catch (error) {
      console.warn(`Failed to fetch user profile for ${userId}`, error);
      return null;
    }
  }

  async saveUserProfile(profile: UserProfile): Promise<void> {
    this.validate(profile);
    await setDoc(profileDocRef(profile.userId), { ...profile });
  }

  async updateUserProfile(profile: UserProfile): Promise<void> {
    this.validate(profile);
    await setDoc(profileDocRef(profile.userId), { ...profile }, { merge: true });
  }

  private validate(profile: UserProfile): void {
    if (!profile.fullName || profile.fullName.trim().length === 0) {
      throw new ProfileValidationError('Full name cannot be blank');
    }
    if (profile.age < 18 || profile.age > 35) {
      throw new ProfileValidationError('Age must be between 18 and 35');
    }
  }
}
