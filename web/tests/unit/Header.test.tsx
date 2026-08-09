import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { Header } from '../../src/components/common/Header';
import { strings } from '../../src/constants/strings';

describe('Header component', () => {
  beforeEach(() => {
    localStorage.setItem('theme', 'dark');
    document.documentElement.classList.add('dark');
  });

  afterEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('dark');
  });

  it('renders header title and tagline from string resources', () => {
    render(<Header />);
    expect(screen.getByText(strings.header.title)).toBeInTheDocument();
    expect(screen.getByText(strings.header.tagline)).toBeInTheDocument();
  });

  it('renders online status badge', () => {
    render(<Header />);
    const badge = screen.getByTestId('online-status-badge');
    expect(badge).toBeInTheDocument();
  });

  it('toggles theme when theme toggle button is clicked', () => {
    render(<Header />);
    const toggleButton = screen.getByTestId('theme-toggle-button');
    expect(toggleButton).toBeInTheDocument();

    fireEvent.click(toggleButton);
    expect(localStorage.getItem('theme')).not.toBe('dark');
  });

  it('renders PWA install button when beforeinstallprompt event is fired', async () => {
    render(<Header />);
    expect(screen.queryByText(strings.header.installPwa)).not.toBeInTheDocument();

    const mockPrompt = vi.fn().mockResolvedValue(undefined);
    const installEvent = new Event('beforeinstallprompt');
    Object.defineProperty(installEvent, 'prompt', { value: mockPrompt });
    Object.defineProperty(installEvent, 'userChoice', { value: Promise.resolve({ outcome: 'accepted' }) });

    await act(async () => {
      window.dispatchEvent(installEvent);
    });

    const installButton = screen.getByText(strings.header.installPwa);
    expect(installButton).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(installButton);
    });
    expect(mockPrompt).toHaveBeenCalledTimes(1);
  });
});
