import type { authClient } from "@/lib/auth-client";
import { m } from "@/paraglide/messages";

type AuthErrorCode = keyof typeof authClient.$ERROR_CODES;

const errorMessageByCode = {
  ACCOUNT_NOT_FOUND: m.auth_error_user_not_found,
  CREDENTIAL_ACCOUNT_NOT_FOUND: m.auth_error_credential_account_not_found,
  EMAIL_NOT_VERIFIED: m.auth_error_email_not_verified,
  INVALID_EMAIL: m.auth_error_invalid_email,
  INVALID_EMAIL_OR_PASSWORD: m.auth_error_invalid_email_or_password,
  INVALID_PASSWORD: m.auth_error_invalid_password,
  INVALID_USER: m.auth_error_user_not_found,
  PASSWORD_TOO_LONG: m.auth_error_password_too_long,
  PASSWORD_TOO_SHORT: m.auth_error_password_too_short,
  SESSION_EXPIRED: m.auth_error_session_expired,
  TOKEN_EXPIRED: m.auth_error_session_expired,
  USER_ALREADY_EXISTS: m.auth_error_user_already_exists,
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: m.auth_error_user_already_exists,
  USER_EMAIL_NOT_FOUND: m.auth_error_user_not_found,
  USER_NOT_FOUND: m.auth_error_user_not_found,
} satisfies Partial<Record<AuthErrorCode, () => string>>;

const isKnownErrorCode = (
  code: string
): code is keyof typeof errorMessageByCode => code in errorMessageByCode;

export const getAuthErrorDescription = (code?: string): string => {
  if (code !== undefined && isKnownErrorCode(code)) {
    return errorMessageByCode[code]();
  }
  return m.auth_error_generic_description();
};
