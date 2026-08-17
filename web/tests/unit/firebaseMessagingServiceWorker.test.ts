import { describe, it, expect, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import vm from 'vm';

const swPath = path.resolve(__dirname, '../../public/firebase-messaging-sw.js');
const swSource = fs.readFileSync(swPath, 'utf-8');

/**
 * `firebase-messaging-sw.js` (Phase 7) is a classic (non-module) worker
 * script using `importScripts` + the `firebase` global, so it can't be
 * `import`-ed directly in Vitest's jsdom/ESM environment. This runs the file
 * in a Node `vm` sandbox with the worker globals it expects stubbed, so the
 * actual `onBackgroundMessage`/`notificationclick` handlers execute for real
 * against a mocked payload, per the plan's "mocked payload -> notification
 * display call" test requirement -- not just a content/string assertion.
 */
function loadServiceWorker() {
  let backgroundHandler: ((payload: unknown) => void) | undefined;
  const listeners: Record<string, (event: unknown) => void> = {};
  const showNotification = vi.fn();

  const workerSelf = {
    registration: { showNotification },
    addEventListener: (type: string, handler: (event: unknown) => void) => {
      listeners[type] = handler;
    }
  };

  const sandbox: Record<string, unknown> = {
    importScripts: vi.fn(),
    self: workerSelf,
    firebase: {
      initializeApp: vi.fn(),
      messaging: () => ({
        onBackgroundMessage: (handler: (payload: unknown) => void) => {
          backgroundHandler = handler;
        }
      })
    },
    clients: { openWindow: vi.fn() }
  };

  vm.createContext(sandbox);
  vm.runInContext(swSource, sandbox);

  return { backgroundHandler, listeners, showNotification, clients: sandbox.clients as { openWindow: ReturnType<typeof vi.fn> } };
}

describe('firebase-messaging-sw.js (Phase 7, Centralized Result-Announcement Notifications plan)', () => {
  it('exists at the fixed root path Firebase Web Push expects', () => {
    expect(fs.existsSync(swPath)).toBe(true);
  });

  it('shows a notification built from the FCM payload when a background message arrives', () => {
    const { backgroundHandler, showNotification } = loadServiceWorker();
    expect(backgroundHandler).toBeTypeOf('function');

    backgroundHandler!({
      notification: { title: 'Result ready', body: 'Your TAT result is ready' },
      data: { actionUrl: '/reports' }
    });

    expect(showNotification).toHaveBeenCalledWith(
      'Result ready',
      expect.objectContaining({ body: 'Your TAT result is ready', data: { actionUrl: '/reports' } })
    );
  });

  it('falls back to data-only fields and root url when notification/actionUrl are absent from the payload', () => {
    const { backgroundHandler, showNotification } = loadServiceWorker();

    backgroundHandler!({ data: { title: 'SD result ready', message: 'Check your dossier' } });

    expect(showNotification).toHaveBeenCalledWith(
      'SD result ready',
      expect.objectContaining({ body: 'Check your dossier', data: { actionUrl: '/' } })
    );
  });

  it('opens the notification\'s actionUrl on click and closes the notification', () => {
    const { listeners, clients } = loadServiceWorker();
    const close = vi.fn();
    const waitUntil = vi.fn((p: Promise<unknown>) => p);

    listeners['notificationclick']({
      notification: { close, data: { actionUrl: '/reports/tat' } },
      waitUntil
    });

    expect(close).toHaveBeenCalled();
    expect(waitUntil).toHaveBeenCalled();
    expect(clients.openWindow).toHaveBeenCalledWith('/reports/tat');
  });

  it('does not hardcode any non-public secret (API key here is Firebase\'s public web config, not a secret)', () => {
    expect(swSource).not.toMatch(/RAZORPAY|GEMINI_API_KEY|service[_-]?account/i);
  });
});
