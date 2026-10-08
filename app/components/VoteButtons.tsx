"use client";

import { useOptimistic, useState, useTransition } from "react";
import Link from "next/link";
import { castVote } from "@/app/actions/votes";

type Props = {
  captionId: string;
  score: number;
  // 0 means "no vote from me", which keeps the optimistic arithmetic simple.
  myVote: -1 | 0 | 1;
  canVote: boolean;
};

export default function VoteButtons({
  captionId,
  score,
  myVote,
  canVote,
}: Props) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Score is the net total, so flipping an upvote to a downvote moves it by two.
  // React discards this and re-reads the server value once the action settles.
  const [optimistic, applyVote] = useOptimistic(
    { score, myVote },
    (state, next: -1 | 0 | 1) => ({
      score: state.score + (next - state.myVote),
      myVote: next,
    }),
  );

  if (!canVote) {
    return (
      <div className="flex items-center gap-2">
        <Link
          href="/login"
          className="vote-group text-muted hover:text-foreground"
          title="Sign in to vote"
        >
          <span className="vote-btn" aria-hidden>
            {upArrow}
          </span>
          <span className="vote-score">{score}</span>
          <span className="vote-btn" aria-hidden>
            {downArrow}
          </span>
        </Link>
        <span className="sr-only">Sign in to vote on this caption</span>
      </div>
    );
  }

  const submit = (value: 1 | -1) => {
    setError(null);
    // Pressing the arrow you already chose retracts the vote.
    const next: -1 | 0 | 1 = optimistic.myVote === value ? 0 : value;

    startTransition(async () => {
      applyVote(next);
      const result = await castVote(captionId, value);
      if (!result.ok) setError(result.message);
    });
  };

  return (
    <div className="flex items-center gap-2">
      <div className="vote-group" data-pending={isPending || undefined}>
        <button
          type="button"
          onClick={() => submit(1)}
          aria-label="Upvote"
          aria-pressed={optimistic.myVote === 1}
          className="vote-btn"
          data-active={optimistic.myVote === 1 || undefined}
        >
          {upArrow}
        </button>

        <span className="vote-score" aria-live="polite">
          {optimistic.score}
        </span>

        <button
          type="button"
          onClick={() => submit(-1)}
          aria-label="Downvote"
          aria-pressed={optimistic.myVote === -1}
          className="vote-btn"
          data-active={optimistic.myVote === -1 || undefined}
        >
          {downArrow}
        </button>
      </div>

      {error && <span className="text-xs text-red-600 dark:text-red-400">{error}</span>}
    </div>
  );
}

const upArrow = (
  <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden>
    <path
      d="M8 3.5 13 10H3L8 3.5Z"
      fill="currentColor"
    />
  </svg>
);

const downArrow = (
  <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden>
    <path
      d="M8 12.5 3 6h10l-5 6.5Z"
      fill="currentColor"
    />
  </svg>
);
