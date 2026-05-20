export type JsonResult<T> = { ok: true; value: T } | { ok: false; error: string };

export const readJson = async <T>(
  c: { req: { json: () => Promise<unknown> } },
): Promise<JsonResult<T>> => {
  try {
    return { ok: true, value: (await c.req.json()) as T };
  } catch {
    return { ok: false, error: "Invalid JSON body" };
  }
};

export const requireString = (value: unknown, field: string): string | null => {
  if (typeof value !== "string" || value.trim().length === 0) {
    return `${field} is required`;
  }
  return null;
};

export const parseStringArray = (
  value: unknown,
  field: string,
  { required = false }: { required?: boolean } = {},
): JsonResult<string[]> => {
  if (value === undefined || value === null) {
    if (required) return { ok: false, error: `${field} is required` };
    return { ok: true, value: [] };
  }
  if (Array.isArray(value)) {
    if (!value.every((entry) => typeof entry === "string")) {
      return { ok: false, error: `${field} must be an array of strings` };
    }
    return { ok: true, value };
  }
  if (typeof value === "string") return { ok: true, value: [value] };
  return { ok: false, error: `${field} must be a string or array of strings` };
};

export const parseMetadata = (
  value: unknown,
  field: string,
): JsonResult<Record<string, unknown>> => {
  if (value === undefined || value === null) return { ok: true, value: {} };
  if (typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, error: `${field} must be an object` };
  }
  return { ok: true, value: value as Record<string, unknown> };
};
