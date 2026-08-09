import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PrivacyPolicy } from '../../../src/components/legal/PrivacyPolicy';
import { TermsAndRefunds } from '../../../src/components/legal/TermsAndRefunds';
import { Footer } from '../../../src/components/legal/Footer';
import { strings } from '../../../src/constants/strings';

describe('Legal Pages Components', () => {
  describe('PrivacyPolicy Component', () => {
    it('renders privacy policy title, subtitle, and section headers', () => {
      render(<PrivacyPolicy />);

      expect(screen.getByTestId('privacy-title')).toHaveTextContent(strings.privacy.title);
      expect(screen.getByText(strings.privacy.subtitle)).toBeInTheDocument();
      expect(screen.getByText(strings.privacy.sec1Title)).toBeInTheDocument();
      expect(screen.getByText(strings.privacy.sec2Title)).toBeInTheDocument();
      expect(screen.getByText(strings.privacy.sec3Title)).toBeInTheDocument();
      expect(screen.getByText(strings.privacy.sec4Title)).toBeInTheDocument();
    });

    it('triggers onBackClick when back button is clicked', () => {
      const handleBack = vi.fn();
      render(<PrivacyPolicy onBackClick={handleBack} />);

      const backBtn = screen.getByTestId('privacy-back-button');
      fireEvent.click(backBtn);
      expect(handleBack).toHaveBeenCalledTimes(1);
    });
  });

  describe('TermsAndRefunds Component', () => {
    it('renders terms and refunds title, subtitle, and section headers', () => {
      render(<TermsAndRefunds />);

      expect(screen.getByTestId('terms-title')).toHaveTextContent(strings.terms.title);
      expect(screen.getByText(strings.terms.subtitle)).toBeInTheDocument();
      expect(screen.getByText(strings.terms.sec1Title)).toBeInTheDocument();
      expect(screen.getByText(strings.terms.sec2Title)).toBeInTheDocument();
      expect(screen.getByText(strings.terms.sec3Title)).toBeInTheDocument();
      expect(screen.getByText(strings.terms.sec4Title)).toBeInTheDocument();
    });

    it('triggers onBackClick when back button is clicked', () => {
      const handleBack = vi.fn();
      render(<TermsAndRefunds onBackClick={handleBack} />);

      const backBtn = screen.getByTestId('terms-back-button');
      fireEvent.click(backBtn);
      expect(handleBack).toHaveBeenCalledTimes(1);
    });
  });

  describe('Footer Component', () => {
    it('renders brand identity and disclaimer text', () => {
      render(<Footer />);

      expect(screen.getAllByText(strings.common.appName).length).toBeGreaterThan(0);
      expect(screen.getByText(strings.footer.rights)).toBeInTheDocument();
      expect(screen.getByText(strings.footer.disclaimer)).toBeInTheDocument();
    });

    it('triggers onNavClick with correct tab identifier on footer link click', () => {
      const handleNav = vi.fn();
      render(<Footer onNavClick={handleNav} />);

      const privacyLink = screen.getByTestId('footer-link-privacy');
      fireEvent.click(privacyLink);
      expect(handleNav).toHaveBeenCalledWith('privacy');

      const termsLink = screen.getByTestId('footer-link-terms');
      fireEvent.click(termsLink);
      expect(handleNav).toHaveBeenCalledWith('terms');
    });
  });
});
