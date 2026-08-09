/**
 * Cross-Platform Anti-Cheating Service for Standardized Test Runners
 *
 * Supports Windows, macOS, Linux, iOS, iPadOS, and Android.
 * - macOS: Blocks Cmd+Alt+I/J/U/C (DevTools/Source), Cmd+Shift+3/4/5 (Screenshots), Cmd+C/V/U/P/S.
 * - Mobile (iOS/iPadOS/Android): Disables text callouts & selection via touch-callout styles,
 *   tracks app switcher & tab changes via visibilitychange, blur, and pagehide events with debouncing.
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
  private lastUnfocusTimestamp = 0;

  private boundContextMenuHandler: (e: MouseEvent) => void;
  private boundKeyDownHandler: (e: KeyboardEvent) => void;
  private boundVisibilityHandler: () => void;
  private boundBlurHandler: () => void;
  private boundPasteHandler: (e: ClipboardEvent) => void;
  private boundDropHandler: (e: DragEvent) => void;
  private boundFullscreenHandler: () => void;

  constructor(options: AntiCheatOptions = {}) {
    this.maxViolations = options.maxViolations || 3;
    this.onWarning = options.onWarning;
    this.onViolationExceeded = options.onViolationExceeded;

    this.boundContextMenuHandler = this.handleContextMenu.bind(this);
    this.boundKeyDownHandler = this.handleKeyDown.bind(this);
    this.boundVisibilityHandler = this.handleVisibilityChange.bind(this);
    this.boundBlurHandler = this.handleBlur.bind(this);
    this.boundPasteHandler = this.handlePaste.bind(this);
    this.boundDropHandler = this.handleDrop.bind(this);
    this.boundFullscreenHandler = this.handleFullscreenChange.bind(this);
  }

  public activate(): void {
    if (this.isActive || typeof window === 'undefined') return;
    this.isActive = true;
    this.violationCount = 0;
    this.lastUnfocusTimestamp = 0;

    // Suppress context menu & right-click / iOS long-press callout
    window.addEventListener('contextmenu', this.boundContextMenuHandler, true);
    window.addEventListener('keydown', this.boundKeyDownHandler, true);
    window.addEventListener('paste', this.boundPasteHandler as EventListener, true);
    window.addEventListener('drop', this.boundDropHandler as EventListener, true);
    document.addEventListener('visibilitychange', this.boundVisibilityHandler, true);
    window.addEventListener('blur', this.boundBlurHandler, true);
    window.addEventListener('pagehide', this.boundVisibilityHandler, true);

    // Cross-browser Fullscreen Change Event Listeners with Feature Detection
    this.addFullscreenListeners();

    // Apply mobile touch-callout & user-select restrictions on active test container
    if (document.body) {
      document.body.style.webkitUserSelect = 'none';
      document.body.style.userSelect = 'none';
      (document.body.style as any).webkitTouchCallout = 'none';
    }
  }

  public deactivate(): void {
    if (!this.isActive || typeof window === 'undefined') return;
    this.isActive = false;

    window.removeEventListener('contextmenu', this.boundContextMenuHandler, true);
    window.removeEventListener('keydown', this.boundKeyDownHandler, true);
    window.removeEventListener('paste', this.boundPasteHandler as EventListener, true);
    window.removeEventListener('drop', this.boundDropHandler as EventListener, true);
    document.removeEventListener('visibilitychange', this.boundVisibilityHandler, true);
    window.removeEventListener('blur', this.boundBlurHandler, true);
    window.removeEventListener('pagehide', this.boundVisibilityHandler, true);

    this.removeFullscreenListeners();

    // Restore text selection & touch callouts
    if (document.body) {
      document.body.style.webkitUserSelect = '';
      document.body.style.userSelect = '';
      (document.body.style as any).webkitTouchCallout = '';
    }
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
    const isAlt = e.altKey;
    const isShift = e.shiftKey;
    const key = e.key.toUpperCase();

    // 1. F12 key (Windows/Linux)
    const isF12 = e.key === 'F12';

    // 2. Windows/Linux DevTools shortcuts: Ctrl+Shift+I/J/C
    const isWinDevTools = isCmdOrCtrl && isShift && ['I', 'J', 'C'].includes(key);

    // 3. macOS DevTools shortcuts: Cmd+Option+I/J/C/U
    const isMacDevTools = isCmdOrCtrl && isAlt && ['I', 'J', 'C', 'U'].includes(key);

    // 4. macOS Screenshot shortcuts: Cmd+Shift+3/4/5
    const isMacScreenshot = isCmdOrCtrl && isShift && ['3', '4', '5'].includes(e.key);

    // 5. Standard restricted shortcuts: Ctrl/Cmd + U (Source), Ctrl/Cmd + C/V (Copy/Paste), Ctrl/Cmd + S/P (Save/Print)
    const isRestrictedShortcut = isCmdOrCtrl && ['U', 'C', 'V', 'S', 'P'].includes(key);

    if (isF12 || isWinDevTools || isMacDevTools || isMacScreenshot || isRestrictedShortcut) {
      e.preventDefault();
      e.stopPropagation();
      if (this.onWarning) {
        this.onWarning(strings.anticheat.shortcutBlocked, this.violationCount);
      }
    }
  }

  private handlePaste(e: ClipboardEvent): void {
    // Preserve Input Method Editor (IME) composition for vernacular / virtual keyboards
    const target = e.target as any;
    if ((e as any).isComposing || target?.isComposing) {
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    if (this.onWarning) {
      this.onWarning(strings.anticheat.pasteBlocked, this.violationCount);
    }
  }

  private handleDrop(e: DragEvent): void {
    e.preventDefault();
    e.stopPropagation();
    if (this.onWarning) {
      this.onWarning(strings.anticheat.dropBlocked, this.violationCount);
    }
  }

  private addFullscreenListeners(): void {
    if (typeof document === 'undefined') return;
    const events = ['fullscreenchange', 'webkitfullscreenchange', 'mozfullscreenchange', 'MSFullscreenChange'];
    events.forEach(evt => document.addEventListener(evt, this.boundFullscreenHandler, true));
  }

  private removeFullscreenListeners(): void {
    if (typeof document === 'undefined') return;
    const events = ['fullscreenchange', 'webkitfullscreenchange', 'mozfullscreenchange', 'MSFullscreenChange'];
    events.forEach(evt => document.removeEventListener(evt, this.boundFullscreenHandler, true));
  }

  private handleFullscreenChange(): void {
    const isFullscreenSupported = typeof document !== 'undefined' && (
      document.fullscreenEnabled ||
      (document as any).webkitFullscreenEnabled ||
      (document as any).mozFullScreenEnabled ||
      (document as any).msFullscreenEnabled
    );
    if (!isFullscreenSupported) return;

    const isFullscreen = !!(
      document.fullscreenElement ||
      (document as any).webkitFullscreenElement ||
      (document as any).mozFullScreenElement ||
      (document as any).msFullscreenElement
    );

    if (!isFullscreen) {
      this.recordUnfocusViolation(strings.anticheat.fullscreenExited);
    }
  }

  private handleBlur(): void {
    this.recordUnfocusViolation();
  }

  private handleVisibilityChange(): void {
    if (document.hidden || document.visibilityState === 'hidden') {
      this.recordUnfocusViolation();
    }
  }

  private recordUnfocusViolation(customMessage?: string): void {
    const now = Date.now();
    // Debounce unfocus events within 1000ms to prevent double-counting simultaneous blur + visibilitychange on mobile OS
    if (now - this.lastUnfocusTimestamp < 1000) {
      return;
    }
    this.lastUnfocusTimestamp = now;

    this.violationCount++;

    const template = customMessage || strings.anticheat.windowUnfocused;
    const message = template
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
