import GoogleSignInButton from "./GoogleSignInButton";

// The sign-in card at `/login`. A server component now: the only interactive
// part is the button, which brings its own client boundary.
export default function SignInPrompt({
  title = "Welcome back",
  subtitle = "Sign in to generate captions and vote on everyone else's.",
  notice = null,
}: {
  title?: string;
  subtitle?: string;
  notice?: string | null;
}) {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-6 py-16">
      <div className="card p-8">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">{subtitle}</p>

        <div className="mt-8">
          <GoogleSignInButton notice={notice} />
        </div>
      </div>

      <p className="mt-6 text-center text-xs text-muted">
        We only use your Google account to sign you in.
      </p>
    </main>
  );
}
