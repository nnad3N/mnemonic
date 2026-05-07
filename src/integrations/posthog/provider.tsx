import { PostHogProvider as BasePostHogProvider } from "@posthog/react";
import { posthog } from "posthog-js";
import type { ReactNode } from "react";

if (typeof window !== "undefined" && import.meta.env.VITE_POSTHOG_KEY) {
  posthog.init(import.meta.env.VITE_POSTHOG_KEY, {
    api_host: import.meta.env.VITE_POSTHOG_HOST ?? "https://eu.i.posthog.com",
    capture_pageview: false,
    defaults: "2025-11-30",
    person_profiles: "identified_only",
  });
}

type PostHogProviderProps = {
  children: ReactNode;
};

export default function PostHogProvider({ children }: PostHogProviderProps) {
  return <BasePostHogProvider client={posthog}>{children}</BasePostHogProvider>;
}
