"use client";
import { Award, Compass, LayoutDashboard, ListChecks, Newspaper, UserRound, Users } from "lucide-react";
import { RequireArea } from "@/components/guard";
import { PortalShell, type NavItem } from "@/components/shells";

const NAV: NavItem[] = [
  // The first five also form the mobile bottom bar; Friends and Certificates are linked from Home and Profile there.
  { href: "/app", label: "Home", icon: LayoutDashboard, exact: true },
  { href: "/app/feed", label: "Feed", icon: Newspaper },
  { href: "/missions", label: "Discover", icon: Compass },
  { href: "/app/missions", label: "My missions", icon: ListChecks },
  { href: "/app/profile", label: "Profile", icon: UserRound },
  { href: "/app/friends", label: "Friends", icon: Users },
  { href: "/app/certificates", label: "Certificates", icon: Award },
];

export default function VolunteerLayout({ children }: { children: React.ReactNode }) {
  return <RequireArea area="volunteer"><PortalShell nav={NAV} portal="Volunteer">{children}</PortalShell></RequireArea>;
}
