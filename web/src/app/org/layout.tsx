"use client";
import { Building2, ClipboardCheck, LayoutDashboard, ListChecks, Sparkles } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { RequireArea } from "@/components/guard";
import { PortalShell, useMe, type NavItem } from "@/components/shells";
import { Badge, LoadingBlock } from "@/components/ui";
import { api } from "@/lib/store/api";
import { useApi } from "@/lib/store/hooks";

const NAV: NavItem[] = [
  { href: "/org", label: "Home", icon: LayoutDashboard, exact: true },
  { href: "/org/missions", label: "Missions", icon: ListChecks, except: "/org/missions/ai" },
  { href: "/org/missions/ai", label: "AI agent", icon: Sparkles },
  { href: "/org/review", label: "Review", icon: ClipboardCheck },
  { href: "/org/profile", label: "Organization", icon: Building2 },
];

function OrgGate({ children }: { children: ReactNode }) {
  const me = useMe();
  const org = useApi(() => api.myOrganization().catch(() => null));
  const router = useRouter();
  const path = usePathname();
  const isOrgUser = me.data?.role === "organization";
  const needsOrg = isOrgUser && org.data === null && path !== "/org/register";
  useEffect(() => { if (needsOrg) router.replace("/org/register"); }, [needsOrg, router]);
  if (!me.data || (isOrgUser && org.data === undefined) || needsOrg) return <LoadingBlock />;
  return (
    <>
      {org.data && org.data.verificationStatus !== "approved" && (
        <div role="status" className={`mb-6 rounded-lg p-4 t-small ${org.data.verificationStatus === "pending" ? "bg-warning-soft text-on-warning-soft" : "bg-error-soft text-on-error-soft"}`}>
          <p className="font-semibold"><Badge tone={org.data.verificationStatus === "pending" ? "warning" : "danger"}>{org.data.verificationStatus === "pending" ? "Awaiting approval" : "Not approved"}</Badge></p>
          <p className="mt-2">{org.data.verificationStatus === "pending" ? "The WORFIX team is reviewing your organization. You can prepare draft missions now; publishing unlocks once you're approved." : `Reason: ${org.data.verificationNote || "No reason given."} Update your organization details and contact support.`}</p>
        </div>
      )}
      {children}
    </>
  );
}

export default function OrgLayout({ children }: { children: ReactNode }) {
  return <RequireArea area="organization"><PortalShell nav={NAV} portal="Organization"><OrgGate>{children}</OrgGate></PortalShell></RequireArea>;
}
