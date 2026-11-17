"use client";
import { ErrorState, LoadingBlock, PageHeader, Stat, Card, EmptyState, ButtonLink } from "@/components/ui";
import { api } from "@/lib/store/api";
import { useApi } from "@/lib/store/hooks";

export default function ImpactPage() {
  const s = useApi(() => api.publicStats());
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <PageHeader title="Impact overview" subtitle="Only approved, human-verified submissions count here. Nothing is estimated." />
      {s.error ? <ErrorState error={s.error} onRetry={s.reload} /> : !s.data ? <LoadingBlock /> : (
        <div className="space-y-8">
          {s.data.includesDemoData && (
            <p role="note" className="rounded-md bg-warning-soft p-4 t-small text-on-warning-soft">
              <strong>Demonstration data.</strong> This site is running in local demo mode. Figures reflect submissions made in this browser, including demo accounts, and are not real-world totals.
            </p>
          )}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Stat label="Verified actions" value={s.data.verifiedActions} tone="success" />
            <Stat label="Volunteer hours" value={s.data.hours} tone="info" />
            <Stat label="Volunteers" value={s.data.volunteers} />
            <Stat label="Approved organizations" value={s.data.organizations} />
          </div>
          <section aria-labelledby="out-h">
            <h2 id="out-h" className="t-h2 mb-4">Outcomes</h2>
            {Object.keys(s.data.impact).length === 0 ? (
              <EmptyState title="No verified outcomes yet" body="Outcomes appear after the first mission submission is approved." action={<ButtonLink href="/missions">Find a mission</ButtonLink>} />
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {Object.entries(s.data.impact).map(([label, n]) => (
                  <Card key={label} className="p-6"><p className="text-4xl font-bold tabular-nums text-primary">{n.toLocaleString()}</p><p className="mt-1 capitalize text-muted">{label}</p></Card>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
