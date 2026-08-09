import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PaymentRibbon } from '../../../src/components/practice/PaymentRibbon';
import { strings } from '../../../src/constants/strings';

describe('PaymentRibbon Component', () => {
  it('should render the payment ribbon header and 3 subscription cards', () => {
    render(<PaymentRibbon />);

    expect(screen.getByTestId('payment-ribbon')).toBeInTheDocument();
    expect(screen.getByText(strings.subscription.ribbonTitle)).toBeInTheDocument();
    expect(screen.getByTestId('tier-card-cadet')).toBeInTheDocument();
    expect(screen.getByTestId('tier-card-officer')).toBeInTheDocument();
    expect(screen.getByTestId('tier-card-command')).toBeInTheDocument();
  });

  it('should display correct titles, badges, and prices for all 3 tiers', () => {
    render(<PaymentRibbon />);

    expect(screen.getByText(strings.subscription.cadetTitle)).toBeInTheDocument();
    expect(screen.getByText(strings.subscription.officerTitle)).toBeInTheDocument();
    expect(screen.getByText(strings.subscription.commandTitle)).toBeInTheDocument();

    expect(screen.getByText(strings.subscription.cadetBadge)).toBeInTheDocument();
    expect(screen.getByText(strings.subscription.officerBadge)).toBeInTheDocument();
    expect(screen.getByText(strings.subscription.commandBadge)).toBeInTheDocument();

    expect(screen.getByText(strings.subscription.cadetPrice)).toBeInTheDocument();
    expect(screen.getByText(strings.subscription.officerPrice)).toBeInTheDocument();
    expect(screen.getByText(strings.subscription.commandPrice)).toBeInTheDocument();
  });

  it('should mark Cadet tier as active by default and reflect active status button', () => {
    render(<PaymentRibbon currentTier="cadet" />);

    const cadetBtn = screen.getByTestId('upgrade-button-cadet');
    expect(cadetBtn).toHaveTextContent(strings.subscription.currentPlan);

    const officerBtn = screen.getByTestId('upgrade-button-officer');
    expect(officerBtn).toHaveTextContent(strings.subscription.officerButton);
  });

  it('should reflect active status when Officer Pass is current tier', () => {
    render(<PaymentRibbon currentTier="officer" />);

    const officerBtn = screen.getByTestId('upgrade-button-officer');
    expect(officerBtn).toHaveTextContent(strings.subscription.currentPlan);
  });

  it('should trigger onSelectTier and onUpgradeClick when an inactive tier is clicked', () => {
    const onSelectTier = vi.fn();
    const onUpgradeClick = vi.fn();

    render(
      <PaymentRibbon
        currentTier="cadet"
        onSelectTier={onSelectTier}
        onUpgradeClick={onUpgradeClick}
      />
    );

    const officerBtn = screen.getByTestId('upgrade-button-officer');
    fireEvent.click(officerBtn);

    expect(onSelectTier).toHaveBeenCalledWith('officer');
    expect(onUpgradeClick).toHaveBeenCalledWith('officer');
  });

  it('should enforce min-h-[44px] touch target class on action buttons', () => {
    render(<PaymentRibbon />);

    const cadetBtn = screen.getByTestId('upgrade-button-cadet');
    const officerBtn = screen.getByTestId('upgrade-button-officer');
    const commandBtn = screen.getByTestId('upgrade-button-command');

    expect(cadetBtn.className).toContain('min-h-[44px]');
    expect(officerBtn.className).toContain('min-h-[44px]');
    expect(commandBtn.className).toContain('min-h-[44px]');
  });
});
