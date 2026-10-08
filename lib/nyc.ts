// "Daily" means an Eastern-time calendar day, not a UTC one: a vote cast at 8pm
// on the US East Coast belongs to that evening, not to tomorrow. Leaderboards and
// streaks both reset on this boundary.
//
// The database is the source of truth for vote_date (the column defaults to
// `(now() at time zone 'America/New_York')::date`). This helper exists so the UI
// can compare against the same day without a round trip.
const NYC_DATE = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/New_York",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

// Returns the current New York date as "YYYY-MM-DD", matching a Postgres `date`
// rendered by PostgREST.
export function nycToday(): string {
  return NYC_DATE.format(new Date());
}

// Yesterday in Eastern time, used to tell a streak that is still alive from one that
// has already lapsed.
export function nycYesterday(): string {
  const today = new Date(`${nycToday()}T12:00:00Z`);
  today.setUTCDate(today.getUTCDate() - 1);
  return today.toISOString().slice(0, 10);
}
