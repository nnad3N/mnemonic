# Claude / agent guidance

## Internationalization (i18n)

Every **user-facing string** in the UI must go through i18n. Do not hard-code English (or any locale) copy in JSX, labels, buttons, toasts, error messages, placeholders, or `aria-*` text.

This project uses **Paraglide** with messages in `messages/{locale}.json`. Import helpers from `@/paraglide/messages` (typically `m.*()`).

After adding or changing keys in the JSON files, run Paraglide compile so types stay in sync, for example:

`bunx @inlang/paraglide-js compile --project ./project.inlang --outdir ./src/paraglide`

Exceptions are rare and intentional only—for example protocol identifiers, format tokens consumed by libraries, or non-human-readable debugging identifiers—not ordinary UI copy.
