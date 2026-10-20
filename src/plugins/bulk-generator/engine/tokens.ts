/**
 * Slugify string helper.
 *
 * Mirrors EmDash's own slugify (@emdash-cms/admin/slugify) so the slug we
 * expect matches the one EmDash auto-generates from an entry's title. The
 * plugin content API cannot set a slug directly, so an exact match here keeps
 * skip_existing / update_existing from silently creating duplicates.
 */
export function slugify(text: string): string {
  return text
    .toString()
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\s_]+/gu, "-")
    .replace(/[^\p{Letter}\p{Number}\p{Mark}-]+/gu, "")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");
}

/**
 * Replace {{token}} or {{token | filter}} in a template string
 * Filters supported:
 * - slug: converts to URL slug
 * - lower: to lowercase
 * - upper: to uppercase
 * - title: Title Case
 */
export function substituteTokens(template: string, row: Record<string, string>): string {
  if (!template) return "";

  return template.replace(/\{\{\s*([a-zA-Z0-9_\-]+)(?:\s*\|\s*([a-zA-Z0-9_\-]+))?\s*\}\}/g, (_, key, filter) => {
    let val = row[key] ?? row[key.trim()] ?? "";

    if (filter) {
      const f = filter.trim().toLowerCase();
      if (f === "slug") val = slugify(val);
      else if (f === "lower") val = val.toLowerCase();
      else if (f === "upper") val = val.toUpperCase();
      else if (f === "title") val = val.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.slice(1).toLowerCase());
    }

    return val;
  });
}

/**
 * Deeply replaces {{token}} in strings, arrays, and nested block objects
 */
export function deepSubstituteTokens<T>(input: T, row: Record<string, string>): T {
  if (typeof input === "string") {
    return substituteTokens(input, row) as unknown as T;
  }
  if (Array.isArray(input)) {
    return input.map((item) => deepSubstituteTokens(item, row)) as unknown as T;
  }
  if (input !== null && typeof input === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(input)) {
      if (key === "_key") {
        result[key] = Math.random().toString(36).substring(2, 10);
      } else {
        result[key] = deepSubstituteTokens(val, row);
      }
    }
    return result as unknown as T;
  }
  return input;
}
