/**
 * Thrown when Firestore test content is missing or unreachable. Replaces the
 * old pattern of silently falling back to fabricated/fictional content --
 * callers must surface this as a real UI error state (root Rule 12: fail loud).
 */
export class ContentUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ContentUnavailableError';
  }
}
