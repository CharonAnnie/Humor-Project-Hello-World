import Image from "next/image";
import Avatar from "./Avatar";
import DeleteCaptionButton from "./DeleteCaptionButton";
import VoteButtons from "./VoteButtons";

export type DropCaption = {
  id: string;
  text: string;
  prompt: string | null;
  voiceLabel: string | null;
  score: number;
  myVote: -1 | 0 | 1;
  // True only for the signed-in author of this caption, who gets its delete
  // control. Decided on the server; RLS and the action check it again.
  isMine: boolean;
};

export type DropCardData = {
  imageId: string;
  imageUrl: string | null;
  imageWidth: number | null;
  imageHeight: number | null;
  // Whoever dropped the photo. One upload produces every caption under it, so
  // this is shown once for the card rather than per caption.
  authorFirstName: string | null;
  authorLastName: string | null;
  authorAvatarUrl: string | null;
  captions: DropCaption[];
};

// One photo and every caption written for it. Deleting a caption only removes
// that row; when the last one goes the photo has nothing left to show, so the
// gallery query stops returning it and the card goes with it.
export default function DropCard({ drop }: { drop: DropCardData }) {
  const hasAuthor = Boolean(drop.authorFirstName || drop.authorLastName);
  const count = drop.captions.length;

  return (
    <li className="card flex flex-col overflow-hidden">
      {drop.imageUrl && drop.imageWidth && drop.imageHeight && (
        // Fixed-ratio box so cards in a row line up, and `contain` so a tall
        // photo isn't cropped through the middle of the joke.
        <div className="relative aspect-square w-full overflow-hidden border-b border-line bg-foreground/[0.03]">
          <Image
            src={drop.imageUrl}
            alt={drop.captions[0]?.text ?? "A photo someone dropped"}
            width={drop.imageWidth}
            height={drop.imageHeight}
            sizes="(max-width: 1024px) 100vw, 480px"
            className="h-full w-full object-contain"
          />
        </div>
      )}

      <div className="flex flex-1 flex-col gap-3 p-5">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-medium uppercase tracking-wider text-muted">
            {count} {count === 1 ? "caption" : "captions"}
          </span>

          {hasAuthor ? (
            <span className="flex items-center gap-1.5 text-xs text-muted">
              <Avatar
                url={drop.authorAvatarUrl}
                firstName={drop.authorFirstName}
                lastName={drop.authorLastName}
                size={20}
              />
              {drop.authorFirstName ?? "Someone"}
            </span>
          ) : (
            <span className="text-xs text-muted">House captions</span>
          )}
        </div>

        <ul className="divide-y divide-line">
          {drop.captions.map((caption) => (
            <li
              key={caption.id}
              className="flex flex-col gap-2.5 py-3.5 first:pt-1 last:pb-0"
            >
              {caption.voiceLabel && (
                <span className="voice-chip">{caption.voiceLabel}</span>
              )}

              <p className="text-[15px] leading-relaxed">{caption.text}</p>

              <div className="flex items-center justify-between gap-3">
                {/* Each caption is voted and deleted on its own, even though
                    they share a photo. */}
                <VoteButtons
                  captionId={caption.id}
                  score={caption.score}
                  myVote={caption.myVote}
                  canVote
                />

                {caption.isMine && (
                  <DeleteCaptionButton
                    captionId={caption.id}
                    describedAs={
                      caption.voiceLabel
                        ? `your ${caption.voiceLabel} caption`
                        : "your caption"
                    }
                  />
                )}
              </div>

              {/* Requirement: the exact prompt is stored with every caption.
                  Showing it is also the most interesting part of the product. */}
              {caption.prompt && (
                <details className="prompt-reveal">
                  <summary>Prompt used</summary>
                  <pre>{caption.prompt}</pre>
                </details>
              )}
            </li>
          ))}
        </ul>
      </div>
    </li>
  );
}
