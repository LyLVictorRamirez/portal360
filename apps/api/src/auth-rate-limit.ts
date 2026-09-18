export const AUTH_RATE_LIMIT_WINDOW_SECONDS = 60;
export const AUTH_RATE_LIMIT_MESSAGE = "Too many requests. Please try again later.";

const MAX_EMAIL_RATE_LIMIT_ENTRIES = 100_000;

export const authIpRateLimitRules = {
  "/request-password-reset": {
    max: 3,
    window: AUTH_RATE_LIMIT_WINDOW_SECONDS,
  },
  "/send-verification-email": {
    max: 3,
    window: AUTH_RATE_LIMIT_WINDOW_SECONDS,
  },
  "/sign-in/email": {
    max: 5,
    window: AUTH_RATE_LIMIT_WINDOW_SECONDS,
  },
  "/sign-up/email": {
    max: 3,
    window: AUTH_RATE_LIMIT_WINDOW_SECONDS,
  },
} as const;

const authEmailRateLimitRules = {
  "/request-password-reset": 3,
  "/send-verification-email": 3,
  "/sign-in/email": 3,
  "/sign-up/email": 3,
} as const;

type AuthEmailRateLimitPath = keyof typeof authEmailRateLimitRules;

interface RateLimitEntry {
  attempts: number;
  resetAt: number;
}

export interface AuthEmailRateLimitResult {
  allowed: boolean;
  retryAfter?: number;
}

export class AuthEmailRateLimiter {
  private readonly entries = new Map<string, RateLimitEntry>();

  constructor(private readonly now: () => number = Date.now) {}

  consume(path: AuthEmailRateLimitPath, email: unknown): AuthEmailRateLimitResult {
    const normalizedEmail = normalizeEmail(email);

    if (!normalizedEmail) {
      return { allowed: true };
    }

    const currentTime = this.now();
    this.removeExpiredEntries(currentTime);

    const key = `${path}:${normalizedEmail}`;
    const previous = this.entries.get(key);
    const maximumAttempts = authEmailRateLimitRules[path];

    if (!previous || currentTime >= previous.resetAt) {
      this.entries.set(key, {
        attempts: 1,
        resetAt: currentTime + AUTH_RATE_LIMIT_WINDOW_SECONDS * 1_000,
      });

      return { allowed: true };
    }

    if (previous.attempts >= maximumAttempts) {
      return {
        allowed: false,
        retryAfter: Math.ceil((previous.resetAt - currentTime) / 1_000),
      };
    }

    previous.attempts += 1;

    return { allowed: true };
  }

  private removeExpiredEntries(currentTime: number) {
    for (const [key, entry] of this.entries) {
      if (currentTime >= entry.resetAt) {
        this.entries.delete(key);
      }
    }

    if (this.entries.size <= MAX_EMAIL_RATE_LIMIT_ENTRIES) {
      return;
    }

    const excessEntries = this.entries.size - MAX_EMAIL_RATE_LIMIT_ENTRIES;
    let removedEntries = 0;

    for (const key of this.entries.keys()) {
      this.entries.delete(key);
      removedEntries += 1;

      if (removedEntries === excessEntries) {
        return;
      }
    }
  }
}

export function isAuthEmailRateLimitPath(path: string): path is AuthEmailRateLimitPath {
  return path in authEmailRateLimitRules;
}

function normalizeEmail(email: unknown) {
  if (typeof email !== "string") {
    return undefined;
  }

  const normalizedEmail = email.trim().toLowerCase();

  return normalizedEmail || undefined;
}
