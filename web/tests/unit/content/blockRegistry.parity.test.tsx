import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import { render } from '@testing-library/react';
import { renderBlock } from '../../../src/components/content/blocks/blockRegistry';
import type { DocBlock, DocumentModel } from '../../../src/components/content/blocks/types';

/**
 * The Phase 2 parity gate (docs/plans/write-the-phased-plan-wobbly-pancake.md): every block
 * type in the committed fixture must render without throwing, either via its own registered
 * component or the D1 fallback-to-paragraph path. The Compose side
 * (shared/src/commonTest/.../ui/content/BlockRegistryParityTest.kt) runs the identical check
 * against the identical fixture -- adding a block type to the fixture without a renderer on
 * either platform breaks that platform's build.
 */
describe('block registry parity gate', () => {
  const fixturePath = path.resolve(__dirname, '../../../../content/__fixtures__/blocks.json');
  const fixture = JSON.parse(readFileSync(fixturePath, 'utf-8')) as DocumentModel;
  const fixtureBlocks: DocBlock[] = fixture.sections.flatMap((s) => s.blocks);

  it('fixture is non-empty and covers more than one type', () => {
    const types = new Set(fixtureBlocks.map((b) => b.type));
    expect(fixtureBlocks.length).toBeGreaterThan(0);
    expect(types.size).toBeGreaterThan(1);
  });

  it.each(fixtureBlocks.map((b) => [b.type, b] as const))('renders fixture block type "%s"', (_type, block) => {
    const { Component, block: resolved } = renderBlock(block);
    expect(() => render(<Component block={resolved} />)).not.toThrow();
  });

  it('falls back to paragraph for an unrecognised type without throwing (D1)', () => {
    const unknown: DocBlock = { type: 'somethingNoRendererKnowsAboutYet', text: 'still readable' } as DocBlock;
    const { Component, block } = renderBlock(unknown);
    expect(block.type).toBe('paragraph');
    const { getByText } = render(<Component block={block} />);
    expect(getByText('still readable')).toBeTruthy();
  });
});
