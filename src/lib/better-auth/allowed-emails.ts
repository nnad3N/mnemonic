import { env } from "@/env";

/**
 * `patterns` is a comma-separated list of full emails or `*@domain` wildcards.
 * Callers pass emails that Valibot already validated, so splitting on `@` is
 * reliable and no pattern matching beyond string comparison is needed.
 */
export const emailMatchesPatterns = (patterns: string, email: string): boolean => {
  const normalized = email.toLowerCase();
  const domain = normalized.split("@").at(1);

  return patterns.split(",").some((entry) => {
    const pattern = entry.trim().toLowerCase();

    if (pattern.startsWith("*@")) {
      return pattern.slice(2) === domain;
    }

    return pattern === normalized;
  });
};

export const isEmailAllowed = (email: string): boolean =>
  !env.ALLOWED_EMAILS || emailMatchesPatterns(env.ALLOWED_EMAILS, email);
