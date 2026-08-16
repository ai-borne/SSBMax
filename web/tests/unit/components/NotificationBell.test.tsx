import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { NotificationBell } from '../../../src/components/notifications/NotificationBell';
import { useNotificationCenterViewModel } from '../../../src/viewmodels/useNotificationCenterViewModel';
import type { SSBMaxNotification } from '../../../src/types/notification';

vi.mock('../../../src/viewmodels/useNotificationCenterViewModel');

function notification(overrides: Partial<SSBMaxNotification> = {}): SSBMaxNotification {
  return {
    id: 'n1',
    userId: 'user_1',
    type: 'GRADING_COMPLETE',
    priority: 'NORMAL',
    title: 'Result ready',
    message: 'Your TAT result is ready',
    isRead: false,
    createdAt: Date.now(),
    ...overrides
  };
}

const markAsRead = vi.fn();
const markAllAsRead = vi.fn();

function mockViewModel(overrides: Partial<ReturnType<typeof useNotificationCenterViewModel>> = {}) {
  vi.mocked(useNotificationCenterViewModel).mockReturnValue({
    isLoading: false,
    notifications: [],
    unreadCount: 0,
    error: null,
    markAsRead,
    markAllAsRead,
    ...overrides
  });
}

describe('NotificationBell', () => {
  beforeEach(() => {
    markAsRead.mockReset();
    markAllAsRead.mockReset();
  });

  it('renders nothing when there is no signed-in user', () => {
    mockViewModel();
    const { container } = render(<NotificationBell userId={undefined} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the unread count badge, capped at "99+"', () => {
    mockViewModel({ unreadCount: 120 });
    render(<NotificationBell userId="user_1" />);
    expect(screen.getByTestId('notification-unread-badge')).toHaveTextContent('99+');
  });

  it('hides the badge when unread count is zero', () => {
    mockViewModel({ unreadCount: 0 });
    render(<NotificationBell userId="user_1" />);
    expect(screen.queryByTestId('notification-unread-badge')).not.toBeInTheDocument();
  });

  it('opens the inbox dropdown on click and marks an unread notification as read on click', () => {
    mockViewModel({ notifications: [notification()], unreadCount: 1 });
    render(<NotificationBell userId="user_1" />);

    expect(screen.queryByTestId('notification-inbox')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('notification-bell-button'));
    expect(screen.getByTestId('notification-inbox')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('notification-item-n1'));
    expect(markAsRead).toHaveBeenCalledWith('n1');
  });

  it('does not re-mark an already-read notification as read on click', () => {
    mockViewModel({ notifications: [notification({ isRead: true })], unreadCount: 0 });
    render(<NotificationBell userId="user_1" />);

    fireEvent.click(screen.getByTestId('notification-bell-button'));
    fireEvent.click(screen.getByTestId('notification-item-n1'));
    expect(markAsRead).not.toHaveBeenCalled();
  });

  it('closes the dropdown when clicking outside', () => {
    mockViewModel();
    render(
      <div>
        <NotificationBell userId="user_1" />
        <div data-testid="outside">outside</div>
      </div>
    );

    fireEvent.click(screen.getByTestId('notification-bell-button'));
    expect(screen.getByTestId('notification-inbox')).toBeInTheDocument();

    fireEvent.mouseDown(screen.getByTestId('outside'));
    expect(screen.queryByTestId('notification-inbox')).not.toBeInTheDocument();
  });
});
