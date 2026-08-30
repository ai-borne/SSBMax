import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { requestPushPermission } from '../../../src/config/messaging';
import { NotificationPermissionPrompt } from '../../../src/components/notifications/NotificationPermissionPrompt';

vi.mock('../../../src/config/messaging', () => ({
  requestPushPermission: vi.fn()
}));

describe('NotificationPermissionPrompt', () => {
  const originalNotification = (globalThis as unknown as { Notification: { permission: NotificationPermission } }).Notification;

  beforeEach(() => {
    localStorage.clear();
    vi.mocked(requestPushPermission).mockReset();
    (globalThis as unknown as { Notification: { permission: NotificationPermission } }).Notification = { permission: 'default' };
  });

  afterEach(() => {
    (globalThis as unknown as { Notification: { permission: NotificationPermission } }).Notification = originalNotification;
  });

  it('renders when permission is still default and not previously dismissed', () => {
    render(<NotificationPermissionPrompt userId="user_1" />);
    expect(screen.getByTestId('notification-permission-prompt')).toBeInTheDocument();
  });

  it('does not render once the user already granted or denied permission at the browser level', () => {
    (globalThis as unknown as { Notification: { permission: NotificationPermission } }).Notification = { permission: 'granted' };
    render(<NotificationPermissionPrompt userId="user_1" />);
    expect(screen.queryByTestId('notification-permission-prompt')).not.toBeInTheDocument();
  });

  it('hides itself permanently once dismissed, so it does not re-prompt every visit', () => {
    render(<NotificationPermissionPrompt userId="user_1" />);
    fireEvent.click(screen.getByTestId('notification-permission-dismiss'));
    expect(screen.queryByTestId('notification-permission-prompt')).not.toBeInTheDocument();
    expect(localStorage.getItem('ssbmax_push_prompt_dismissed')).toBe('true');
  });

  it('hides after a successful grant, without requiring a page reload', async () => {
    vi.mocked(requestPushPermission).mockResolvedValue({ status: 'granted' });
    render(<NotificationPermissionPrompt userId="user_1" />);

    fireEvent.click(screen.getByTestId('notification-permission-enable'));

    await waitFor(() => expect(screen.queryByTestId('notification-permission-prompt')).not.toBeInTheDocument());
    expect(requestPushPermission).toHaveBeenCalledWith('user_1');
  });

  it('surfaces an explicit error message rather than failing silently when the push flow errors', async () => {
    vi.mocked(requestPushPermission).mockResolvedValue({ status: 'error', message: 'boom' });
    render(<NotificationPermissionPrompt userId="user_1" />);

    fireEvent.click(screen.getByTestId('notification-permission-enable'));

    await waitFor(() => expect(screen.getByText('boom')).toBeInTheDocument());
  });
});
