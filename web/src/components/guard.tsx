"use client";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { homeForRole, type Area } from "@/lib/domain/permissions";
import { api } from "@/lib/store/api";
import { useApi } from "@/lib/store/hooks";
import { LoadingBlock } from "./ui";

/**
 * Client-side route protection. This is UX only: in the local dev store, and in Firebase,
 * every data call re-checks the session and role on its own (see api.ts / Firestore rules).
 * Children never render for an unauthorised user, so no protected UI flashes.
 */
export function RequireArea({ area, children }: { area: Area; children: ReactNode }) {
  const router = useRouter();
  const path = usePathname();
  const g = useApi(() => api.guard(area), [area]);
  const user = g.data?.user ?? null;
  const allowed = g.data?.allowed ?? false;

  // Volunteers finish onboarding first; organizations register their organization first.
  const needsOnboarding = allowed && user?.role === "volunteer" && !user.onboarded && path !== "/app/onboarding";

  useEffect(() => {
    if (g.loading || !g.data) return;
    if (!user) router.replace(`/login?next=${encodeURIComponent(path)}`);
    else if (!allowed) router.replace(homeForRole(user.role));
    else if (needsOnboarding) router.replace("/app/onboarding");
  }, [g.loading, g.data, user, allowed, needsOnboarding, path, router]);

  if (g.loading || !user || !allowed || needsOnboarding) {
    return <div className="mx-auto max-w-3xl p-6"><LoadingBlock /></div>;
  }
  return <>{children}</>;
}
