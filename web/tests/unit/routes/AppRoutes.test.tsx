// Phase 2 (docs/plans/i-just-watched-a-nested-russell.md), HIGH 3: react-router must own
// ONLY the new content paths. Any other path -- '/', an unmatched path, or a path search
// bookmarked pre-Phase-2 -- must still fall through to the unchanged `App`, since that's
// what keeps `?tab=` deep links, PWA `start_url`, and OAuth redirect URIs unbroken.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AppRoutes } from '../../../src/routes/AppRoutes';
import { CONTENT_ROUTES } from '../../../src/routes/contentRoutes';
import { ContentRepository } from '../../../src/repositories/ContentRepository';

describe('AppRoutes', () => {
  beforeEach(() => {
    // App.tsx eagerly constructs an OIRTestViewModel; mirrors
    // tests/unit/components/App.test.tsx's setup so mounting App here doesn't hit a real
    // ContentRepository call.
    vi.spyOn(ContentRepository.prototype, 'getOIRQuestions').mockResolvedValue({
      id: 'batch_0',
      batchIndex: 0,
      totalItems: 0,
      items: [],
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('falls through to the existing App at "/" (the shared root, unchanged)', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <AppRoutes />
      </MemoryRouter>
    );
    expect(screen.getByTestId('hero-section')).toBeInTheDocument();
  });

  it('falls through to App for a path CONTENT_ROUTES does not own', () => {
    render(
      <MemoryRouter initialEntries={['/some/unrelated/path']}>
        <AppRoutes />
      </MemoryRouter>
    );
    expect(screen.getByTestId('hero-section')).toBeInTheDocument();
  });

  it('renders the App root even with a legacy ?tab= query string (deep links unbroken)', () => {
    render(
      <MemoryRouter initialEntries={['/?tab=tests']}>
        <AppRoutes />
      </MemoryRouter>
    );
    expect(screen.getByTestId('hero-section')).toBeInTheDocument();
  });

  for (const { path } of CONTENT_ROUTES) {
    it(`renders the content page, not App, at ${path}`, () => {
      render(
        <MemoryRouter initialEntries={[path]}>
          <AppRoutes />
        </MemoryRouter>
      );
      expect(screen.queryByTestId('hero-section')).not.toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    });
  }

  it('renders FaqPage, not App, at /faq (Phase 7)', () => {
    render(
      <MemoryRouter initialEntries={['/faq']}>
        <AppRoutes />
      </MemoryRouter>
    );
    expect(screen.queryByTestId('hero-section')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
  });
});
