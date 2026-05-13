import { TaggedError } from "better-result";

import { authClient } from "@/lib/better-auth/auth-client";
import { m } from "@/paraglide/messages";

export const AUTH_ERROR_CODES = authClient.$ERROR_CODES;

export type AuthErrorCode = keyof typeof AUTH_ERROR_CODES;

export const getAuthErrorDescription = (code?: string): string => {
  if (code === undefined) {
    return m.auth_error_generic_description();
  }

  switch (code) {
    case "ACCOUNT_NOT_FOUND":
    case "INVALID_USER":
    case "USER_EMAIL_NOT_FOUND":
    case "USER_NOT_FOUND": {
      return m.auth_error_user_not_found();
    }
    case "CREDENTIAL_ACCOUNT_NOT_FOUND": {
      return m.auth_error_credential_account_not_found();
    }
    case "EMAIL_NOT_VERIFIED": {
      return m.auth_error_email_not_verified();
    }
    case "INVALID_EMAIL": {
      return m.auth_error_invalid_email();
    }
    case "INVALID_EMAIL_OR_PASSWORD": {
      return m.auth_error_invalid_email_or_password();
    }
    case "INVALID_PASSWORD": {
      return m.auth_error_invalid_password();
    }
    case "PASSWORD_TOO_LONG": {
      return m.auth_error_password_too_long();
    }
    case "PASSWORD_TOO_SHORT": {
      return m.auth_error_password_too_short();
    }
    case "SESSION_EXPIRED":
    case "TOKEN_EXPIRED": {
      return m.auth_error_session_expired();
    }
    case "USER_ALREADY_EXISTS":
    case "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL": {
      return m.auth_error_user_already_exists();
    }
    default: {
      return m.auth_error_generic_description();
    }
  }
};

export class AuthError extends TaggedError("AuthError")<{
  // oxlint-disable-next-line typescript/ban-types
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

export const toAuthError = (props: ToAuthErrorProps): AuthError => {
  const { code, status, statusText } = props;
  const message = props.message ?? "Unknown better-auth error";

  if (!props.code) {
    return new AuthError({ message, status, statusText });
  }

  return new AuthError({ code, message, status, statusText });
};
