/**
 * Anti-Cheating Service for Standardized Test Runners
 *
 * Suppresses right-click context menus, intercepts developer tools and copy/paste shortcuts,
 * and tracks window visibility changes during standardized SSB test sessions.
 */

import { strings } from '../constants/strings';

export interface AntiCheatOptions {
  maxViolations?: number;
  onWarning?: (message: string, currentViolations: number) => void;
  onViolationExceeded?: () => void;
}

export class AntiCheatService {
  private violationCount = 0;
  private maxViolations: number;
  private onWarning?: (message: string, currentViolations: number) => void;
  private onViolationExceeded?: () => void;
  private isActive = false;

  private boundContextMenuHandler: (e: MouseEvent) => void;
  private boundKeyDownHandler: (e: KeyboardEvent) => void;
  private boundVisibilityHandler: () => void;

  constructor(options: AntiCheatOptions = {}) {
    this.maxViolations = options.maxViolations || 3;
    this.onWarning = options.onWarning;
    this.onViolationExceeded = options.onViolationExceeded;

    this.boundContextMenuHandler = this.handleContextMenu.bind(this);
    this.boundKeyDownHandler = this.handleKeyDown.bind(this);
    this.boundVisibilityHandler = this.handleVisibilityChange.bind(this);
  }

  public activate(): void {
    if (this.isActive || typeof window === 'undefined') return;
    this.isActive = true;
    this.violationCount = 0;

    window.addEventListener('contextmenu', this.boundContextMenuHandler, true);
    window.addEventListener('keydown', this.boundKeyDownHandler, true);
    document.addEventListener('visibilitychange', this.boundVisibilityHandler, true);
  }

  public deactivate(): void {
    if (!this.isActive || typeof window === 'undefined') return;
    this.isActive = false;

    window.removeEventListener('contextmenu', this.boundContextMenuHandler, true);
    window.removeEventListener('keydown', this.boundKeyDownHandler, true);
    document.removeEventListener('visibilitychange', this.boundVisibilityHandler, true);
  }

  public getViolations(): number {
    return this.violationCount;
  }

  private handleContextMenu(e: MouseEvent): void {
    e.preventDefault();
    if (this.onWarning) {
      this.onWarning(strings.anticheat.contextMenuBlocked, this.violationCount);
    }
  }

  private handleKeyDown(e: KeyboardEvent): void {
    const isCmdOrCtrl = e.ctrlKey || e.metaKey;
    const key = e.key.toUpperCase();

    // Restricted keys: F12, Ctrl/Cmd + Shift + I/J/C, Ctrl/Cmd + U/C/V
    const isF12 = e.key === 'F12';
    const isDevToolsCombo = isCmdOrCtrl && e.shiftKey && ['I', 'J', 'C'].includes(key);
    const isRestrictedShortcut = isCmdOrCtrl && ['U', 'C', 'V'].includes(key);

    if (isF12 || isDevToolsCombo || isRestrictedShortcut) {
      e.preventDefault();
      e.stopPropagation();
      if (this.onWarning) {
        this.onWarning(strings.anticheat.shortcutBlocked, this.violationCount);
      }
    }
  }

  private handleVisibilityChange(): void {
    if (document.hidden || document.visibilityState === 'hidden') {
      this.violationCount++;
      
      const message = strings.anticheat.windowUnfocused
        .replace('{count}', this.violationCount.toString())
        .replace('{max}', this.maxViolations.toString());

      if (this.onWarning) {
        this.onWarning(message, this.violationCount);
      }

      if (this.violationCount >= this.maxViolations && this.onViolationExceeded) {
        this.onViolationExceeded();
      }
    }
  }
}
