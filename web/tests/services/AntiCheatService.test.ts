import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AntiCheatService } from '../../src/services/AntiCheatService';
import { strings } from '../../src/constants/strings';

describe('AntiCheatService', () => {
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

  it('should block right-click context menu events', () => {
    const event = new MouseEvent('contextmenu', { cancelable: true, bubbles: true });
    const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

    window.dispatchEvent(event);

    expect(preventDefaultSpy).toHaveBeenCalled();
    expect(warningMessages.length).toBe(1);
    expect(warningMessages[0].message).toBe(strings.anticheat.contextMenuBlocked);
  });

  it('should block restricted developer tool keyboard shortcuts (F12, Ctrl+Shift+I)', () => {
    const f12Event = new KeyboardEvent('keydown', { key: 'F12', cancelable: true, bubbles: true });
    const f12Spy = vi.spyOn(f12Event, 'preventDefault');
    window.dispatchEvent(f12Event);

    expect(f12Spy).toHaveBeenCalled();

    const comboEvent = new KeyboardEvent('keydown', {
      key: 'I',
      ctrlKey: true,
      shiftKey: true,
      cancelable: true,
      bubbles: true
    });
    const comboSpy = vi.spyOn(comboEvent, 'preventDefault');
    window.dispatchEvent(comboEvent);

    expect(comboSpy).toHaveBeenCalled();
    expect(warningMessages.length).toBe(2);
    expect(warningMessages[0].message).toBe(strings.anticheat.shortcutBlocked);
  });

  it('should track window visibility change violations and trigger submission on maxViolations', () => {
    Object.defineProperty(document, 'hidden', { value: true, configurable: true });
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });

    // First unfocus violation
    document.dispatchEvent(new Event('visibilitychange'));

    expect(antiCheatService.getViolations()).toBe(1);
    expect(warningMessages.length).toBe(1);
    expect(violationExceededCalled).toBe(false);

    // Second unfocus violation -> reaches maxViolations = 2
    document.dispatchEvent(new Event('visibilitychange'));

    expect(antiCheatService.getViolations()).toBe(2);
    expect(violationExceededCalled).toBe(true);

    // Reset document property
    Object.defineProperty(document, 'hidden', { value: false, configurable: true });
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
  });
});
