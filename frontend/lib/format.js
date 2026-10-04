// Today's date as YYYY-MM-DD in the user's local time zone (the "en-CA" locale formats dates that way)
export const todayLocal = () => new Date().toLocaleDateString("en-CA");

// Turns "2026-10-03" into "Oct 3, 2026".
// The parts are read by hand because new Date("2026-10-03") means midnight UTC,
// which shows up as the previous day in time zones behind UTC.
export function formatDate(ymd) {
  const [year, month, day] = ymd.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// Turns a timestamp like "2026-10-03T14:05:00.000Z" into "Oct 3, 2026, 2:05 PM" in the viewer's time zone
export function formatDateTime(isoString) {
  return new Date(isoString).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
