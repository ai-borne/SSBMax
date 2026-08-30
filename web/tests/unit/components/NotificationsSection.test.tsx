import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { NotificationsSection } from '../../../src/components/settings/NotificationsSection';
import { useNotificationPreferencesViewModel } from '../../../src/viewmodels/useNotificationPreferencesViewModel';
import { requestPushPermission } from '../../../src/config/messaging';
import { defaultNotificationPreferences } from '../../../src/types/notification';

vi.mock('../../../src/viewmodels/useNotificationPreferencesViewModel');
vi.mock('../../../src/config/messaging', () => ({
  requestPushPermission: vi.fn()
}));

describe('NotificationsSection', () => {
  const originalNotification = (globalThis as unknown as { Notification: { permission: NotificationPermission } }).Notification;

  beforeEach(() => {
    (globalThis as unknown as { Notification: { permission: NotificationPermission } }).Notification = { permission: 'granted' };
    vi.mocked(requestPushPermission).mockReset();
  });

  afterEach(() => {
    (globalThis as unknown as { Notification: { permission: NotificationPermission } }).Notification = originalNotification;
  });

  it('hides the push toggle for a signed-out user (no userId), same as the bell', () => {
    vi.mocked(useNotificationPreferencesViewModel).mockReturnValue({
      isLoading: false,
      preferences: null,
      error: null,
      setEnablePushNotifications: vi.fn()
    });

    render(<NotificationsSection />);

    expect(screen.queryByTestId('toggle-push-notifications')).not.toBeInTheDocument();
  });

  it('reflects enablePushNotifications from the loaded preferences doc', () => {
    vi.mocked(useNotificationPreferencesViewModel).mockReturnValue({
      isLoading: false,
      preferences: { ...defaultNotificationPreferences('user_1'), enablePushNotifications: true },
      error: null,
      setEnablePushNotifications: vi.fn()
    });

    render(<NotificationsSection userId="user_1" />);

    expect(screen.getByTestId('toggle-push-notifications')).toBeInTheDocument();
  });

  it('requests browser push permission before persisting the toggle-on, so the preference never claims push is enabled without a token', async () => {
    const setEnablePushNotifications = vi.fn().mockResolvedValue(undefined);
    vi.mocked(useNotificationPreferencesViewModel).mockReturnValue({
      isLoading: false,
      preferences: { ...defaultNotificationPreferences('user_1'), enablePushNotifications: false },
      error: null,
      setEnablePushNotifications
    });
    vi.mocked(requestPushPermission).mockResolvedValue({ status: 'granted' });

    render(<NotificationsSection userId="user_1" />);
    fireEvent.click(screen.getByTestId('toggle-push-notifications'));

    await waitFor(() => expect(setEnablePushNotifications).toHaveBeenCalledWith(true));
    expect(requestPushPermission).toHaveBeenCalledWith('user_1');
  });

  it('does not persist the preference when the browser permission request is denied', async () => {
    const setEnablePushNotifications = vi.fn();
    vi.mocked(useNotificationPreferencesViewModel).mockReturnValue({
      isLoading: false,
      preferences: { ...defaultNotificationPreferences('user_1'), enablePushNotifications: false },
      error: null,
      setEnablePushNotifications
    });
    vi.mocked(requestPushPermission).mockResolvedValue({ status: 'denied' });

    render(<NotificationsSection userId="user_1" />);
    fireEvent.click(screen.getByTestId('toggle-push-notifications'));

    await waitFor(() => expect(requestPushPermission).toHaveBeenCalled());
    expect(setEnablePushNotifications).not.toHaveBeenCalled();
  });
});
