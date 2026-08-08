import { TaggedError } from "better-result";

import { authClient } from "@/lib/better-auth/auth-client";
import type { GT } from "@/lib/gt";

export const AUTH_ERROR_CODES = authClient.$ERROR_CODES;

export type AuthErrorCode = keyof typeof AUTH_ERROR_CODES;

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
    case "CREDENTIAL_ACCOUNT_NOT_FOUND": {
      return gt("No password is set for this account. Try a different sign-in method.");
    }
    case "EMAIL_NOT_VERIFIED": {
      return gt("Please verify your email address before signing in.");
    }
    case "INVALID_EMAIL": {
      return gt("Invalid email address.");
    }
    case "INVALID_EMAIL_OR_PASSWORD": {
      return gt("Invalid email or password.");
    }
    case "INVALID_PASSWORD": {
      return gt("Invalid password.");
    }
    case "PASSWORD_TOO_LONG": {
      return gt("Password is too long.");
    }
    case "PASSWORD_TOO_SHORT": {
      return gt("Password is too short.");
    }
    case "SESSION_EXPIRED":
    case "TOKEN_EXPIRED": {
      return gt("Your session has expired. Please sign in again.");
    }
    case "USER_ALREADY_EXISTS":
    case "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL": {
      return gt("An account with that email already exists.");
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
