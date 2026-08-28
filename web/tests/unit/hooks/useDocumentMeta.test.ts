// Phase 3 (docs/plans/i-just-watched-a-nested-russell.md): asserts the hook actually mutates
// document.head rather than just computing values -- a crawler reads the DOM's <head>, not
// React state, so "the hook returns the right object" would not be evidence this works.
import { describe, it, expect, afterEach } from 'vitest';
import { renderHook, cleanup } from '@testing-library/react';
import { useDocumentMeta } from '../../../src/hooks/useDocumentMeta';

function metaContent(attr: 'name' | 'property', key: string): string | null {
  return document.head.querySelector(`meta[${attr}="${key}"]`)?.getAttribute('content') ?? null;
}

describe('useDocumentMeta', () => {
  afterEach(() => {
    cleanup();
    document.head.querySelectorAll('meta[name="description"], meta[property^="og:"], meta[name^="twitter:"], link[rel="canonical"]').forEach((el) => el.remove());
    document.title = '';
  });

  it('sets document.title and the description/OG/Twitter/canonical tags', () => {
    renderHook(() =>
      useDocumentMeta({
        title: 'SSB OIR Test Preparation Guide | SSBMax',
        description: 'How to prepare for the OIR test.',
        url: 'https://ssbmax.in/study/ssb-oir-test-preparation',
      })
    );

    expect(document.title).toBe('SSB OIR Test Preparation Guide | SSBMax');
    expect(metaContent('name', 'description')).toBe('How to prepare for the OIR test.');
    expect(metaContent('property', 'og:title')).toBe('SSB OIR Test Preparation Guide | SSBMax');
    expect(metaContent('property', 'og:description')).toBe('How to prepare for the OIR test.');
    expect(metaContent('property', 'og:url')).toBe('https://ssbmax.in/study/ssb-oir-test-preparation');
    expect(metaContent('name', 'twitter:card')).toBe('summary');
    expect(document.head.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe(
      'https://ssbmax.in/study/ssb-oir-test-preparation'
    );
  });

  it('updates existing tags in place rather than duplicating them on a second render', () => {
    const { rerender } = renderHook((props) => useDocumentMeta(props), {
      initialProps: { title: 'A', description: 'Desc A', url: 'https://ssbmax.in/a' },
    });
    rerender({ title: 'B', description: 'Desc B', url: 'https://ssbmax.in/b' });

    expect(document.title).toBe('B');
    expect(metaContent('name', 'description')).toBe('Desc B');
    expect(document.head.querySelectorAll('meta[name="description"]').length).toBe(1);
  });
});
