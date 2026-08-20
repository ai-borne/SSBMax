import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { DiagnosticModal } from '../../../src/components/onboarding/DiagnosticModal';
import { strings } from '../../../src/constants/strings';

describe('DiagnosticModal Component', () => {
  it('does not render when isOpen is false', () => {
    const { container } = render(
      <DiagnosticModal isOpen={false} onClose={vi.fn()} onSaveProfile={vi.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders modal with default title and options when isOpen is true', () => {
    render(<DiagnosticModal isOpen={true} onClose={vi.fn()} onSaveProfile={vi.fn()} />);

    expect(screen.getByText(strings.diagnostic.title)).toBeInTheDocument();
    expect(screen.getByTestId('board-army')).toBeInTheDocument();
    expect(screen.getByTestId('entry-select')).toBeInTheDocument();
    expect(screen.getByTestId('save-modal-btn')).toBeInTheDocument();
  });

  it('allows user to change target board and submit profile', () => {
    const handleSave = vi.fn();
    const handleClose = vi.fn();

    render(<DiagnosticModal isOpen={true} onClose={handleClose} onSaveProfile={handleSave} />);

    // Select Navy Board
    const navyBtn = screen.getByTestId('board-navy');
    fireEvent.click(navyBtn);

    // Select AFCAT Entry
    const entrySelect = screen.getByTestId('entry-select');
    fireEvent.change(entrySelect, { target: { value: 'afcat' } });

    // Submit form
    const saveBtn = screen.getByTestId('save-modal-btn');
    fireEvent.click(saveBtn);

    expect(handleSave).toHaveBeenCalledWith({
      targetBoard: 'navy',
      entryStream: 'afcat',
      prepLevel: 'beginner',
      targetMonth: '2026-10',
      isCompleted: true
    });
    expect(handleClose).toHaveBeenCalled();
  });

  it('calls onClose when close or skip button is clicked', () => {
    const handleClose = vi.fn();
    render(<DiagnosticModal isOpen={true} onClose={handleClose} onSaveProfile={vi.fn()} />);

    const closeBtn = screen.getByTestId('close-modal-btn');
    fireEvent.click(closeBtn);

    expect(handleClose).toHaveBeenCalledTimes(1);

    const cancelBtn = screen.getByTestId('cancel-modal-btn');
    fireEvent.click(cancelBtn);

    expect(handleClose).toHaveBeenCalledTimes(2);
  });

  it('applies Level 2 elevation styling to modal container', () => {
    render(<DiagnosticModal isOpen={true} onClose={vi.fn()} onSaveProfile={vi.fn()} />);

    const modal = screen.getByTestId('diagnostic-modal');
    expect(modal.className).toContain('dark:bg-slate-800/95');
    expect(modal.className).toContain('dark:border-slate-700/80');
  });
});
