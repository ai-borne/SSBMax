import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DeveloperSettingsCard } from '../../../src/components/settings/DeveloperSettingsCard';
import { strings } from '../../../src/constants/strings';

describe('DeveloperSettingsCard Component', () => {
  it('renders all 4 tier override chips', () => {
    render(<DeveloperSettingsCard devTierOverride="real" onSelectOverride={vi.fn()} />);

    expect(screen.getByTestId('dev-settings-card')).toBeInTheDocument();
    expect(screen.getByTestId('dev-tier-chip-real')).toHaveTextContent(strings.devSettings.realLabel);
    expect(screen.getByTestId('dev-tier-chip-cadet')).toHaveTextContent(strings.devSettings.freeLabel);
    expect(screen.getByTestId('dev-tier-chip-officer')).toHaveTextContent(strings.devSettings.proLabel);
    expect(screen.getByTestId('dev-tier-chip-command')).toHaveTextContent(strings.devSettings.commandLabel);
  });

  it('does not show the active override banner when following the real tier', () => {
    render(<DeveloperSettingsCard devTierOverride="real" onSelectOverride={vi.fn()} />);

    expect(screen.queryByTestId('dev-override-active-banner')).not.toBeInTheDocument();
    expect(screen.getByTestId('dev-tier-chip-real')).toHaveAttribute('aria-pressed', 'true');
  });

  it('shows the active override banner and marks the selected chip pressed when a tier is forced', () => {
    render(<DeveloperSettingsCard devTierOverride="command" onSelectOverride={vi.fn()} />);

    expect(screen.getByTestId('dev-override-active-banner')).toBeInTheDocument();
    expect(screen.getByTestId('dev-override-active-banner')).toHaveTextContent(strings.devSettings.commandLabel);
    expect(screen.getByTestId('dev-tier-chip-command')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('dev-tier-chip-real')).toHaveAttribute('aria-pressed', 'false');
  });

  it('calls onSelectOverride with the chosen tier when a chip is clicked', () => {
    const onSelectOverride = vi.fn();
    render(<DeveloperSettingsCard devTierOverride="real" onSelectOverride={onSelectOverride} />);

    fireEvent.click(screen.getByTestId('dev-tier-chip-officer'));
    expect(onSelectOverride).toHaveBeenCalledWith('officer');

    fireEvent.click(screen.getByTestId('dev-tier-chip-command'));
    expect(onSelectOverride).toHaveBeenCalledWith('command');

    fireEvent.click(screen.getByTestId('dev-tier-chip-cadet'));
    expect(onSelectOverride).toHaveBeenCalledWith('cadet');

    fireEvent.click(screen.getByTestId('dev-tier-chip-real'));
    expect(onSelectOverride).toHaveBeenCalledWith('real');
  });
});
