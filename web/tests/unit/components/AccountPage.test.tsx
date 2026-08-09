import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AccountPage } from '../../../src/components/account/AccountPage';
import { strings } from '../../../src/constants/strings';

describe('AccountPage Component', () => {
  const mockUser = {
    uid: 'test-cadet-uid-123',
    displayName: 'Cadet Vikram Sharma',
    email: 'vikram.sharma@ssbmax.in',
    photoURL: null,
    isPaidMember: false
  };

  it('renders account page title, user details, and free tier badge', () => {
    render(<AccountPage user={mockUser} />);

    expect(screen.getByTestId('account-page')).toBeInTheDocument();
    expect(screen.getByTestId('user-name')).toHaveTextContent('Cadet Vikram Sharma');
    expect(screen.getByTestId('user-email')).toHaveTextContent('vikram.sharma@ssbmax.in');
    expect(screen.getByTestId('user-initials')).toHaveTextContent('CV');
    expect(screen.getByTestId('membership-badge')).toHaveTextContent(strings.subscription.freePlanTitle);
  });

  it('displays pro officer pass badge when user is a paid member', () => {
    const proUser = { ...mockUser, isPaidMember: true };
    render(<AccountPage user={proUser} />);

    expect(screen.getByTestId('membership-badge')).toHaveTextContent(strings.subscription.proPlanTitle);
  });

  it('triggers onSignOut, onEditDiagnostic, and onUpgradeClick handlers', () => {
    const onSignOut = vi.fn();
    const onEditDiagnostic = vi.fn();
    const onUpgradeClick = vi.fn();

    render(
      <AccountPage
        user={mockUser}
        onSignOut={onSignOut}
        onEditDiagnostic={onEditDiagnostic}
        onUpgradeClick={onUpgradeClick}
      />
    );

    fireEvent.click(screen.getByTestId('sign-out-button'));
    expect(onSignOut).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTestId('edit-diagnostic-button'));
    expect(onEditDiagnostic).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTestId('upgrade-pass-button'));
    expect(onUpgradeClick).toHaveBeenCalledTimes(1);
  });

  it('applies Level 2 elevation styling to user profile card', () => {
    render(<AccountPage user={mockUser} />);

    const accountPage = screen.getByTestId('account-page');
    const profileCard = accountPage.querySelector('.rounded-3xl');
    expect(profileCard?.className).toContain('dark:bg-slate-800/90');
    expect(profileCard?.className).toContain('dark:border-slate-700/80');
  });
});
