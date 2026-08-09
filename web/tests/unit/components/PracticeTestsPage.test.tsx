import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { PracticeTestsPage } from '../../../src/components/practice/PracticeTestsPage';
import { strings } from '../../../src/constants/strings';

describe('PracticeTestsPage Component', () => {
  it('renders title, search bar, and test catalog cards', () => {
    render(<PracticeTestsPage />);

    expect(screen.getByTestId('practice-tests-page')).toBeInTheDocument();
    expect(screen.getByText(strings.practice.title)).toBeInTheDocument();
    expect(screen.getByTestId('search-input')).toBeInTheDocument();
    expect(screen.getByTestId('test-card-oir')).toBeInTheDocument();
    expect(screen.getByTestId('test-card-tat')).toBeInTheDocument();
  });

  it('filters tests based on search query', () => {
    render(<PracticeTestsPage />);

    const searchInput = screen.getByTestId('search-input');
    fireEvent.change(searchInput, { target: { value: 'Reasoning' } });

    expect(screen.getByTestId('test-card-oir')).toBeInTheDocument();
    expect(screen.queryByTestId('test-card-tat')).not.toBeInTheDocument();
  });

  it('triggers onStartTest for free test when clicked by guest user', () => {
    const handleStartTest = vi.fn();
    render(<PracticeTestsPage isPaidMember={false} onStartTest={handleStartTest} />);

    const launchOirBtn = screen.getByTestId('launch-test-oir');
    fireEvent.click(launchOirBtn);

    expect(handleStartTest).toHaveBeenCalledWith('oir');
  });

  it('triggers onUpgrade for pro test when clicked by non-paid user', () => {
    const handleStartTest = vi.fn();
    const handleUpgrade = vi.fn();
    render(
      <PracticeTestsPage
        isPaidMember={false}
        onStartTest={handleStartTest}
        onUpgrade={handleUpgrade}
      />
    );

    const launchTatBtn = screen.getByTestId('launch-test-tat');
    fireEvent.click(launchTatBtn);

    expect(handleUpgrade).toHaveBeenCalledTimes(1);
    expect(handleStartTest).not.toHaveBeenCalled();
  });

  it('triggers onStartTest for pro test when user is paid member', () => {
    const handleStartTest = vi.fn();
    const handleUpgrade = vi.fn();
    render(
      <PracticeTestsPage
        isPaidMember={true}
        onStartTest={handleStartTest}
        onUpgrade={handleUpgrade}
      />
    );

    const launchTatBtn = screen.getByTestId('launch-test-tat');
    fireEvent.click(launchTatBtn);

    expect(handleStartTest).toHaveBeenCalledWith('tat');
    expect(handleUpgrade).not.toHaveBeenCalled();
  });
});
