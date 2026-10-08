import Image from "next/image";
import Avatar from "./Avatar";
import VoteButtons from "./VoteButtons";

export type CaptionCardData = {
  id: string;
  text: string;
  voiceLabel: string | null;
  prompt: string | null;
  createdAt: string;
  score: number;
  myVote: -1 | 0 | 1;
  imageUrl: string | null;
  imageWidth: number | null;
  imageHeight: number | null;
  authorFirstName: string | null;
  authorLastName: string | null;
  authorAvatarUrl: string | null;
};

export default function CaptionCard({
  caption,
  canVote,
}: {
  caption: CaptionCardData;
  canVote: boolean;
}) {
  const hasAuthor = Boolean(caption.authorFirstName || caption.authorLastName);

  return (
    <li className="card group flex flex-col overflow-hidden transition-shadow hover:shadow-md">
      {caption.imageUrl && caption.imageWidth && caption.imageHeight && (
        // Fixed-ratio box so cards in a row line up, and `contain` so a tall
        // photo isn't cropped through the middle of the joke.
        <div className="relative aspect-square w-full overflow-hidden border-b border-line bg-foreground/[0.03]">
          <Image
            src={caption.imageUrl}
            alt={caption.text}
            width={caption.imageWidth}
            height={caption.imageHeight}
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 360px"
            className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-[1.02]"
          />
        </div>
      )}

      <div className="flex flex-1 flex-col gap-3 p-5">
        {caption.voiceLabel && (
          <span className="voice-chip">{caption.voiceLabel}</span>
        )}

        <p className="flex-1 text-[15px] leading-relaxed">{caption.text}</p>

        <div className="flex items-center justify-between gap-3">
          <VoteButtons
            captionId={caption.id}
            score={caption.score}
            myVote={caption.myVote}
            canVote={canVote}
          />

          {hasAuthor ? (
            <span className="flex items-center gap-1.5 text-xs text-muted">
              <Avatar
                url={caption.authorAvatarUrl}
                firstName={caption.authorFirstName}
                lastName={caption.authorLastName}
                size={20}
              />
              {caption.authorFirstName ?? "Someone"}
            </span>
          ) : (
            <span className="text-xs text-muted">House caption</span>
          )}
        </div>

        {/* Requirement: the exact prompt is stored with every caption. Showing it
            is also the most interesting part of the product. */}
        {caption.prompt && (
          <details className="prompt-reveal">
            <summary>Prompt used</summary>
            <pre>{caption.prompt}</pre>
          </details>
        )}
      </div>
    </li>
  );
}
