import { nycToday, nycYesterday } from "@/lib/nyc";

type Props = {
  currentStreak: number;
  lastVoteDate: string | null;
  className?: string;
};

// A streak counts consecutive New York days with at least one vote. The database
// trigger advances it; this only decides how to describe it.
//
// A streak whose last vote was yesterday is still live — voting today extends it.
// One older than that has already lapsed, so it is shown as dormant rather than
// silently claiming a run the user no longer has.
export default function StreakBadge({
  currentStreak,
  lastVoteDate,
  className,
}: Props) {
  const today = nycToday();
  const votedToday = lastVoteDate === today;
  const live = votedToday || lastVoteDate === nycYesterday();
  const streak = live ? currentStreak : 0;

  if (streak === 0) {
    return (
      <span className={`streak-badge text-muted ${className ?? ""}`}>
        <span aria-hidden>○</span>
        Vote today to start a streak
      </span>
    );
  }

  return (
    <span
      className={`streak-badge ${className ?? ""}`}
      data-live={votedToday ? "true" : undefined}
      title={
        votedToday
          ? "You've voted today. Come back tomorrow to keep it going."
          : "Vote today to keep your streak alive."
      }
    >
      <span aria-hidden>{votedToday ? "🔥" : "⏳"}</span>
      {streak} day{streak === 1 ? "" : "s"}
      {!votedToday && <span className="text-muted">· vote today</span>}
    </span>
  );
}
