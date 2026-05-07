import { createMiddleware, createStart } from "@tanstack/react-start";

import { paraglideMiddleware } from "@/paraglide/server";

/**
 * Sets Paraglide's server AsyncLocalStorage from the request URL during SSR so
 * `getLocale()` matches localized paths (TanStack Router `rewrite` stays on the
 * original URL — see Paraglide middleware docs).
 *
 * Use this instead of putting `export default { fetch }` here: that pattern
 * belongs in `server.ts` only if you replace the default server entry. This file
 * must export `startInstance` for TanStack Start.
 *
 * @see https://tanstack.com/router/v1/docs/guide/internationalization-i18n
 */
// oxlint-disable-next-line require-await
const paraglideI18n = createMiddleware().server(async ({ next, request }) =>
  paraglideMiddleware(request, async () => {
    const ctx = await next();
    return ctx.response;
  })
);

export const startInstance = createStart(() => ({
  requestMiddleware: [paraglideI18n],
}));
