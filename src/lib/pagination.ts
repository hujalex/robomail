export const parseLimit = (
  value: string | undefined,
  {
    min = 1,
    max = 100,
    fallback = 20,
  }: { min?: number; max?: number; fallback?: number } = {},
): number => {
  if (!value) {
    return fallback;
  }
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) {
    return fallback;
  }
  return Math.max(min, Math.min(max, parsed));
};

export const finalizeList = <T extends { id: string }>(
  rows: T[],
  limit: number,
): { object: "list"; data: T[]; has_more: boolean; next_cursor: string | null } => {
  const hasMore = rows.length > limit;
  const data = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? data[data.length - 1]?.id ?? null : null;
  return { object: "list", data, has_more: hasMore, next_cursor: nextCursor };
};
