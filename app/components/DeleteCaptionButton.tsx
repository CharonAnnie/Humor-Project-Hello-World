"use client";

import { useState, useTransition } from "react";
import { deleteCaption } from "@/app/actions/captions";

type Props = {
  captionId: string;
  // Named in the accessible label so a screen reader hears which caption is
  // going away, not just "delete".
  describedAs: string;
  // Passed by callers that keep their own copy of the list in state (the create
  // flow) or render their own error slot. Left off, the button leans on the
  // action's revalidation to drop the row and shows the error itself.
  onDeleted?: (captionId: string) => void;
  onError?: (message: string) => void;
};

// Deleting is irreversible, so the first click arms the button and the second
// confirms. Cheaper than a modal and it still prevents a misclick binning a
// caption the author liked.
export default function DeleteCaptionButton({
  captionId,
  describedAs,
  onDeleted,
  onError,
}: Props) {
  const [armed, setArmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const report = (message: string) => {
    if (onError) onError(message);
    else setError(message);
  };

  const onClick = () => {
    if (!armed) {
      setArmed(true);
      return;
    }

    setArmed(false);
    setError(null);

    // The action revalidates the gallery, the dashboard and the leaderboard, and
    // inside a transition that re-render arrives before the pending state drops
    // — so the row disappears instead of flashing back as "Delete".
    startTransition(async () => {
      const result = await deleteCaption(captionId);

      if (!result.ok) {
        report(result.message);
        return;
      }

      onDeleted?.(captionId);
    });
  };

  return (
    <span className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={onClick}
        // Walking away from a half-pressed button shouldn't leave it armed for
        // the next click.
        onBlur={() => setArmed(false)}
        disabled={isPending}
        className="caption-delete"
        data-armed={armed || undefined}
        aria-label={
          armed
            ? `Confirm deleting ${describedAs}`
            : `Delete ${describedAs}`
        }
      >
        {isPending ? "Deleting…" : armed ? "Really delete?" : "Delete"}
      </button>

      {error && (
        <span className="text-xs text-red-600 dark:text-red-400">{error}</span>
      )}
    </span>
  );
}
