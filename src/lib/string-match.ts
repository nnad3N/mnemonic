/** Case-insensitive substring match; empty, whitespace or missing query matches everything. */
export const matchesQuery = (value: string, query: string | undefined): boolean => {
  const trimmedQuery = query?.trim().toLowerCase() ?? "";

  return trimmedQuery.length === 0 || value.toLowerCase().includes(trimmedQuery);
};
