import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { PracticeTestsPage } from '../../../src/components/practice/PracticeTestsPage';
import { strings } from '../../../src/constants/strings';

const submitPIQTestMock = vi.fn().mockResolvedValue({ success: true, submissionId: 'piq-sub-1' });
vi.mock('../../../src/services/SubmissionService', () => ({
  SubmissionService: vi.fn().mockImplementation(() => ({ submitPIQTest: submitPIQTestMock }))
}));

describe('PracticeTestsPage Component', () => {
  it('renders header, search bar, OLQ radar SVG, payment ribbon, and 5-day accordions', () => {
    render(<PracticeTestsPage />);

    expect(screen.getByTestId('practice-tests-page')).toBeInTheDocument();
    expect(screen.getByText(strings.practice.title)).toBeInTheDocument();
    expect(screen.getByTestId('search-input')).toBeInTheDocument();
    expect(screen.getByTestId('olq-radar-svg')).toBeInTheDocument();
    expect(screen.getByTestId('payment-ribbon')).toBeInTheDocument();

    expect(screen.getByTestId('test-day-accordion-1')).toBeInTheDocument();
    expect(screen.getByTestId('test-day-accordion-2')).toBeInTheDocument();
    expect(screen.getByTestId('test-day-accordion-3-4')).toBeInTheDocument();
    expect(screen.getByTestId('test-day-accordion-5')).toBeInTheDocument();
  });

  it('renders test simulator cards including Stage I, Stage II, and GTO tasks', () => {
    render(<PracticeTestsPage userTier="PRO" />);

    expect(screen.getByTestId('test-simulator-card-oir')).toBeInTheDocument();
    expect(screen.getByTestId('test-simulator-card-piq')).toBeInTheDocument();
    expect(screen.getByTestId('test-simulator-card-gd')).toBeInTheDocument();
    expect(screen.getByTestId('test-simulator-card-pgt')).toBeInTheDocument();
    expect(screen.getByTestId('test-simulator-card-interview')).toBeInTheDocument();
  });

  it('filters tests based on search query', () => {
    render(<PracticeTestsPage />);

    const searchInput = screen.getByTestId('search-input');
    fireEvent.change(searchInput, { target: { value: 'Group Discussion' } });

    expect(screen.getByTestId('test-day-accordion-3-4')).toBeInTheDocument();
    expect(screen.getByTestId('test-simulator-card-gd')).toBeInTheDocument();
    expect(screen.queryByTestId('test-day-accordion-1')).not.toBeInTheDocument();
  });

  it('triggers onStartTest for free OIR test when clicked', () => {
    const handleStartTest = vi.fn();
    render(<PracticeTestsPage userTier="FREE" onStartTest={handleStartTest} />);

    const launchOirBtn = screen.getByTestId('launch-button-oir');
    fireEvent.click(launchOirBtn);

    expect(handleStartTest).toHaveBeenCalledWith('oir');
  });

  it('opens digital PIQ form wizard when PIQ card is clicked', () => {
    render(<PracticeTestsPage userTier="FREE" />);

    const launchPiqBtn = screen.getByTestId('launch-button-piq');
    fireEvent.click(launchPiqBtn);

    expect(screen.getByTestId('piq-wizard-container')).toBeInTheDocument();
    expect(screen.getByTestId('piq-pii-warning')).toBeInTheDocument();
  });

  it('saves PIQ data via SubmissionService when the wizard is finished -- this is the real, reachable PIQWizardContainer instance (App.tsx had a dead, unreachable duplicate that never received onStartTest)', async () => {
    render(<PracticeTestsPage userTier="FREE" />);
    fireEvent.click(screen.getByTestId('launch-button-piq'));

    fireEvent.click(screen.getByText(strings.common.next));
    fireEvent.click(screen.getByText(strings.common.next));
    fireEvent.click(screen.getByTestId('save-piq-button'));

    expect(submitPIQTestMock).toHaveBeenCalledTimes(1);
    expect(submitPIQTestMock.mock.calls[0][0]).toMatchObject({ targetBoard: expect.any(String), entryType: expect.any(String) });
  });

  it('opens ProUpgradeGateModal for locked test when clicked by FREE-tier user', () => {
    const handleUpgrade = vi.fn();
    render(<PracticeTestsPage userTier="FREE" onUpgrade={handleUpgrade} />);

    const launchTatBtn = screen.getByTestId('launch-button-tat');
    fireEvent.click(launchTatBtn);

    expect(screen.getByTestId('pro-upgrade-gate-modal')).toBeInTheDocument();

    const upgradeBtn = screen.getByTestId('upgrade-pro-cta-button');
    fireEvent.click(upgradeBtn);

    expect(handleUpgrade).toHaveBeenCalledTimes(1);
  });

  it('triggers onUpgrade callback when upgrading via Payment Ribbon', () => {
    const handleUpgrade = vi.fn();
    render(<PracticeTestsPage userTier="FREE" onUpgrade={handleUpgrade} />);

    const upgradeOfficerBtn = screen.getByTestId('upgrade-button-PRO');
    fireEvent.click(upgradeOfficerBtn);

    expect(handleUpgrade).toHaveBeenCalledWith('PRO');
  });

  it('locks a test whose monthly quota is exhausted even though the tier otherwise qualifies (real usage, not just a tier gate)', () => {
    render(<PracticeTestsPage userTier="PRO" usage={{ oirTestsUsed: 5, ppdtTestsUsed: 0, piqTestsUsed: 0, tatTestsUsed: 0, watTestsUsed: 0, srtTestsUsed: 0, sdTestsUsed: 0, gtoTestsUsed: 0, interviewTestsUsed: 0 }} />);

    // PRO's OIR bucket limit is 5 (contracts/subscription.yaml) — fully consumed.
    const launchOirBtn = screen.getByTestId('launch-button-oir');
    expect(launchOirBtn).toHaveTextContent(strings.gto.limitReached);
  });

  it('shows remaining monthly attempts on an unlocked card once usage is partially consumed', () => {
    render(<PracticeTestsPage userTier="PRO" usage={{ oirTestsUsed: 2, ppdtTestsUsed: 0, piqTestsUsed: 0, tatTestsUsed: 0, watTestsUsed: 0, srtTestsUsed: 0, sdTestsUsed: 0, gtoTestsUsed: 0, interviewTestsUsed: 0 }} />);

    const oirCard = screen.getByTestId('test-simulator-card-oir');
    expect(oirCard).toHaveTextContent('3 left');
  });
});

