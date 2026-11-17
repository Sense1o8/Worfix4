"use client";
import clsx from "clsx";
import { Bell, ChevronRight, LogOut, Menu } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, type ComponentType, type ReactNode } from "react";
import { Logo } from "./brand";
import { PageTransition } from "./page-transition";
import { ThemeToggle } from "./theme";
import { Avatar, ButtonLink } from "./ui";
import { Dialog } from "./ui/dialog";
import { useToast } from "./ui/toast";
import { homeForRole } from "@/lib/domain/permissions";
import { api } from "@/lib/store/api";
import { useApi } from "@/lib/store/hooks";

export function useMe() {
  return useApi(() => api.me());
}

/* ── Public site shell ───────────────────────────────── */
const PUBLIC_NAV = [
  { href: "/missions", label: "Explore missions" },
  { href: "/impact", label: "Impact" },
  { href: "/organizations", label: "Organizations" },
  { href: "/about", label: "About" },
];

export function PublicShell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const me = useMe();
  const user = me.data;
  return (
    <div className="flex min-h-dvh flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[70] focus:rounded-md focus:bg-surface focus:px-4 focus:py-2 focus:shadow-high">
        Skip to content
      </a>
      <header className="sticky top-0 z-40 border-b border-border bg-bg/90 backdrop-blur supports-[backdrop-filter]:bg-bg/80">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Logo />
          <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
            {PUBLIC_NAV.map((n) => (
              <Link key={n.href} href={n.href} aria-current={path.startsWith(n.href) ? "page" : undefined}
                className={clsx("rounded-md px-3 py-2 text-sm font-medium transition-colors duration-150 hover:bg-surface-2", path.startsWith(n.href) ? "text-text" : "text-muted")}>
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <div className="hidden items-center gap-2 md:flex">
              {user ? (
                <ButtonLink href={homeForRole(user.role)} size="sm">Open dashboard</ButtonLink>
              ) : (
                <>
                  <ButtonLink href="/login" variant="ghost" size="sm">Log in</ButtonLink>
                  <ButtonLink href="/register" size="sm">Join WORFIX</ButtonLink>
                </>
              )}
            </div>
            <button type="button" aria-label="Open menu" onClick={() => setOpen(true)}
              className="inline-flex size-11 items-center justify-center rounded-md hover:bg-surface-2 active:scale-95 transition-transform duration-150 md:hidden">
              <Menu className="size-5" aria-hidden />
            </button>
          </div>
        </div>
      </header>

      <Dialog open={open} onClose={() => setOpen(false)} title="Menu">
        <nav aria-label="Mobile" className="flex flex-col gap-1" onClick={() => setOpen(false)}>
          {PUBLIC_NAV.map((n) => (
            <Link key={n.href} href={n.href} className="flex min-h-12 items-center justify-between rounded-md px-3 font-medium hover:bg-surface-2">
              {n.label} <ChevronRight className="size-4 text-muted" aria-hidden />
            </Link>
          ))}
          <div className="mt-3 grid gap-2">
            {user ? (
              <ButtonLink href={homeForRole(user.role)}>Open dashboard</ButtonLink>
            ) : (
              <>
                <ButtonLink href="/register">Join WORFIX</ButtonLink>
                <ButtonLink href="/login" variant="secondary">Log in</ButtonLink>
              </>
            )}
          </div>
        </nav>
      </Dialog>

      <main id="main" className="flex-1"><PageTransition>{children}</PageTransition></main>

      <footer className="border-t border-border bg-surface">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr]">
          <div className="space-y-3">
            <Logo />
            <p className="t-small max-w-xs text-muted">Small Actions. Big Impact. Real, verified volunteering for people, organizations and communities.</p>
          </div>
          <FooterCol title="Platform" links={[["/missions", "Explore missions"], ["/impact", "Impact overview"], ["/organizations", "Organizations"], ["/verify", "Verify a certificate"]]} />
          <FooterCol title="Get started" links={[["/register", "Create an account"], ["/login", "Log in"], ["/about", "About WORFIX"]]} />
        </div>
      </footer>
    </div>
  );
}

function FooterCol({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <nav aria-label={title}>
      <p className="mb-3 text-sm font-semibold">{title}</p>
      <ul className="space-y-1">
        {links.map(([href, label]) => (
          <li key={href}><Link href={href} className="inline-block py-1 text-sm text-muted hover:text-text">{label}</Link></li>
        ))}
      </ul>
    </nav>
  );
}

/* ── Portal shell (volunteer / organization / admin) ──── */
export interface NavItem { href: string; label: string; icon: ComponentType<{ className?: string }>; exact?: boolean; except?: string }

export function PortalShell({ nav, portal, children }: { nav: NavItem[]; portal: string; children: ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const toast = useToast();
  const me = useMe();
  const notes = useApi(() => api.myNotifications().catch(() => []));
  const unread = (notes.data ?? []).filter((n) => !n.read).length;
  const bellHref = portal === "Admin" ? "/admin" : portal === "Organization" ? "/org/notifications" : "/app/notifications";
  const active = (n: NavItem) => (n.exact ? path === n.href : (path === n.href || path.startsWith(n.href + "/")) && !(n.except && path.startsWith(n.except)));
  const logout = async () => {
    await api.logout();
    toast.info("You're signed out.");
    router.replace("/");
  };
  return (
    <div className="min-h-dvh md:grid md:grid-cols-[248px_1fr]">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[70] focus:rounded-md focus:bg-surface focus:px-4 focus:py-2 focus:shadow-high">Skip to content</a>
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-border bg-surface p-4 md:flex">
        <div className="px-2 pb-6 pt-2"><Logo /></div>
        <p className="px-3 pb-2 t-caption font-semibold uppercase text-muted">{portal} portal</p>
        <nav aria-label={`${portal} navigation`} className="flex flex-1 flex-col gap-1">
          {nav.map((n) => (
            <Link key={n.href} href={n.href} aria-current={active(n) ? "page" : undefined}
              className={clsx("flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-medium transition-[background-color,color] duration-150",
                active(n) ? "bg-primary-soft text-on-primary-soft" : "text-muted hover:bg-surface-2 hover:text-text")}>
              <n.icon className="size-5" aria-hidden /> {n.label}
            </Link>
          ))}
        </nav>
        <button type="button" onClick={logout} className="flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-medium text-muted hover:bg-surface-2 hover:text-text">
          <LogOut className="size-5" aria-hidden /> Log out
        </button>
      </aside>

      <div className="flex min-w-0 flex-col pb-20 md:pb-0">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-bg/90 px-4 backdrop-blur sm:px-6">
          <div className="md:hidden"><Logo /></div>
          <div className="hidden md:block" />
          <div className="flex items-center gap-1">
            <Link href={bellHref} aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
              className="relative inline-flex size-11 items-center justify-center rounded-md text-muted hover:bg-surface-2 hover:text-text active:scale-95 transition-transform duration-150">
              <Bell className="size-5" aria-hidden />
              {unread > 0 && <span aria-hidden className="absolute right-2 top-2 flex min-w-4 items-center justify-center rounded-full bg-accent-fill px-1 text-[10px] font-bold text-on-accent-fill">{unread > 9 ? "9+" : unread}</span>}
            </Link>
            <ThemeToggle />
            {me.data && (
              <div className="ml-1 hidden items-center gap-2 sm:flex">
                <Avatar name={me.data.fullName} src={me.data.avatar} size={32} />
                <span className="max-w-32 truncate text-sm font-medium">{me.data.fullName}</span>
              </div>
            )}
            <button type="button" onClick={logout} aria-label="Log out" className="inline-flex size-11 items-center justify-center rounded-md text-muted hover:bg-surface-2 md:hidden">
              <LogOut className="size-5" aria-hidden />
            </button>
          </div>
        </header>
        <main id="main" className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:px-6 sm:py-8"><PageTransition>{children}</PageTransition></main>
      </div>

      <nav aria-label={`${portal} navigation`} className="fixed inset-x-0 bottom-0 z-30 grid border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] md:hidden" style={{ gridTemplateColumns: `repeat(${Math.min(nav.length, 5)}, 1fr)` }}>
        {nav.slice(0, 5).map((n) => (
          <Link key={n.href} href={n.href} aria-current={active(n) ? "page" : undefined}
            className={clsx("flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors duration-150", active(n) ? "text-primary" : "text-muted")}>
            <n.icon className="size-5" aria-hidden /> {n.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
