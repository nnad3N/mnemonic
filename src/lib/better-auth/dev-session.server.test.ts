import { afterEach, describe, expect, it } from "vitest";

import { session } from "@/db/auth-schema.server";
import { drizzleDb } from "@/db/client.server";
import { auth } from "@/lib/better-auth/auth.server";
import { DEV_SESSION_URL_PATH, resolveDevSessionUser } from "@/lib/better-auth/dev-session.server";
import { clearDatabase } from "@/test/clear-database";
import { seedUser } from "@/test/seed";

const cookieHeaderFrom = (response: Response) =>
  response.headers
    .getSetCookie()
    .map((entry) => {
      const end = entry.indexOf(";");
      return end === -1 ? entry : entry.slice(0, end);
    })
    .join("; ");

const mintDevSession = async () =>
  auth.handler(new Request(`http://localhost:3000${DEV_SESSION_URL_PATH}`));

afterEach(async () => {
  await clearDatabase();
});

describe("resolveDevSessionUser", () => {
  it("returns no-user when the list is empty", () => {
    expect(resolveDevSessionUser([])).toEqual({ type: "no-user" });
  });

  it("returns the only user", () => {
    const sole = { email: "a@x.com", id: "1" };

    expect(resolveDevSessionUser([sole])).toEqual({
      type: "ok",
      user: sole,
    });
  });

  it("returns many-users when more than one exists", () => {
    expect(resolveDevSessionUser([{ id: "1" }, { id: "2" }])).toEqual({ type: "many-users" });
  });
});

describe("GET /api/auth/dev/session", () => {
  it("rejects when no user exists", async () => {
    const response = await mintDevSession();

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      message: "Sign up once with a passkey before using the dev session.",
    });
  });

  it("rejects when more than one user exists", async () => {
    await seedUser({ email: "one@example.com" });
    await seedUser({ email: "two@example.com" });

    const response = await mintDevSession();

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      message: "Dev session needs exactly one user.",
    });
  });

  it("sets a session cookie and redirects home", async () => {
    const userId = await seedUser({ email: "sole@example.com", name: "Sole" });
    const response = await mintDevSession();

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("/");

    const cookie = cookieHeaderFrom(response);
    expect(cookie.length).toBeGreaterThan(0);

    const authed = await auth.api.getSession({
      headers: new Headers({ cookie }),
    });

    expect(authed?.user).toMatchObject({ email: "sole@example.com", id: userId, name: "Sole" });

    const sessions = await drizzleDb.select({ userId: session.userId }).from(session);

    expect(sessions).toEqual([{ userId }]);
  });
});
