"use client";
import { Plus } from "lucide-react";
import Link from "next/link";
import { useMe } from "@/components/shells";
import { ButtonLink, Card, ErrorState, LoadingBlock, PageHeader, Stat } from "@/components/ui";
import { api } from "@/lib/store/api";
import { useApi } from "@/lib/store/hooks";

export default function OrgDashboard() {
  const me = useMe();
  const a = useApi(() => api.orgAnalytics());
  if (me.data && me.data.role !== "organization") return <p className="t-small text-muted">You&apos;re viewing the organization portal as an administrator. Organization data appears for organization accounts.</p>;
  if (a.error) return <ErrorState error={a.error} onRetry={a.reload} />;
  if (!a.data) return <LoadingBlock />;
  const d = a.data;
  return (
    <div className="space-y-8">
      <PageHeader title="Organization overview" subtitle="Numbers below are computed from your real missions and reviewed submissions." actions={<ButtonLink href="/org/missions/new"><Plus className="size-4" aria-hidden /> New mission</ButtonLink>} />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Missions" value={d.missions} hint={`${d.published} published`} tone="success" />
        <Stat label="Volunteers" value={d.volunteers} tone="info" />
        <Stat label="Verified hours" value={d.hours} tone="reward" />
        <Stat label="Awaiting review" value={d.pending} hint={d.needsInfo ? `${d.needsInfo} info requested` : undefined} />
      </div>
      <section aria-labelledby="out-h">
        <h2 id="out-h" className="t-h2 mb-3">Review outcomes</h2>
        <Card className="grid grid-cols-3 divide-x divide-border text-center">
          {[["Approved", d.approved], ["Rejected", d.rejected], ["Approval rate", d.approvalRate === null ? "—" : `${d.approvalRate}%`]].map(([k, v]) => (
            <div key={k} className="p-5"><p className="text-3xl font-bold tabular-nums">{v}</p><p className="t-small text-muted">{k}</p></div>
          ))}
        </Card>
      </section>
      {d.pending > 0 && (
        <Card className="flex flex-wrap items-center justify-between gap-3 border-secondary p-5">
          <p className="font-semibold">{d.pending} submission{d.pending === 1 ? "" : "s"} waiting for your decision</p>
          <Link href="/org/review" className="font-semibold text-primary underline underline-offset-4">Review now</Link>
        </Card>
      )}
    </div>
  );
}
