"use client";
import Link from "next/link";
import { Card, ErrorState, LoadingBlock, PageHeader, Stat } from "@/components/ui";
import { fmtDateTime } from "@/lib/format";
import { api } from "@/lib/store/api";
import { useApi } from "@/lib/store/hooks";

export default function AdminOverview() {
  const o = useApi(() => api.adminOverview());
  if (o.error) return <ErrorState error={o.error} onRetry={o.reload} />;
  if (!o.data) return <LoadingBlock />;
  const d = o.data;
  return (
    <div className="space-y-8">
      <PageHeader title="Platform overview" subtitle="Live counts from the platform database." />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Users" value={d.users} hint={`${d.volunteers} volunteers · ${d.suspended} suspended`} />
        <Stat label="Organizations" value={d.organizations} hint={`${d.pendingOrganizations} awaiting approval`} tone="info" />
        <Stat label="Missions" value={d.missions} hint={`${d.publishedMissions} published`} tone="success" />
        <Stat label="Pending reviews" value={d.pendingSubmissions} hint={`${d.flagged} flagged`} tone="reward" />
      </div>
      {(d.pendingOrganizations > 0 || d.flagged > 0) && (
        <Card className="space-y-2 border-secondary p-5">
          <p className="font-semibold">Needs attention</p>
          {d.pendingOrganizations > 0 && <p className="t-small"><Link className="font-semibold text-primary underline underline-offset-4" href="/admin/organizations">{d.pendingOrganizations} organization(s)</Link> waiting for approval.</p>}
          {d.flagged > 0 && <p className="t-small"><Link className="font-semibold text-primary underline underline-offset-4" href="/admin/submissions">{d.flagged} flagged submission(s)</Link> with a high automatic risk score.</p>}
        </Card>
      )}
      <section aria-labelledby="act-h">
        <h2 id="act-h" className="t-h2 mb-3">Recent activity</h2>
        <Card className="divide-y divide-border">
          {d.recentActivity.map((a) => (
            <div key={a.id} className="flex flex-wrap items-center justify-between gap-2 p-4 t-small">
              <span><span className="font-mono font-semibold">{a.action}</span> <span className="text-muted">{a.detail}</span></span>
              <span className="text-muted">{fmtDateTime(a.timestamp)}</span>
            </div>
          ))}
        </Card>
      </section>
    </div>
  );
}
