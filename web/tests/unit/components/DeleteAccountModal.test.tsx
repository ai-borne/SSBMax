import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DeleteAccountModal } from '../../../src/components/settings/DeleteAccountModal';

/**
 * docs/plans/AccountDeletion.md Phase 3: the confirm button is the irreversibility guard --
 * it must stay disabled (so a stray click can't fire the callable) until the user explicitly
 * ticks the acknowledgement checkbox.
 */
describe('DeleteAccountModal', () => {
  it('renders nothing when closed', () => {
    const { container } = render(
      <DeleteAccountModal isOpen={false} onClose={vi.fn()} onConfirm={vi.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('disables the confirm button until the acknowledgement checkbox is checked', () => {
    const onConfirm = vi.fn();
    render(<DeleteAccountModal isOpen={true} onClose={vi.fn()} onConfirm={onConfirm} />);

    const confirmBtn = screen.getByTestId('delete-account-confirm-btn');
    expect(confirmBtn).toBeDisabled();

    fireEvent.click(screen.getByRole('checkbox'));
    expect(confirmBtn).not.toBeDisabled();

    fireEvent.click(confirmBtn);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('resets the acknowledgement checkbox on close-then-reopen', () => {
    const { rerender } = render(<DeleteAccountModal isOpen={true} onClose={vi.fn()} onConfirm={vi.fn()} />);

    fireEvent.click(screen.getByRole('checkbox'));
    expect(screen.getByTestId('delete-account-confirm-btn')).not.toBeDisabled();

    rerender(<DeleteAccountModal isOpen={false} onClose={vi.fn()} onConfirm={vi.fn()} />);
    rerender(<DeleteAccountModal isOpen={true} onClose={vi.fn()} onConfirm={vi.fn()} />);

    expect(screen.getByTestId('delete-account-confirm-btn')).toBeDisabled();
  });

  it('cancel button calls onClose without calling onConfirm', () => {
    const onClose = vi.fn();
    const onConfirm = vi.fn();
    render(<DeleteAccountModal isOpen={true} onClose={onClose} onConfirm={onConfirm} />);

    fireEvent.click(screen.getByTestId('delete-account-cancel-btn'));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
