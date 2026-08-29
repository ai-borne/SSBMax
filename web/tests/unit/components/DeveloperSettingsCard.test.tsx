import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DeveloperSettingsCard } from '../../../src/components/settings/DeveloperSettingsCard';
import { strings } from '../../../src/constants/strings';

describe('DeveloperSettingsCard Component', () => {
  it('renders all 4 tier override chips', () => {
    render(<DeveloperSettingsCard devTierOverride="FOLLOW_REAL" onSelectOverride={vi.fn()} />);

    expect(screen.getByTestId('dev-settings-card')).toBeInTheDocument();
    expect(screen.getByTestId('dev-tier-chip-FOLLOW_REAL')).toHaveTextContent(strings.devSettings.realLabel);
    expect(screen.getByTestId('dev-tier-chip-FORCE_FREE')).toHaveTextContent(strings.devSettings.freeLabel);
    expect(screen.getByTestId('dev-tier-chip-FORCE_PRO')).toHaveTextContent(strings.devSettings.proLabel);
    expect(screen.getByTestId('dev-tier-chip-FORCE_PREMIUM')).toHaveTextContent(strings.devSettings.premiumLabel);
  });

  it('does not show the active override banner when following the real tier', () => {
    render(<DeveloperSettingsCard devTierOverride="FOLLOW_REAL" onSelectOverride={vi.fn()} />);

    expect(screen.queryByTestId('dev-override-active-banner')).not.toBeInTheDocument();
    expect(screen.getByTestId('dev-tier-chip-FOLLOW_REAL')).toHaveAttribute('aria-pressed', 'true');
  });

  it('shows the active override banner and marks the selected chip pressed when a tier is forced', () => {
    render(<DeveloperSettingsCard devTierOverride="FORCE_PREMIUM" onSelectOverride={vi.fn()} />);

    expect(screen.getByTestId('dev-override-active-banner')).toBeInTheDocument();
    expect(screen.getByTestId('dev-override-active-banner')).toHaveTextContent(strings.devSettings.premiumLabel);
    expect(screen.getByTestId('dev-tier-chip-FORCE_PREMIUM')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('dev-tier-chip-FOLLOW_REAL')).toHaveAttribute('aria-pressed', 'false');
  });

  it('calls onSelectOverride with the chosen tier when a chip is clicked', () => {
    const onSelectOverride = vi.fn();
    render(<DeveloperSettingsCard devTierOverride="FOLLOW_REAL" onSelectOverride={onSelectOverride} />);

    fireEvent.click(screen.getByTestId('dev-tier-chip-FORCE_PRO'));
    expect(onSelectOverride).toHaveBeenCalledWith('FORCE_PRO');

    fireEvent.click(screen.getByTestId('dev-tier-chip-FORCE_PREMIUM'));
    expect(onSelectOverride).toHaveBeenCalledWith('FORCE_PREMIUM');

    fireEvent.click(screen.getByTestId('dev-tier-chip-FORCE_FREE'));
    expect(onSelectOverride).toHaveBeenCalledWith('FORCE_FREE');

    fireEvent.click(screen.getByTestId('dev-tier-chip-FOLLOW_REAL'));
    expect(onSelectOverride).toHaveBeenCalledWith('FOLLOW_REAL');
  });

  it('does not crash and hides the active override banner when given a value outside the known override set', () => {
    // Regression: a stale/corrupted localStorage value (e.g. from an older build) used to
    // crash the whole Settings page here via a non-null assertion on Array.find().
    render(
      <DeveloperSettingsCard
        devTierOverride={'command' as unknown as Parameters<typeof DeveloperSettingsCard>[0]['devTierOverride']}
        onSelectOverride={vi.fn()}
      />
    );

    expect(screen.getByTestId('dev-settings-card')).toBeInTheDocument();
    expect(screen.queryByTestId('dev-override-active-banner')).not.toBeInTheDocument();
  });
});
