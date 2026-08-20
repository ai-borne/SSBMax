import { DesignTokens } from '@/generated/contracts';

/**
 * Design tokens (Phase 7, docs/plans/CrossPlatform_SSOT): re-exported from
 * the generated contract (contracts/tokens.yaml is the SSOT, shared with
 * KMP's `SsbContracts.DesignTokens`). Edit contracts/tokens.yaml and run
 * `node scripts/generate-contracts.js`, not this file.
 */
export const themeColors = {
  dark: DesignTokens.dark,
  light: DesignTokens.light,
} as const;

export type ThemeMode = 'dark' | 'light' | 'system';
