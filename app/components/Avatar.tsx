import Image from "next/image";

type Props = {
  url: string | null;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  size: number;
};

// Falls back to initials so a profile without a photo still looks deliberate
// rather than broken.
export default function Avatar({
  url,
  firstName,
  lastName,
  email,
  size,
}: Props) {
  const initials =
    [firstName?.[0], lastName?.[0]].filter(Boolean).join("").toUpperCase() ||
    email?.[0]?.toUpperCase() ||
    "?";

  if (url) {
    return (
      <Image
        src={url}
        alt=""
        width={size}
        height={size}
        className="rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <div
      aria-hidden
      className="avatar-fallback rounded-full"
      style={{ width: size, height: size, fontSize: size * 0.36 }}
    >
      {initials}
    </div>
  );
}
