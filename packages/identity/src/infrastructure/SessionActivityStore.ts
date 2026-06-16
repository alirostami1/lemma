export interface SessionActivityStore {
  /**
   * Returns true when the session was not seen before.
   * Returns false when the session was already known.
   */
  markSessionSeen(input: {
    userId: string;
    sessionId: string;
    ttlSeconds: number;
  }): Promise<boolean>;
}

/**
 * Safe default when the app does not need session tracking.
 */
export class NoopSessionActivityStore implements SessionActivityStore {
  async markSessionSeen(): Promise<boolean> {
    return false;
  }
}

/**
 * Useful for local development only.
 *
 * Do not use this as the source of truth in multi-instance production.
 * Use Redis or another shared cache there.
 */
export class InMemorySessionActivityStore implements SessionActivityStore {
  private readonly sessions = new Map<string, NodeJS.Timeout>();

  async markSessionSeen(input: {
    userId: string;
    sessionId: string;
    ttlSeconds: number;
  }): Promise<boolean> {
    const key = sessionKey(input.userId, input.sessionId);

    if (this.sessions.has(key)) {
      return false;
    }

    const timeout = setTimeout(() => {
      this.sessions.delete(key);
    }, input.ttlSeconds * 1000);

    timeout.unref?.();

    this.sessions.set(key, timeout);

    return true;
  }
}

function sessionKey(userId: string, sessionId: string): string {
  return `${userId}:${sessionId}`;
}
