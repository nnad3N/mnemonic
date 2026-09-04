import { Firecrawl } from "firecrawl";

import { env } from "@/env";

export const FIRECRAWL_SCRAPE_TIMEOUT_MS = 30_000;
export const FIRECRAWL_SEARCH_TIMEOUT_MS = 15_000;

export const firecrawl = new Firecrawl({
  apiUrl: env.FIRECRAWL_API_URL,
});
