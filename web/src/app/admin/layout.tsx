"use client";
import { Building2, ClipboardCheck, LayoutDashboard, ListChecks, ScrollText, Users } from "lucide-react";
import { RequireArea } from "@/components/guard";
import { PortalShell, type NavItem } from "@/components/shells";

const NAV: NavItem[] = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/organizations", label: "Orgs", icon: Building2 },
  { href: "/admin/missions", label: "Missions", icon: ListChecks },
  { href: "/admin/submissions", label: "Review", icon: ClipboardCheck },
  { href: "/admin/audit", label: "Audit", icon: ScrollText },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <RequireArea area="admin"><PortalShell nav={NAV} portal="Admin">{children}</PortalShell></RequireArea>;
}
