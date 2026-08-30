/**
 * Mirrors KMP's `shared/.../domain/model/UserProfile.kt` exactly (fields written verbatim
 * to Firestore, no renames -- see `UserProfileDto.kt` / `GitLiveUserProfileRepository.kt`).
 */

export type Gender = 'MALE' | 'FEMALE' | 'OTHER';

export type EntryType = 'ENTRY_10_PLUS_2' | 'GRADUATE' | 'SERVICE';

export interface UserProfile {
  userId: string;
  fullName: string;
  age: number;
  gender: Gender;
  entryType: EntryType;
  profilePictureUrl?: string;
  currentStreak: number;
  lastLoginDate?: number;
  longestStreak: number;
  createdAt: number;
  updatedAt: number;
}
