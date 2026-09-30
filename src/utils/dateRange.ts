// Calendar dates for report periods.
//
// `new Date(year, month, 0).toISOString().split('T')[0]` looks like it returns
// the last day of the month, but toISOString() converts to UTC first. In Sri
// Lanka (UTC+5:30) local midnight on the 30th is 18:30 UTC on the 29th, so the
// string comes back as the 29th and the whole last day of the month silently
// drops out of the report. Build period dates from the local calendar instead.

/** A Date as YYYY-MM-DD in the local calendar — never shifted into UTC. */
export const toLocalDateString = (date: Date): string => {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
};

/** First day of a month as YYYY-MM-DD. `month` is 1-based (1 = January). */
export const monthStartDate = (year: number, month: number): string =>
  `${year}-${String(month).padStart(2, '0')}-01`;

/** Last day of a month as YYYY-MM-DD. `month` is 1-based (9 = September). */
export const monthEndDate = (year: number, month: number): string =>
  toLocalDateString(new Date(year, month, 0));
