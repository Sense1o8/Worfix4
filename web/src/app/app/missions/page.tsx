"use client";
import { ListChecks } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Badge, ButtonLink, EmptyState, ErrorState, LoadingBlock, PageHeader, Tabs } from "@/components/ui";
import { VERIFICATION_LABEL, VERIFICATION_TONE, fmtDateTime } from "@/lib/format";
import { api } from "@/lib/store/api";
import { useApi } from "@/lib/store/hooks";

type Tab = "upcoming" | "progress" | "review" | "done" | "rejected";

export default function MyMissions() {
  const [tab, setTab] = useState<Tab>("upcoming");
  const res = useApi(() => api.myParticipations());
  if (res.error) return <ErrorState error={res.error} onRetry={res.reload} />;
  if (!res.data) return <LoadingBlock />;

  const now = Date.now();
  const bucket = (p: (typeof res.data)[number]): Tab => {
    const s = p.submission?.verificationStatus;
    if (s === "approved") return "done";
    if (s === "rejected") return "rejected";
    if (s === "pending") return "review";
    if (s === "needs_more_info") return "progress";
    return Date.parse(p.mission.date) > now ? "upcoming" : "progress";
  };
  const groups: Record<Tab, typeof res.data> = { upcoming: [], progress: [], review: [], done: [], rejected: [] };
  for (const p of res.data) groups[bucket(p)].push(p);
  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: "upcoming", label: "Upcoming", count: groups.upcoming.length },
    { id: "progress", label: "In progress", count: groups.progress.length },
    { id: "review", label: "In review", count: groups.review.length },
    { id: "done", label: "Completed", count: groups.done.length },
    { id: "rejected", label: "Not approved", count: groups.rejected.length },
  ];
  const empty: Record<Tab, string> = {
    upcoming: "Missions you've joined that haven't started yet appear here.",
    progress: "Missions that have started and need your evidence appear here.",
    review: "Submissions waiting for a reviewer appear here.",
    done: "Approved missions, with your rewards and certificates, appear here.",
    rejected: "Nothing here. Rejected submissions would appear with the reviewer's reason.",
  };
  const list = groups[tab];

  return (
    <div>
      <PageHeader title="My missions" actions={<ButtonLink href="/missions" variant="secondary">Find more missions</ButtonLink>} />
      <Tabs label="Mission status" tabs={tabs} value={tab} onChange={setTab} />
      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="mt-5">
        {list.length === 0 ? (
          <EmptyState title="Nothing here yet" body={empty[tab]} icon={<ListChecks className="size-8" />} action={tab === "upcoming" ? <ButtonLink href="/missions">Explore missions</ButtonLink> : undefined} />
        ) : (
          <ul className="space-y-3">
            {list.map(({ mission, submission, organizationName }) => (
              <li key={mission.id}>
                <Link href={`/app/missions/${mission.id}`} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface p-4 transition-shadow duration-200 hover:shadow-med">
                  <div>
                    <p className="font-semibold">{mission.title}</p>
                    <p className="t-small text-muted">{organizationName} · {fmtDateTime(mission.date)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {submission && <Badge tone={VERIFICATION_TONE[submission.verificationStatus]}>{VERIFICATION_LABEL[submission.verificationStatus]}</Badge>}
                    <Badge tone="reward">+{mission.rewardXP} XP</Badge>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
