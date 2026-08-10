import { FC, ReactNode } from 'react';
import { CARD_GRID_VARIANTS, CardGridVariant } from '../../constants/cardTokens';

export interface GridCardContainerProps {
  variant?: CardGridVariant;
  dense?: boolean;
  showGridPattern?: boolean;
  className?: string;
  children: ReactNode;
  testId?: string;
  onClick?: () => void;
}

export const GridCardContainer: FC<GridCardContainerProps> = ({
  variant = 'cadet',
  dense = false,
  showGridPattern = false,
  className = '',
  children,
  testId,
  onClick,
}) => {
  const config = CARD_GRID_VARIANTS[variant] ?? CARD_GRID_VARIANTS.cadet;
  const gridPatternClass = dense ? 'ssb-grid-pattern-dense' : 'ssb-grid-pattern';

  return (
    <div
      data-testid={testId}
      onClick={onClick}
      className={`relative overflow-hidden rounded-2xl transition-all duration-200 ${config.container} ${className}`}
    >
      {/* Optional Inner Grid Pattern Overlay */}
      {showGridPattern && (
        <div
          className={`absolute inset-0 pointer-events-none ${gridPatternClass} ${config.gridOpacity}`}
        />
      )}

      {/* Layer 3: Interactive Card Content */}
      <div className="relative z-10">{children}</div>
    </div>
  );
};

export default GridCardContainer;
