// Date-range helpers for report filters.
//
// Date inputs give calendar dates (YYYY-MM-DD). The server stores
// timestamptz, so range boundaries must be real instants. Building them in
// the browser's local timezone (the hospital's) keeps "today" meaning the
// hospital's today — appending "Z" would shift both boundaries by the UTC
// offset and query the wrong window.

// Start of the local calendar day as a UTC instant
export function localDayStart(date: string): string {
  return new Date(`${date}T00:00:00`).toISOString();
}

// End of the local calendar day as a UTC instant
export function localDayEnd(date: string): string {
  return new Date(`${date}T23:59:59.999`).toISOString();
}

// Local calendar date N days ago, formatted YYYY-MM-DD
export function localDateDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
}

// Today's local calendar date, formatted YYYY-MM-DD
export function localToday(): string {
  return localDateDaysAgo(0);
}
