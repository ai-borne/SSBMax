import { FC, useState } from 'react';
import { strings } from '../../constants/strings';
import { BaseModal } from '../common/BaseModal';
import { PIQChipsSelector } from '../practice/piq/PIQChipsSelector';
import { UserProfileRepository } from '../../repositories/UserProfileRepository';
import { Gender, EntryType, UserProfile } from '../../types/userProfile';

const GENDER_OPTIONS: Record<string, Gender> = {
  [strings.editProfileModal.genderMale]: 'MALE',
  [strings.editProfileModal.genderFemale]: 'FEMALE',
  [strings.editProfileModal.genderOther]: 'OTHER'
};

const ENTRY_TYPE_OPTIONS: Record<string, EntryType> = {
  [strings.editProfileModal.entryType10Plus2]: 'ENTRY_10_PLUS_2',
  [strings.editProfileModal.entryTypeGraduate]: 'GRADUATE',
  [strings.editProfileModal.entryTypeService]: 'SERVICE'
};

const GENDER_LABELS: Record<Gender, string> = {
  MALE: strings.editProfileModal.genderMale,
  FEMALE: strings.editProfileModal.genderFemale,
  OTHER: strings.editProfileModal.genderOther
};

const ENTRY_TYPE_LABELS: Record<EntryType, string> = {
  ENTRY_10_PLUS_2: strings.editProfileModal.entryType10Plus2,
  GRADUATE: strings.editProfileModal.entryTypeGraduate,
  SERVICE: strings.editProfileModal.entryTypeService
};

export interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  profile: UserProfile | null;
  onSaved: () => void;
  injectedRepository?: UserProfileRepository;
}

export const EditProfileModal: FC<EditProfileModalProps> = ({
  isOpen,
  onClose,
  userId,
  profile,
  onSaved,
  injectedRepository
}) => {
  const [fullName, setFullName] = useState(profile?.fullName ?? '');
  const [age, setAge] = useState(profile?.age?.toString() ?? '');
  const [gender, setGender] = useState<Gender>(profile?.gender ?? 'MALE');
  const [entryType, setEntryType] = useState<EntryType>(profile?.entryType ?? 'ENTRY_10_PLUS_2');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset the form fields when the modal opens with the latest profile -- adjusted during
  // render (React's "adjusting state when a prop changes" pattern) rather than in an effect,
  // since it's purely derived from the isOpen transition.
  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
  if (isOpen !== prevIsOpen) {
    setPrevIsOpen(isOpen);
    if (isOpen) {
      setFullName(profile?.fullName ?? '');
      setAge(profile?.age?.toString() ?? '');
      setGender(profile?.gender ?? 'MALE');
      setEntryType(profile?.entryType ?? 'ENTRY_10_PLUS_2');
      setError(null);
    }
  }

  const parsedAge = Number(age);
  const isFullNameValid = fullName.trim().length > 0;
  const isAgeValid = age.trim().length > 0 && Number.isInteger(parsedAge) && parsedAge >= 18 && parsedAge <= 35;
  const canSave = isFullNameValid && isAgeValid && !isSaving;

  const handleSave = async () => {
    if (!canSave) return;
    setIsSaving(true);
    setError(null);

    const repository = injectedRepository ?? new UserProfileRepository();
    const now = Date.now();
    const nextProfile: UserProfile = {
      userId,
      fullName: fullName.trim(),
      age: parsedAge,
      gender,
      entryType,
      profilePictureUrl: profile?.profilePictureUrl,
      currentStreak: profile?.currentStreak ?? 0,
      lastLoginDate: profile?.lastLoginDate,
      longestStreak: profile?.longestStreak ?? 0,
      createdAt: profile?.createdAt ?? now,
      updatedAt: now
    };

    try {
      if (profile) {
        await repository.updateUserProfile(nextProfile);
      } else {
        await repository.saveUserProfile(nextProfile);
      }
      setIsSaving(false);
      onSaved();
      onClose();
    } catch {
      setIsSaving(false);
      setError(strings.editProfileModal.saveFailed);
    }
  };

  return (
    <BaseModal isOpen={isOpen} onClose={onClose} title={strings.editProfileModal.title} testId="edit-profile-modal">
      <div className="space-y-5">
        <div className="space-y-2">
          <label htmlFor="edit-profile-full-name" className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
            {strings.editProfileModal.fullNameLabel}
          </label>
          <input
            id="edit-profile-full-name"
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder={strings.editProfileModal.fullNamePlaceholder}
            className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
            data-testid="edit-profile-full-name-input"
          />
          {!isFullNameValid && fullName.length > 0 && (
            <p className="text-xs text-rose-500" data-testid="edit-profile-full-name-error">{strings.editProfileModal.fullNameRequired}</p>
          )}
        </div>

        <div className="space-y-2">
          <label htmlFor="edit-profile-age" className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
            {strings.editProfileModal.ageLabel}
          </label>
          <input
            id="edit-profile-age"
            type="number"
            value={age}
            onChange={(e) => setAge(e.target.value)}
            placeholder={strings.editProfileModal.agePlaceholder}
            className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
            data-testid="edit-profile-age-input"
          />
          {!isAgeValid && age.length > 0 && (
            <p className="text-xs text-rose-500" data-testid="edit-profile-age-error">{strings.editProfileModal.ageRangeInvalid}</p>
          )}
        </div>

        <PIQChipsSelector
          label={strings.editProfileModal.genderLabel}
          options={Object.keys(GENDER_OPTIONS)}
          selectedOption={GENDER_LABELS[gender]}
          onSelect={(option) => setGender(GENDER_OPTIONS[option])}
          testId="edit-profile-gender-selector"
        />

        <PIQChipsSelector
          label={strings.editProfileModal.entryTypeLabel}
          options={Object.keys(ENTRY_TYPE_OPTIONS)}
          selectedOption={ENTRY_TYPE_LABELS[entryType]}
          onSelect={(option) => setEntryType(ENTRY_TYPE_OPTIONS[option])}
          testId="edit-profile-entry-type-selector"
        />

        {error && (
          <p className="text-xs text-rose-500" data-testid="edit-profile-save-error">{error}</p>
        )}

        <button
          type="button"
          onClick={handleSave}
          disabled={!canSave}
          className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-gradient-to-r from-sky-600 to-emerald-600 hover:from-sky-500 hover:to-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-sm shadow-md transition-all"
          data-testid="edit-profile-save-button"
        >
          {isSaving ? strings.editProfileModal.saving : strings.editProfileModal.saveProfile}
        </button>
      </div>
    </BaseModal>
  );
};

export default EditProfileModal;
