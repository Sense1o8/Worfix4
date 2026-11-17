"use client";
import { Plus, ListChecks, Sparkles } from "lucide-react";
import Link from "next/link";
import { Badge, ButtonLink, EmptyState, ErrorState, LoadingBlock, PageHeader } from "@/components/ui";
import { MISSION_STATUS_LABEL, fmtDateTime } from "@/lib/format";
import { api } from "@/lib/store/api";
import { useApi } from "@/lib/store/hooks";

const TONE = { draft: "neutral", pending_review: "warning", published: "success", closed: "info", cancelled: "danger" } as const;

export default function OrgMissions() {
  const res = useApi(() => api.listMissions({ scope: "mine" }));
  return (
    <div>
      <PageHeader title="Your missions" actions={<><ButtonLink href="/org/missions/ai" variant="secondary"><Sparkles className="size-4" aria-hidden /> Draft with AI</ButtonLink><ButtonLink href="/org/missions/new"><Plus className="size-4" aria-hidden /> New mission</ButtonLink></>} />
      {res.error ? <ErrorState error={res.error} onRetry={res.reload} /> : !res.data ? <LoadingBlock /> : res.data.length === 0 ? (
        <EmptyState title="No missions yet" body="Create your first mission as a draft, then publish it once your organization is approved." icon={<ListChecks className="size-8" />} action={<ButtonLink href="/org/missions/new">Create a mission</ButtonLink>} />
      ) : (
        <ul className="space-y-3">
          {res.data.map((m) => (
            <li key={m.id}>
              <Link href={`/org/missions/${m.id}`} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface p-4 transition-shadow duration-200 hover:shadow-med">
                <div><p className="font-semibold">{m.title}</p><p className="t-small text-muted">{fmtDateTime(m.date)} · {m.participantsCount}/{m.capacity} volunteers</p></div>
                <Badge tone={TONE[m.status]}>{MISSION_STATUS_LABEL[m.status]}</Badge>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
