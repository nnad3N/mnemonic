export const modelCapabilityLevels = ["standard", "balanced", "max"] as const;

export type ModelCapability = (typeof modelCapabilityLevels)[number];

export const DEFAULT_MODEL_CAPABILITY = "standard" as const satisfies ModelCapability;
