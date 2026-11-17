import Link from "next/link";

/** Original WORFIX mark: a seedling rising from a sun arc. */
export function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden fill="none">
      <rect width="32" height="32" rx="9" fill="var(--primary)" />
      <path d="M6 22a10 10 0 0 1 20 0" stroke="var(--accent-fill)" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M16 24V13" stroke="var(--on-primary)" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M16 15c0-3.2-2.2-5-5.5-5 0 3.3 2 5 5.5 5Z" fill="var(--on-primary)" />
      <path d="M16 17c0-2.8 2-4.4 5-4.4 0 2.9-1.8 4.4-5 4.4Z" fill="var(--on-primary)" opacity=".85" />
    </svg>
  );
}

export function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="inline-flex items-center gap-2.5 font-bold tracking-tight" aria-label="WORFIX home">
      <LogoMark />
      <span className="text-lg">WORFIX</span>
    </Link>
  );
}
