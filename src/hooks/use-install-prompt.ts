import { useEffect, useState, useSyncExternalStore } from "react";

import { useMediaQuery } from "@/hooks/use-media-query";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

declare global {
  // Augmenting a lib interface is the only way to type this event without an assertion.
  // oxlint-disable-next-line typescript/consistent-type-definitions
  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent;
  }
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;
let listeners: (() => void)[] = [];

const emit = (): void => {
  for (const listener of listeners) {
    listener();
  }
};

// Chrome fires this once per page load and only while the app is not installed; capturing it at
// module scope rather than on subscribe means an early fire is not lost before the menu mounts.
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredPrompt = event;
    emit();
  });

  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    emit();
  });
}

const subscribe = (onStoreChange: () => void): (() => void) => {
  listeners.push(onStoreChange);

  return () => {
    listeners = listeners.filter((listener) => listener !== onStoreChange);
  };
};

const getSnapshot = (): boolean => deferredPrompt !== null;

const getServerSnapshot = (): boolean => false;

const promptInstall = async (): Promise<void> => {
  const event = deferredPrompt;

  if (!event) return;

  // The event is single-use; drop it before prompting so the affordance cannot fire twice.
  deferredPrompt = null;
  emit();

  await event.prompt();
};

type UseInstallPrompt = {
  canInstall: boolean;
  needsManualInstall: boolean;
  promptInstall: () => Promise<void>;
};

export const useInstallPrompt = (): UseInstallPrompt => {
  const canInstall = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const isStandalone = useMediaQuery("(display-mode: standalone)");
  const [isManualInstallPlatform, setIsManualInstallPlatform] = useState(false);

  useEffect(() => {
    // Safari never fires beforeinstallprompt. Its non-standard `navigator.standalone` marks the
    // platforms where installing is a manual Share-sheet step instead.
    setIsManualInstallPlatform("standalone" in navigator);
  }, []);

  return {
    canInstall,
    needsManualInstall: isManualInstallPlatform && !isStandalone,
    promptInstall,
  };
};
