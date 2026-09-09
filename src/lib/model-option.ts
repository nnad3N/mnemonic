import * as Kit from "@/lib/kit";

export const ModelOptions = Kit.literals.from()(["research", "analysis", "knowledge"]);

export type ModelOption = Kit.LiteralMember<typeof ModelOptions>;

export const DEFAULT_MODEL_OPTION = "research" as const satisfies ModelOption;
