import { getTranslationsSnapshot, initializeGT } from "gt-tanstack-start";

import loadTranslations from "@/load-translations";

import gtConfig from "../../gt.config.json";

initializeGT({
  ...gtConfig,
  loadTranslations,
});

export const testTranslations = await getTranslationsSnapshot("en");
