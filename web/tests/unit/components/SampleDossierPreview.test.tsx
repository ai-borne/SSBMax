import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SampleDossierPreview } from '../../../src/components/landing/SampleDossierPreview';
import { strings } from '../../../src/constants/strings';

describe('SampleDossierPreview Component', () => {
  it('renders inline SVG 4-Factor radar chart and response diff card', () => {
    render(<SampleDossierPreview />);

    expect(screen.getByTestId('sample-dossier-preview')).toBeInTheDocument();
    expect(screen.getByText(strings.radar.title)).toBeInTheDocument();
    expect(screen.getByTestId('inline-svg-radar')).toBeInTheDocument();
    expect(screen.getByTestId('response-diff-card')).toBeInTheDocument();
  });

  it('toggles 15-OLQ detailed breakdown grid when toggle button is clicked', () => {
    render(<SampleDossierPreview />);

    const toggleBtn = screen.getByTestId('toggle-15-olq-btn');
    expect(screen.queryByTestId('detailed-15-olq-grid')).not.toBeInTheDocument();

    fireEvent.click(toggleBtn);
    expect(screen.getByTestId('detailed-15-olq-grid')).toBeInTheDocument();

    fireEvent.click(toggleBtn);
    expect(screen.queryByTestId('detailed-15-olq-grid')).not.toBeInTheDocument();
  });

  it('renders response-diff-card with Level 2 elevation classes and SSOT strings', () => {
    render(<SampleDossierPreview />);
    const diffCard = screen.getByTestId('response-diff-card');
    
    expect(diffCard.className).toContain('bg-slate-100');
    expect(diffCard.className).toContain('dark:bg-slate-800/90');
    expect(diffCard.className).toContain('dark:border-slate-700/80');
    expect(screen.getByText(strings.radar.diffTitle)).toBeInTheDocument();
    expect(screen.getByText(strings.radar.proofBadge)).toBeInTheDocument();
  });
});

