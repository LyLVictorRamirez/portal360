import assert from "node:assert/strict";
import test from "node:test";

import { AUTH_RATE_LIMIT_WINDOW_SECONDS, AuthEmailRateLimiter } from "./auth-rate-limit.js";

test("limits repeated requests by normalized email and allows them after the window", () => {
  let currentTime = 0;
  const limiter = new AuthEmailRateLimiter(() => currentTime);

  assert.deepEqual(limiter.consume("/sign-in/email", "Member@example.test"), { allowed: true });
  assert.deepEqual(limiter.consume("/sign-in/email", " member@example.test "), {
    allowed: true,
  });
  assert.deepEqual(limiter.consume("/sign-in/email", "MEMBER@example.test"), {
    allowed: true,
  });
  assert.deepEqual(limiter.consume("/sign-in/email", "member@example.test"), {
    allowed: false,
    retryAfter: AUTH_RATE_LIMIT_WINDOW_SECONDS,
  });

  currentTime += AUTH_RATE_LIMIT_WINDOW_SECONDS * 1_000;

  assert.deepEqual(limiter.consume("/sign-in/email", "member@example.test"), {
    allowed: true,
  });
});

test("keeps rate limits isolated by endpoint and email", () => {
  const limiter = new AuthEmailRateLimiter(() => 0);

  assert.deepEqual(limiter.consume("/request-password-reset", "member@example.test"), {
    allowed: true,
  });
  assert.deepEqual(limiter.consume("/sign-in/email", "another@example.test"), {
    allowed: true,
  });
});
