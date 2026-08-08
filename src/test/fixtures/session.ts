import type { Session, User } from "better-auth";

const now = new Date("2026-01-01T00:00:00.000Z");

export type TestAuthSession = {
  session: Session;
  user: User;
};

export const testAuthSession: TestAuthSession = {
  user: {
    id: "user_test",
    name: "Test User",
    email: "test@example.com",
    emailVerified: true,
    image: null,
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
