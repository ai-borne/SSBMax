import { UserProfile } from '../../types/userProfile';

export interface IUserProfileRepository {
  getUserProfile(userId: string): Promise<UserProfile | null>;
  saveUserProfile(profile: UserProfile): Promise<void>;
  updateUserProfile(profile: UserProfile): Promise<void>;
}
