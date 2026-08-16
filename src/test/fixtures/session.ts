import type { authClient } from "@/lib/better-auth/auth-client";

const now = new Date("2026-01-01T00:00:00.000Z");

export type TestAuthSession = typeof authClient.$Infer.Session;

export const testAuthSession: TestAuthSession = {
  user: {
    id: "user_test",
    name: "Test User",
    email: "test@example.com",
    emailVerified: true,
    image: null,
    banned: false,
    role: "user",
    createdAt: now,
    updatedAt: now,
  },
  session: {
    id: "session_test",
    userId: "user_test",
    token: "token_test",
    expiresAt: new Date("2099-01-01T00:00:00.000Z"),
    ipAddress: "127.0.0.1",
    userAgent: "vitest",
    createdAt: now,
    updatedAt: now,
  },
};
