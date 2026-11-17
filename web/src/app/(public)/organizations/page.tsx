"use client";
import { Building2, MapPin } from "lucide-react";
import { Badge, ButtonLink, Card, EmptyState, ErrorState, LoadingBlock, PageHeader } from "@/components/ui";
import { api } from "@/lib/store/api";
import { useApi } from "@/lib/store/hooks";

export default function OrganizationsPage() {
  const orgs = useApi(() => api.publicOrganizations());
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <PageHeader
        title="Organizations"
        subtitle="Every organization is reviewed by the WORFIX team before it can publish missions."
        actions={<ButtonLink href="/register?type=organization">Register your organization</ButtonLink>}
      />
      {orgs.error ? <ErrorState error={orgs.error} onRetry={orgs.reload} /> : !orgs.data ? <LoadingBlock /> : orgs.data.length === 0 ? (
        <EmptyState title="No approved organizations yet" body="Organizations appear here once they are approved." icon={<Building2 className="size-8" />} />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {orgs.data.map((o) => (
            <Card key={o.id} className="p-6">
              <div className="flex items-start justify-between gap-3">
                <h2 className="t-h3 text-balance">{o.name}</h2>
                <Badge tone="success">Approved</Badge>
              </div>
              <p className="t-small mt-1 text-muted">{o.organizationType}</p>
              <p className="t-small mt-3 line-clamp-4">{o.description}</p>
              <p className="t-small mt-4 flex items-center gap-1.5 text-muted"><MapPin className="size-4" aria-hidden /> {o.city}, {o.country}</p>
              <p className="t-small mt-1 text-muted">{o.totalMissions} missions · {o.totalVolunteers} volunteers joined</p>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
