"use client";
import { Pencil, Send, Trash2 } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { Avatar, Badge, Button, ButtonLink, Card, EmptyState, ErrorState, LoadingBlock, PageHeader, Table } from "@/components/ui";
import { Dialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { CATEGORY_LABEL, MISSION_STATUS_LABEL, VERIFICATION_LABEL, fmtDateTime } from "@/lib/format";
import { api } from "@/lib/store/api";
import { useApi } from "@/lib/store/hooks";

type PRow = Awaited<ReturnType<typeof api.missionParticipants>>[number];

export default function ManageMission() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const res = useApi(() => api.getMission(id), [id]);
  const parts = useApi(() => api.missionParticipants(id).catch(() => [] as PRow[]), [id]);
  const [busy, setBusy] = useState<string | null>(null);
  const [view, setView] = useState<PRow | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (res.error) return <ErrorState error={res.error} onRetry={res.reload} />;
  if (res.loading && !res.data) return <LoadingBlock />;
  if (!res.data) return <EmptyState title="Mission not found" body="It may have been deleted." action={<ButtonLink href="/org/missions">Back to missions</ButtonLink>} />;
  const m = res.data.mission;

  const run = (key: string, fn: () => Promise<unknown>, ok: string, after?: () => void) => async () => {
    setBusy(key);
    try { await fn(); toast.success(ok); after?.(); } catch (e) { toast.error((e as Error).message); }
    setBusy(null);
  };

  return (
    <div className="space-y-8">
      <div>
        <Link href="/org/missions" className="t-small text-muted hover:text-text">← Missions</Link>
        <PageHeader title={m.title} subtitle={`${CATEGORY_LABEL[m.category]} · ${fmtDateTime(m.date)} · ${m.participantsCount}/${m.capacity} volunteers`}
          actions={<>
            <Badge tone={m.status === "published" ? "success" : "neutral"}>{MISSION_STATUS_LABEL[m.status]}</Badge>
            {(m.status === "draft" || m.status === "published") && <ButtonLink href={`/org/missions/${m.id}/edit`} variant="secondary"><Pencil className="size-4" aria-hidden /> Edit</ButtonLink>}
            {m.status === "draft" && <Button loading={busy === "pub"} onClick={run("pub", () => api.publishMission(m.id), "Mission published.")}><Send className="size-4" aria-hidden /> Publish</Button>}
            {m.status === "published" && <Button variant="secondary" loading={busy === "close"} onClick={run("close", () => api.closeMission(m.id), "Mission closed.")}>Close mission</Button>}
            {m.status === "draft" && <Button variant="danger" onClick={() => setConfirmDelete(true)}><Trash2 className="size-4" aria-hidden /> Delete draft</Button>}
          </>} />
        {m.moderationNote && <p role="note" className="rounded-md bg-error-soft p-3 t-small text-on-error-soft"><strong>Moderator note:</strong> {m.moderationNote}</p>}
      </div>

      <section aria-labelledby="p-h">
        <h2 id="p-h" className="t-h2 mb-3">Participants</h2>
        {!parts.data ? <LoadingBlock rows={2} /> : parts.data.length === 0 ? <EmptyState title="No volunteers yet" body={m.status === "draft" ? "Publish the mission so volunteers can join." : "Volunteers who join appear here."} /> : (
          <Table>
            <thead><tr><th scope="col">Volunteer</th><th scope="col">Status</th><th scope="col">Evidence</th><th scope="col"><span className="sr-only">Actions</span></th></tr></thead>
            <tbody>
              {parts.data.map((p) => (
                <tr key={p.participant.id}>
                  <td><button type="button" onClick={() => setView(p)} className="flex min-h-11 items-center gap-2 text-left font-semibold underline-offset-4 hover:underline"><Avatar name={p.volunteer.fullName} src={p.volunteer.avatar} size={28} /> {p.volunteer.fullName}</button></td>
                  <td className="capitalize">{p.participant.status}</td>
                  <td>{p.submissionStatus ? VERIFICATION_LABEL[p.submissionStatus] : "—"}</td>
                  <td className="text-right">
                    {p.submissionStatus ? <Link href="/org/review" className="font-semibold text-primary underline underline-offset-4">Review</Link> : p.participant.status === "accepted" ? (
                      <Button size="sm" variant="secondary" loading={busy === p.participant.id} onClick={run(p.participant.id, () => api.decideParticipant(m.id, p.volunteer.id, "rejected"), "Participant removed.")}>Decline</Button>
                    ) : p.participant.status === "rejected" ? (
                      <Button size="sm" variant="secondary" loading={busy === p.participant.id} onClick={run(p.participant.id, () => api.decideParticipant(m.id, p.volunteer.id, "accepted"), "Participant accepted.")}>Accept</Button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </section>

      <Dialog open={!!view} onClose={() => setView(null)} title={view?.volunteer.fullName ?? ""}>
        {view && (
          <dl className="space-y-3 text-sm">
            {[["Username", `@${view.volunteer.username}`], ["Location", [view.volunteer.city, view.volunteer.country].filter(Boolean).join(", ") || "—"], ["Level", String(view.volunteer.level)], ["Languages", view.volunteer.languages.join(", ") || "—"], ["Skills", view.volunteer.skills.join(", ") || "—"], ["Causes", view.volunteer.interests.join(", ") || "—"], ["About", view.volunteer.bio || "—"]].map(([k, v]) => (
              <div key={k}><dt className="t-caption text-muted">{k}</dt><dd className="font-medium capitalize-first">{v}</dd></div>
            ))}
          </dl>
        )}
      </Dialog>

      <Dialog open={confirmDelete} onClose={() => setConfirmDelete(false)} title={`Delete “${m.title}”?`}>
        <p className="t-small text-muted">This draft will be permanently removed.</p>
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setConfirmDelete(false)} data-autofocus>Keep draft</Button>
          <Button variant="danger" loading={busy === "del"} onClick={run("del", () => api.deleteDraft(m.id), "Draft deleted.", () => router.replace("/org/missions"))}>Delete draft</Button>
        </div>
      </Dialog>
      <Card className="p-5 t-small text-muted">Rewards are fixed by difficulty and duration: {m.rewardXP} XP and {m.rewardPoints} points per approved volunteer.</Card>
    </div>
  );
}
