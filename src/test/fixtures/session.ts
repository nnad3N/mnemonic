import type { Session, User } from "better-auth";

const now = new Date("2026-01-01T00:00:00.000Z");

export const createTestUser = (overrides?: Partial<User>): User => ({
  id: "user_test",
  name: "Test User",
  email: "test@example.com",
  emailVerified: true,
  image: null,
  createdAt: now,
  updatedAt: now,
  ...overrides,
});

export const createTestSession = (
  overrides?: Partial<Session> & { user?: Partial<User> },
): { session: Session; user: User } => {
  const user = createTestUser(overrides?.user);
  const { user: _userOverrides, ...sessionOverrides } = overrides ?? {};

  return {
    user,
    session: {
      id: "session_test",
      userId: user.id,
      token: "token_test",
      expiresAt: new Date("2099-01-01T00:00:00.000Z"),
      ipAddress: "127.0.0.1",
      userAgent: "vitest",
      createdAt: now,
      updatedAt: now,
      ...sessionOverrides,
    },
  };
};
