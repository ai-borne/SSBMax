import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { PracticeTestsPage } from '../../../src/components/practice/PracticeTestsPage';
import { strings } from '../../../src/constants/strings';

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
    render(<PracticeTestsPage userTier="officer" />);

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
    render(<PracticeTestsPage userTier="cadet" onStartTest={handleStartTest} />);

    const launchOirBtn = screen.getByTestId('launch-button-oir');
    fireEvent.click(launchOirBtn);

    expect(handleStartTest).toHaveBeenCalledWith('oir');
  });

  it('opens digital PIQ form wizard when PIQ card is clicked', () => {
    render(<PracticeTestsPage userTier="cadet" />);

    const launchPiqBtn = screen.getByTestId('launch-button-piq');
    fireEvent.click(launchPiqBtn);

    expect(screen.getByTestId('piq-wizard-container')).toBeInTheDocument();
    expect(screen.getByTestId('piq-pii-warning')).toBeInTheDocument();
  });

  it('opens ProUpgradeGateModal for locked test when clicked by cadet user', () => {
    const handleUpgrade = vi.fn();
    render(<PracticeTestsPage userTier="cadet" onUpgrade={handleUpgrade} />);

    const launchTatBtn = screen.getByTestId('launch-button-tat');
    fireEvent.click(launchTatBtn);

    expect(screen.getByTestId('pro-upgrade-gate-modal')).toBeInTheDocument();

    const upgradeBtn = screen.getByTestId('upgrade-pro-cta-button');
    fireEvent.click(upgradeBtn);

    expect(handleUpgrade).toHaveBeenCalledTimes(1);
  });

  it('triggers onUpgrade callback when upgrading via Payment Ribbon', () => {
    const handleUpgrade = vi.fn();
    render(<PracticeTestsPage userTier="cadet" onUpgrade={handleUpgrade} />);

    const upgradeOfficerBtn = screen.getByTestId('upgrade-button-officer');
    fireEvent.click(upgradeOfficerBtn);

    expect(handleUpgrade).toHaveBeenCalledWith('officer');
  });
});

