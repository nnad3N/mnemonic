import { m } from "@/paraglide/messages";
// Locale switcher refs:
// - Paraglide docs: https://inlang.com/m/gerre34r/library-inlang-paraglideJs
// - Router example: https://github.com/TanStack/router/tree/main/examples/react/i18n-paraglide#switching-locale
import { getLocale, locales, setLocale } from "@/paraglide/runtime";

export default function ParaglideLocaleSwitcher() {
  const currentLocale = getLocale();

  return (
    <div
      style={{
        alignItems: "center",
        color: "inherit",
        display: "flex",
        gap: "0.5rem",
      }}
      aria-label={m.language_label()}
    >
      <span style={{ opacity: 0.85 }}>
        {m.current_locale({ locale: currentLocale })}
      </span>
      <div style={{ display: "flex", gap: "0.25rem" }}>
        {locales.map((locale) => (
          <button
            key={locale}
            onClick={() => void setLocale(locale)}
            aria-pressed={locale === currentLocale}
            style={{
              background: locale === currentLocale ? "#0f172a" : "transparent",
              border: "1px solid #d1d5db",
              borderRadius: "999px",
              color: locale === currentLocale ? "#f8fafc" : "inherit",
              cursor: "pointer",
              fontWeight: locale === currentLocale ? 700 : 500,
              letterSpacing: "0.01em",
              padding: "0.35rem 0.75rem",
            }}
          >
            {locale.toUpperCase()}
          </button>
        ))}
      </div>
    </div>
  );
}
