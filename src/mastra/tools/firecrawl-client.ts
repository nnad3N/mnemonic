import { Firecrawl } from "firecrawl";

import { env } from "@/env";

export const firecrawl = new Firecrawl({
  apiUrl: env.FIRECRAWL_API_URL,
});
