// Small input checks shared by the routes.

// A database id sent as text or number, e.g. "12"
export const isId = (value) => /^\d+$/.test(String(value));

// "2026-10-02" is valid, "2026-02-31" is not
export function isValidDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
