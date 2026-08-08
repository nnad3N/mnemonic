const SECOND_MS = 1000;
const MINUTE_MS = 60 * SECOND_MS;
const HOUR_MS = 60 * MINUTE_MS;

export const duration = {
  FIVE: {
    MINUTES: 5 * MINUTE_MS,
  },
  ONE: {
    HOUR: HOUR_MS,
  },
} as const;
