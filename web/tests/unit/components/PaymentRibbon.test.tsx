import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PaymentRibbon } from '../../../src/components/practice/PaymentRibbon';
import { strings } from '../../../src/constants/strings';

describe('PaymentRibbon Component', () => {
  it('should render the payment ribbon header and 3 subscription cards', () => {
    render(<PaymentRibbon />);

    expect(screen.getByTestId('payment-ribbon')).toBeInTheDocument();
    expect(screen.getByText(strings.subscription.ribbonTitle)).toBeInTheDocument();
    expect(screen.getByTestId('tier-card-FREE')).toBeInTheDocument();
    expect(screen.getByTestId('tier-card-PRO')).toBeInTheDocument();
    expect(screen.getByTestId('tier-card-PREMIUM')).toBeInTheDocument();
  });

  it('should display correct titles, badges, and prices for all 3 tiers', () => {
    render(<PaymentRibbon />);

    expect(screen.getByText(strings.subscription.ribbonFreeTitle)).toBeInTheDocument();
    expect(screen.getByText(strings.subscription.ribbonProTitle)).toBeInTheDocument();
    expect(screen.getByText(strings.subscription.ribbonPremiumTitle)).toBeInTheDocument();

    expect(screen.getByText(strings.subscription.ribbonFreeBadge)).toBeInTheDocument();
    expect(screen.getByText(strings.subscription.ribbonProBadge)).toBeInTheDocument();
    expect(screen.getByText(strings.subscription.ribbonPremiumBadge)).toBeInTheDocument();

    expect(screen.getByText(strings.subscription.ribbonFreePrice)).toBeInTheDocument();
    expect(screen.getByText(strings.subscription.ribbonProPrice)).toBeInTheDocument();
    expect(screen.getByText(strings.subscription.ribbonPremiumPrice)).toBeInTheDocument();
  });

  it('should mark Free tier as active by default and reflect active status button', () => {
    render(<PaymentRibbon currentTier="FREE" />);

    const freeBtn = screen.getByTestId('upgrade-button-FREE');
    expect(freeBtn).toHaveTextContent(strings.subscription.currentPlan);

    const proBtn = screen.getByTestId('upgrade-button-PRO');
    expect(proBtn).toHaveTextContent(strings.subscription.ribbonProButton);
  });

  it('should reflect active status when Pro is current tier', () => {
    render(<PaymentRibbon currentTier="PRO" />);

    const proBtn = screen.getByTestId('upgrade-button-PRO');
    expect(proBtn).toHaveTextContent(strings.subscription.currentPlan);
  });

  it('should trigger onSelectTier and onUpgradeClick when an inactive tier is clicked', () => {
    const onSelectTier = vi.fn();
    const onUpgradeClick = vi.fn();

    render(
      <PaymentRibbon
        currentTier="FREE"
        onSelectTier={onSelectTier}
        onUpgradeClick={onUpgradeClick}
      />
    );

    const proBtn = screen.getByTestId('upgrade-button-PRO');
    fireEvent.click(proBtn);

    expect(onSelectTier).toHaveBeenCalledWith('PRO');
    expect(onUpgradeClick).toHaveBeenCalledWith('PRO');
  });

  it('should enforce min-h-[44px] touch target class on action buttons', () => {
    render(<PaymentRibbon />);

    const freeBtn = screen.getByTestId('upgrade-button-FREE');
    const proBtn = screen.getByTestId('upgrade-button-PRO');
    const premiumBtn = screen.getByTestId('upgrade-button-PREMIUM');

    expect(freeBtn.className).toContain('min-h-[44px]');
    expect(proBtn.className).toContain('min-h-[44px]');
    expect(premiumBtn.className).toContain('min-h-[44px]');
  });

  it('should use adaptive background classes for Pro and Premium tier cards in light and dark mode', () => {
    render(<PaymentRibbon />);

    const proCard = screen.getByTestId('tier-card-PRO');
    const premiumCard = screen.getByTestId('tier-card-PREMIUM');

    expect(proCard.className).toContain('dark:via-slate-900');
    expect(premiumCard.className).toContain('dark:via-slate-900');
  });
});
