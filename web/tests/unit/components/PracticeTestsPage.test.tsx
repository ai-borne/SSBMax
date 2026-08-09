import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { PracticeTestsPage } from '../../../src/components/practice/PracticeTestsPage';
import { strings } from '../../../src/constants/strings';

describe('PracticeTestsPage Component', () => {
  it('renders title, search bar, OLQ radar SVG, and test catalog cards', () => {
    render(<PracticeTestsPage />);

    expect(screen.getByTestId('practice-tests-page')).toBeInTheDocument();
    expect(screen.getByText(strings.practice.title)).toBeInTheDocument();
    expect(screen.getByTestId('search-input')).toBeInTheDocument();
    expect(screen.getByTestId('olq-radar-svg')).toBeInTheDocument();
    expect(screen.getByTestId('test-card-oir')).toBeInTheDocument();
    expect(screen.getByTestId('test-card-piq')).toBeInTheDocument();
    expect(screen.getByTestId('test-card-tat')).toBeInTheDocument();
  });

  it('filters tests based on search query', () => {
    render(<PracticeTestsPage />);

    const searchInput = screen.getByTestId('search-input');
    fireEvent.change(searchInput, { target: { value: 'Reasoning' } });

    expect(screen.getByTestId('test-card-oir')).toBeInTheDocument();
    expect(screen.queryByTestId('test-card-tat')).not.toBeInTheDocument();
  });

  it('triggers onStartTest for free OIR test when clicked', () => {
    const handleStartTest = vi.fn();
    render(<PracticeTestsPage isPaidMember={false} onStartTest={handleStartTest} />);

    const launchOirBtn = screen.getByTestId('launch-test-oir');
    fireEvent.click(launchOirBtn);

    expect(handleStartTest).toHaveBeenCalledWith('oir');
  });

  it('opens digital PIQ form wizard when PIQ card is clicked', () => {
    render(<PracticeTestsPage isPaidMember={false} />);

    const launchPiqBtn = screen.getByTestId('launch-test-piq');
    fireEvent.click(launchPiqBtn);

    expect(screen.getByTestId('piq-wizard-container')).toBeInTheDocument();
    expect(screen.getByTestId('piq-pii-warning')).toBeInTheDocument();
  });

  it('opens ProUpgradeGateModal for locked test when clicked by guest user', () => {
    const handleUpgrade = vi.fn();
    render(<PracticeTestsPage isPaidMember={false} onUpgrade={handleUpgrade} />);

    const launchTatBtn = screen.getByTestId('launch-test-tat');
    fireEvent.click(launchTatBtn);

    expect(screen.getByTestId('pro-upgrade-gate-modal')).toBeInTheDocument();

    const upgradeBtn = screen.getByTestId('upgrade-pro-cta-button');
    fireEvent.click(upgradeBtn);

    expect(handleUpgrade).toHaveBeenCalledTimes(1);
  });
});
