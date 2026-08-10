import { TaggedError } from "better-result";

import { authClient } from "@/lib/better-auth/auth-client";
import type { GT } from "@/lib/gt";
import * as Kit from "@/lib/kit";

export const AUTH_ERROR_CODES = authClient.$ERROR_CODES;

export type AuthErrorCode = keyof typeof AUTH_ERROR_CODES;

/**
 * Dismissing the browser's WebAuthn prompt surfaces as an error, but the user meant it.
 * A manual cancel arrives as `NotAllowedError`, which simplewebauthn passes through as
 * ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY; ERROR_CEREMONY_ABORTED covers programmatic aborts.
 */
export const cancelledPasskeyCodes = Kit.literals.from()([
  "AUTH_CANCELLED",
  "ERROR_CEREMONY_ABORTED",
  "ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY",
]);

export const getAuthErrorDescription = (gt: GT, code?: string): string => {
  if (code === undefined) {
    return gt("We couldn't complete your request. Please try again.");
  }

  switch (code) {
    case "ACCOUNT_NOT_FOUND":
    case "INVALID_USER":
    case "USER_EMAIL_NOT_FOUND":
    case "USER_NOT_FOUND": {
      return gt("We couldn't find an account with that email.");
    }
    case "AUTHENTICATION_FAILED": {
      return gt("We couldn't verify that passkey. Please try again.");
    }
    case "CHALLENGE_NOT_FOUND": {
      return gt("This request took too long. Please try again.");
    }
    case "FAILED_TO_UPDATE_PASSKEY": {
      return gt("We couldn't rename that passkey. Please try again.");
    }
    case "FAILED_TO_VERIFY_REGISTRATION": {
      return gt("We couldn't register that passkey. Please try again.");
    }
    case "INVALID_EMAIL": {
      return gt("Invalid email address.");
    }
    case "PASSKEY_NOT_FOUND": {
      return gt("We couldn't find that passkey.");
    }
    case "PREVIOUSLY_REGISTERED": {
      return gt("That passkey is already registered.");
    }
    case "SESSION_EXPIRED":
    case "TOKEN_EXPIRED": {
      return gt("Your session has expired. Please sign in again.");
    }
    case "UNABLE_TO_CREATE_SESSION": {
      return gt("We couldn't sign you in. Please try again.");
    }
    case "USER_ALREADY_EXISTS":
    case "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL": {
      return gt("An account with that email already exists.");
    }
    case "YOU_ARE_NOT_ALLOWED_TO_REGISTER_THIS_PASSKEY": {
      return gt("That passkey can't be added to this account.");
    }
    default: {
      return gt("We couldn't complete your request. Please try again.");
    }
  }
};

export class AuthError extends TaggedError("AuthError")<{
  code?: AuthErrorCode | (string & {});
  message: string;
  status: number;
  statusText: string;
}>() {}

export type ToAuthErrorProps = {
  code?: string | undefined;
  message?: string | undefined;
  status: number;
  statusText: string;
};

export const toAuthError = ({
  code,
  status,
  statusText,
  message = "Unknown better-auth error",
}: ToAuthErrorProps): AuthError => {
  if (!code) {
    return new AuthError({ message, status, statusText });
  }

  return new AuthError({ code, message, status, statusText });
};
