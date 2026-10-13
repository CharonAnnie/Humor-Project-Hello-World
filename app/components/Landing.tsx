import GoogleSignInButton from "./GoogleSignInButton";

type Props = {
  // Active voice labels, read from the database so this copy can't claim a
  // line-up the generator no longer offers.
  voiceLabels: string[];
  notice?: string | null;
};

// What a signed-out visitor sees at `/`: what the app is, and a way in. No
// captions, no uploaded photos, no scores — none of the content is fetched on
// this path, let alone rendered.
export default function Landing({ voiceLabels, notice = null }: Props) {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-16 sm:py-24">
      <section className="max-w-2xl">
        <span className="voice-chip">AI captions · daily votes</span>

        <h1 className="mt-5 text-4xl font-semibold tracking-tight sm:text-5xl">
          Your photo, captioned by AI. The funniest one wins.
        </h1>

        <p className="mt-4 text-[17px] leading-relaxed text-muted">
          Caption Drop is a caption contest with Gemini doing the writing.
          Upload any photo and it comes back captioned in
          {voiceLabels.length > 0 ? ` ${voiceLabels.length} ` : " several "}
          different voices. Everyone else votes on which one actually lands.
        </p>

        <div className="mt-8 max-w-xs">
          <GoogleSignInButton label="Sign in to start" notice={notice} />
          <p className="mt-3 text-xs leading-relaxed text-muted">
            The gallery is for members only, so sign in to see what people have
            been captioning. We only use your Google account to sign you in.
          </p>
        </div>
      </section>

      <section className="mt-16">
        <h2 className="text-xs font-medium uppercase tracking-wider text-muted">
          How it works
        </h2>

        <ol className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Step
            number={1}
            title="Drop a photo"
            body="Anything you want captioned, plus a line of context if the joke needs it."
          />
          <Step
            number={2}
            title="Gemini writes"
            body="One caption per voice, in a few seconds. The exact prompt is saved with each one."
          />
          <Step
            number={3}
            title="The room votes"
            body="Up or down on every caption. The best of the day climb the leaderboard."
          />
        </ol>
      </section>

      {voiceLabels.length > 0 && (
        <section className="mt-10">
          <h2 className="text-xs font-medium uppercase tracking-wider text-muted">
            Today&apos;s voices
          </h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {voiceLabels.map((label) => (
              <span key={label} className="voice-chip">
                {label}
              </span>
            ))}
          </div>
        </section>
      )}

      <section className="card mt-10 p-6">
        <h2 className="text-sm font-semibold">Vote every day, keep a streak</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          The leaderboard resets at midnight Eastern, so yesterday&apos;s winner
          has to earn it again. Vote at least once a day and your streak keeps
          counting.
        </p>
      </section>
    </main>
  );
}

function Step({
  number,
  title,
  body,
}: {
  number: number;
  title: string;
  body: string;
}) {
  return (
    <li className="card flex flex-col gap-2 p-5">
      <span className="step-number" aria-hidden>
        {number}
      </span>
      <h3 className="text-sm font-semibold">{title}</h3>
      <p className="text-sm leading-relaxed text-muted">{body}</p>
    </li>
  );
}
