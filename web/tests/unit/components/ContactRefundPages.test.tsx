/**
 * A standalone Refund & Cancellation page and a Contact page with email, phone and physical
 * address, both linked from the footer and reachable signed out. Billing is store-only (Apple /
 * Google), so the refund page must describe store refunds and never promise our own or name Razorpay.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ContactPage } from '../../../src/components/legal/ContactPage';
import { RefundPolicy } from '../../../src/components/legal/RefundPolicy';
import { Footer } from '../../../src/components/legal/Footer';
import { CONTACT_DETAILS } from '../../../src/constants/contact';
import { VALID_TABS, getTabFromUrl } from '../../../src/hooks/useTabRouting';
import { strings } from '../../../src/constants/strings';

describe('contact SSOT', () => {
  it('holds the owner email, phone and Pune office address', () => {
    expect(CONTACT_DETAILS.email).toBe('founder@ai-borne.in');
    expect(CONTACT_DETAILS.phoneE164).toBe('+918936995020');
    expect(CONTACT_DETAILS.phoneDisplay).toBe('+91 89369 95020');
    expect(CONTACT_DETAILS.addressLines.join(' ')).toContain('Pune');
    expect(CONTACT_DETAILS.addressLines.join(' ')).toContain('411045');
  });
});

describe('ContactPage', () => {
  it('shows email, phone and address as actionable details', () => {
    render(<ContactPage />);
    expect(screen.getByTestId('contact-title')).toHaveTextContent(strings.contact.title);
    expect(screen.getByRole('link', { name: CONTACT_DETAILS.email })).toHaveAttribute('href', `mailto:${CONTACT_DETAILS.email}`);
    expect(screen.getByRole('link', { name: CONTACT_DETAILS.phoneDisplay })).toHaveAttribute('href', `tel:${CONTACT_DETAILS.phoneE164}`);
    for (const line of CONTACT_DETAILS.addressLines) {
      expect(screen.getByText(new RegExp(line.replace(/[()]/g, '\\$&')))).toBeInTheDocument();
    }
  });

  it('triggers onBackClick', () => {
    const onBack = vi.fn();
    render(<ContactPage onBackClick={onBack} />);
    fireEvent.click(screen.getByTestId('contact-back-button'));
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});

describe('RefundPolicy', () => {
  it('describes store billing: refunds and cancellation are handled by Apple / Google, and says how to get help', () => {
    render(<RefundPolicy />);
    expect(screen.getByTestId('refund-title')).toHaveTextContent(strings.refundPolicy.title);
    expect(screen.getByText(strings.terms.sec2Text)).toBeInTheDocument();
    expect(screen.getByText(strings.refundPolicy.cancelText)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: CONTACT_DETAILS.email })).toHaveAttribute('href', `mailto:${CONTACT_DETAILS.email}`);
    expect(strings.terms.sec2Text).toMatch(/App Store/);
    expect(strings.terms.sec2Text).toMatch(/Google Play/);
  });

  it('never mentions Razorpay or a self-issued money-back guarantee anywhere in the user-facing copy', () => {
    const copy = JSON.stringify([strings.refundPolicy, strings.terms, strings.faq, strings.subscription, strings.upgradeGate]);
    expect(copy).not.toMatch(/razorpay/i);
    expect(copy).not.toMatch(/money-back/i);
  });

  it('triggers onBackClick', () => {
    const onBack = vi.fn();
    render(<RefundPolicy onBackClick={onBack} />);
    fireEvent.click(screen.getByTestId('refund-back-button'));
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});

describe('Footer legal links', () => {
  it.each([['privacy'], ['terms'], ['refund'], ['contact']])('navigates to the %s tab', (tab) => {
    const onNav = vi.fn();
    render(<Footer onNavClick={onNav} />);
    fireEvent.click(screen.getByTestId(`footer-link-${tab}`));
    expect(onNav).toHaveBeenCalledWith(tab);
  });
});

describe('tab routing', () => {
  it.each(['refund', 'contact'])('%s is a valid tab reachable from the URL', (tab) => {
    expect(VALID_TABS).toContain(tab);
    expect(getTabFromUrl(`?tab=${tab}`)).toBe(tab);
  });
});
