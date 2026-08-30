import { useEffect, useState } from 'react';
import { NotificationRepository } from '../repositories/NotificationRepository';
import { defaultNotificationPreferences, type NotificationPreferences } from '../types/notification';

export interface NotificationPreferencesState {
  isLoading: boolean;
  preferences: NotificationPreferences | null;
  error: string | null;
}

export interface NotificationPreferencesActions {
  setEnablePushNotifications: (enabled: boolean) => Promise<void>;
  setEnableTestReminders: (enabled: boolean) => Promise<void>;
}

/**
 * Backs the Settings > Notifications toggles with the `notificationPreferences`
 * Firestore doc from `NotificationRepository`, replacing the previously
 * local-state-only `NotificationsSection.tsx` stubs.
 */
export function useNotificationPreferencesViewModel(
  userId: string | undefined,
  injectedRepository?: NotificationRepository
): NotificationPreferencesState & NotificationPreferencesActions {
  const [defaultRepository] = useState(() => new NotificationRepository());
  const repository = injectedRepository ?? defaultRepository;

  const [state, setState] = useState<NotificationPreferencesState>({
    isLoading: true,
    preferences: null,
    error: null
  });

  useEffect(() => {
    if (!userId) {
      setState({ isLoading: false, preferences: null, error: null });
      return;
    }
    let cancelled = false;
    setState((prev) => ({ ...prev, isLoading: true, error: null }));
    repository
      .getPreferences(userId)
      .then((preferences) => {
        if (!cancelled) setState({ isLoading: false, preferences, error: null });
      })
      .catch((e) => {
        if (!cancelled) setState({ isLoading: false, preferences: null, error: e instanceof Error ? e.message : String(e) });
      });
    return () => {
      cancelled = true;
    };
  }, [userId, repository]);

  const updatePreference = async (patch: Partial<NotificationPreferences>) => {
    if (!userId) return;
    const previous = state.preferences;
    const next = { ...(previous ?? defaultNotificationPreferences(userId)), ...patch };
    setState((prev) => ({ ...prev, preferences: next, error: null }));
    try {
      await repository.savePreferences(next);
    } catch (e) {
      setState((prev) => ({ ...prev, preferences: previous, error: e instanceof Error ? e.message : String(e) }));
    }
  };

  const setEnablePushNotifications = (enabled: boolean) => updatePreference({ enablePushNotifications: enabled });
  const setEnableTestReminders = (enabled: boolean) => updatePreference({ enableTestReminders: enabled });

  return { ...state, setEnablePushNotifications, setEnableTestReminders };
}
