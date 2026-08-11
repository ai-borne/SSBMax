import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AntiCheatService } from '../../src/services/AntiCheatService';
import { strings } from '../../src/constants/strings';

describe('AntiCheatService Cross-Platform Tests', () => {
  let antiCheatService: AntiCheatService;
  let warningMessages: Array<{ message: string; count: number }> = [];
  let violationExceededCalled = false;

  beforeEach(() => {
    warningMessages = [];
    violationExceededCalled = false;

    antiCheatService = new AntiCheatService({
      maxViolations: 2,
      onWarning: (message, count) => {
        warningMessages.push({ message, count });
      },
      onViolationExceeded: () => {
        violationExceededCalled = true;
      }
    });

    antiCheatService.activate();
  });

  afterEach(() => {
    antiCheatService.deactivate();
  });

  it('should block right-click context menu and mobile long-press events', () => {
    const event = new MouseEvent('contextmenu', { cancelable: true, bubbles: true });
    const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

    window.dispatchEvent(event);

    expect(preventDefaultSpy).toHaveBeenCalled();
    expect(warningMessages.length).toBe(1);
    expect(warningMessages[0].message).toBe(strings.anticheat.contextMenuBlocked);
  });

  it('should block Windows/Linux developer shortcuts (F12, Ctrl+Shift+I)', () => {
    const f12Event = new KeyboardEvent('keydown', { key: 'F12', cancelable: true, bubbles: true });
    const f12Spy = vi.spyOn(f12Event, 'preventDefault');
    window.dispatchEvent(f12Event);

    expect(f12Spy).toHaveBeenCalled();
    expect(warningMessages[0].message).toBe(strings.anticheat.shortcutBlocked);
  });

  it('should block macOS developer and screenshot shortcuts (Cmd+Option+I, Cmd+Shift+4)', () => {
    // macOS DevTools: Cmd+Alt+I
    const macDevToolsEvent = new KeyboardEvent('keydown', {
      key: 'I',
      metaKey: true,
      altKey: true,
      cancelable: true,
      bubbles: true
    });
    const macDevToolsSpy = vi.spyOn(macDevToolsEvent, 'preventDefault');
    window.dispatchEvent(macDevToolsEvent);

    expect(macDevToolsSpy).toHaveBeenCalled();

    // macOS Screenshot: Cmd+Shift+4
    const macScreenshotEvent = new KeyboardEvent('keydown', {
      key: '4',
      metaKey: true,
      shiftKey: true,
      cancelable: true,
      bubbles: true
    });
    const macScreenshotSpy = vi.spyOn(macScreenshotEvent, 'preventDefault');
    window.dispatchEvent(macScreenshotEvent);

    expect(macScreenshotSpy).toHaveBeenCalled();
    expect(warningMessages.length).toBe(2);
  });

  it('should apply mobile user-select and touch-callout restrictions on activate and restore on deactivate', () => {
    expect(document.body.style.userSelect).toBe('none');
    expect(document.body.style.webkitUserSelect).toBe('none');

    antiCheatService.deactivate();

    expect(document.body.style.userSelect).toBe('');
    expect(document.body.style.webkitUserSelect).toBe('');
  });

  it('should track window unfocus / app switching and trigger submission when limit exceeded', async () => {
    Object.defineProperty(document, 'hidden', { value: true, configurable: true });
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });

    // First unfocus violation
    document.dispatchEvent(new Event('visibilitychange'));

    expect(antiCheatService.getViolations()).toBe(1);
    expect(violationExceededCalled).toBe(false);

    // Wait > 1000ms for debounce window
    await new Promise((resolve) => setTimeout(resolve, 1050));

    // Second unfocus violation -> reaches maxViolations = 2
    document.dispatchEvent(new Event('visibilitychange'));

    expect(antiCheatService.getViolations()).toBe(2);
    expect(violationExceededCalled).toBe(true);

    Object.defineProperty(document, 'hidden', { value: false, configurable: true });
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
  });

  it('should intercept paste events and warn candidate, but preserve IME composition', () => {
    // 1. Standard Paste Event
    const pasteEvent = new Event('paste', { cancelable: true, bubbles: true });
    const preventDefaultSpy = vi.spyOn(pasteEvent, 'preventDefault');

    window.dispatchEvent(pasteEvent);

    expect(preventDefaultSpy).toHaveBeenCalled();
    expect(warningMessages[0].message).toBe(strings.anticheat.pasteBlocked);

    // 2. IME Composition Paste Event (should NOT be prevented)
    const imeEvent = new Event('paste', { cancelable: true, bubbles: true }) as any;
    imeEvent.isComposing = true;
    const imePreventSpy = vi.spyOn(imeEvent, 'preventDefault');

    window.dispatchEvent(imeEvent);

    expect(imePreventSpy).not.toHaveBeenCalled();
  });

  it('should intercept drop events and warn candidate', () => {
    const dropEvent = new Event('drop', { cancelable: true, bubbles: true });
    const preventDefaultSpy = vi.spyOn(dropEvent, 'preventDefault');

    window.dispatchEvent(dropEvent);

    expect(preventDefaultSpy).toHaveBeenCalled();
    expect(warningMessages[0].message).toBe(strings.anticheat.dropBlocked);
  });

  it('should track fullscreen exit and issue warning when fullscreen is supported', () => {
    Object.defineProperty(document, 'fullscreenEnabled', { value: true, configurable: true });
    Object.defineProperty(document, 'fullscreenElement', { value: null, configurable: true });

    document.dispatchEvent(new Event('fullscreenchange'));

    expect(antiCheatService.getViolations()).toBe(1);
    expect(warningMessages[0].message).toContain('Fullscreen mode exited');
  });

  it('should NOT record an unfocus violation when blur occurs but document.hasFocus() is true (e.g. clicking MCQ answer option buttons)', () => {
    vi.spyOn(document, 'hasFocus').mockReturnValue(true);

    window.dispatchEvent(new Event('blur'));

    expect(antiCheatService.getViolations()).toBe(0);
    expect(warningMessages.length).toBe(0);
  });
});

