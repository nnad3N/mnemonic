import { getAuthenticatorName, passkey } from "@better-auth/passkey";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError } from "better-auth/api";
import { admin } from "better-auth/plugins";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import * as v from "valibot";

import { drizzleDb } from "@/db";
import * as authSchema from "@/db/auth-schema";
import { isEmailAllowed } from "@/lib/better-auth/allowed-emails";
import type { AuthErrorCode } from "@/lib/errors/auth-error";

const signUpContextSchema = v.pipe(
  v.string(),
  v.parseJson(),
  v.object({
    email: v.pipe(v.string(), v.email()),
    name: v.pipe(v.string(), v.trim(), v.nonEmpty()),
  }),
);

export type SignUpContext = v.InferOutput<typeof signUpContextSchema>;

export const auth = betterAuth({
  database: drizzleAdapter(drizzleDb, { provider: "sqlite", schema: authSchema }),
  plugins: [
    passkey({
      registration: {
        afterVerification: ({ verification }) => ({
          name: getAuthenticatorName(verification.registrationInfo?.aaguid),
        }),
        requireSession: false,
        resolveUser: async ({ context, ctx }) => {
          const signUpContext = v.safeParse(signUpContextSchema, context);

          if (!signUpContext.success) {
            throw APIError.from("BAD_REQUEST", {
              code: "INVALID_SIGN_UP_DETAILS" satisfies AuthErrorCode,
              message: "Invalid sign-up details",
            });
          }

          const { email, name } = signUpContext.output;

          if (!isEmailAllowed(email)) {
            throw APIError.from("UNAUTHORIZED", {
              code: "EMAIL_NOT_ALLOWED" satisfies AuthErrorCode,
              message: "This email is not allowed to sign up",
            });
          }

          const existing = await ctx.context.internalAdapter.findUserByEmail(email);

          if (!existing) {
            const created = await ctx.context.internalAdapter.createUser(
              {
                email,
                emailVerified: false,
                name,
              },
              { method: "passkey" },
            );

            return { displayName: name, id: created.id, name: email };
          }

          const passkeyCount = await ctx.context.adapter.count({
            model: "passkey",
            where: [{ field: "userId", value: existing.user.id }],
          });

          // Nobody can sign in as an account without a passkey, so an abandoned
          // registration is safe to adopt. Once one exists the account has a real
          // owner, and handing it out here would be an account takeover.
          if (passkeyCount > 0) {
            throw APIError.from("BAD_REQUEST", {
              code: "USER_ALREADY_EXISTS" satisfies AuthErrorCode,
              message: "An account with that email already exists",
            });
          }

          return { displayName: existing.user.name, id: existing.user.id, name: email };
        },
      },
      rpName: "Mnemonic",
    }),
    admin(),
    tanstackStartCookies(),
  ],
});
