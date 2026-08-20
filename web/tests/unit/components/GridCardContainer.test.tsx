import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { GridCardContainer } from '../../../src/components/common/GridCardContainer';

describe('GridCardContainer Component', () => {
  it('renders children content correctly', () => {
    render(
      <GridCardContainer testId="test-container">
        <div>Card Content Inner</div>
      </GridCardContainer>
    );

    expect(screen.getByText('Card Content Inner')).toBeInTheDocument();
    expect(screen.getByTestId('test-container')).toBeInTheDocument();
  });

  it('applies standard grid pattern when showGridPattern is true and dense grid when dense prop is true', () => {
    const { container: defaultContainer } = render(
      <GridCardContainer showGridPattern testId="default-card">
        <div>Content</div>
      </GridCardContainer>
    );

    const defaultOverlay = defaultContainer.querySelector('.ssb-grid-pattern');
    expect(defaultOverlay).toBeInTheDocument();

    const { container: denseContainer } = render(
      <GridCardContainer showGridPattern dense testId="dense-card">
        <div>Content</div>
      </GridCardContainer>
    );

    const denseOverlay = denseContainer.querySelector('.ssb-grid-pattern-dense');
    expect(denseOverlay).toBeInTheDocument();
  });

  it('applies tier variant background styles correctly', () => {
    render(
      <GridCardContainer variant="pro" testId="pro-card">
        <div>Officer Content</div>
      </GridCardContainer>
    );

    const card = screen.getByTestId('pro-card');
    expect(card.className).toContain('from-sky-500/10');
    expect(card.className).toContain('border-sky-500');
  });

  it('triggers onClick handler when clicked', () => {
    const handleClick = vi.fn();
    render(
      <GridCardContainer testId="clickable-card" onClick={handleClick}>
        <div>Click Me</div>
      </GridCardContainer>
    );

    fireEvent.click(screen.getByTestId('clickable-card'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});
