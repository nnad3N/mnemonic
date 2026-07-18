import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ThemeProviderProps } from "next-themes";

export const ThemeProvider = ({ children, ...props }: ThemeProviderProps) => (
  <NextThemesProvider
    attribute="class"
    defaultTheme="system"
    disableTransitionOnChange
    enableSystem
    {...props}
  >
    {children}
  </NextThemesProvider>
);
