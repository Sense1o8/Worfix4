"use client";
/* eslint-disable @next/next/no-img-element -- evidence/avatars are local data URLs; next/image cannot optimise them */
import { AlertTriangle, CheckCircle2, HelpCircle, ShieldAlert, XCircle } from "lucide-react";
import { useState } from "react";
import { Badge, Button, Card, EmptyState, ErrorState, LoadingBlock, Tabs, Textarea } from "./ui";
import { Dialog } from "./ui/dialog";
import { useToast } from "./ui/toast";
import type { ReviewDecision } from "@/lib/domain/verification";
import type { VerificationStatus } from "@/lib/domain/types";
import { VERIFICATION_LABEL, VERIFICATION_TONE, fmtDateTime } from "@/lib/format";
import { api } from "@/lib/store/api";
import { useApi } from "@/lib/store/hooks";

type Row = Awaited<ReturnType<typeof api.reviewQueue>>[number];
type Tab = VerificationStatus | "flagged";

const DIALOG: Record<ReviewDecision, { title: string; cta: string; hint: string; variant: "primary" | "danger" | "secondary" }> = {
  approved: { title: "Approve this submission?", cta: "Approve and reward", hint: "XP, points and a certificate are granted once. This can't be undone.", variant: "primary" },
  rejected: { title: "Reject this submission", cta: "Reject submission", hint: "Explain why. The volunteer sees this note. Rejection is final.", variant: "danger" },
  needs_more_info: { title: "Request more information", cta: "Send request", hint: "Say exactly what to add. The volunteer can submit more evidence.", variant: "secondary" },
};

export function ReviewQueue({ scope }: { scope: "org" | "admin" }) {
  const toast = useToast();
  const res = useApi(() => api.reviewQueue(scope), [scope]);
  const [tab, setTab] = useState<Tab>("pending");
  const [action, setAction] = useState<{ row: Row; decision: ReviewDecision } | null>(null);
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  if (res.error) return <ErrorState error={res.error} onRetry={res.reload} />;
  if (!res.data) return <LoadingBlock />;
  const rows = res.data;
  const count = (s: VerificationStatus) => rows.filter((r) => r.submission.verificationStatus === s).length;
  const flagged = rows.filter((r) => r.submission.fraudScore >= 0.5 && r.submission.verificationStatus === "pending");
  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: "pending", label: "Pending", count: count("pending") },
    ...(scope === "admin" ? [{ id: "flagged" as Tab, label: "Fraud alerts", count: flagged.length }] : []),
    { id: "needs_more_info", label: "Info requested", count: count("needs_more_info") },
    { id: "approved", label: "Approved", count: count("approved") },
    { id: "rejected", label: "Rejected", count: count("rejected") },
  ];
  const list = tab === "flagged" ? flagged : rows.filter((r) => r.submission.verificationStatus === tab);

  const close = () => { setAction(null); setNote(""); setErr(""); };
  const confirm = async () => {
    if (!action) return;
    if (action.decision !== "approved" && note.trim().length < 5) return setErr("Add a short explanation (at least 5 characters).");
    setBusy(true);
    try {
      await api.review(action.row.submission.id, action.decision, note);
      toast.success(action.decision === "approved" ? "Approved. Rewards and certificate issued." : action.decision === "rejected" ? "Submission rejected." : "Information requested.");
      close();
    } catch (e) { setErr((e as Error).message); toast.error((e as Error).message); }
    setBusy(false);
  };

  return (
    <div>
      <Tabs label="Submission status" tabs={tabs} value={tab} onChange={setTab} />
      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="mt-5 space-y-4">
        {list.length === 0 ? (
          <EmptyState title="Nothing to review here" body={tab === "pending" ? "New submissions appear here as volunteers send evidence." : "No submissions in this state."} icon={<CheckCircle2 className="size-8" />} />
        ) : list.map((r) => {
          const s = r.submission;
          return (
            <Card key={s.id} className="space-y-4 p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="t-h3">{r.mission.title}</h3>
                  <p className="t-small text-muted">{r.volunteer.fullName} (@{r.volunteer.username}) · level {r.volunteer.level} · {r.volunteer.city || "—"} · {fmtDateTime(s.timestamp)}</p>
                </div>
                <Badge tone={VERIFICATION_TONE[s.verificationStatus]}>{VERIFICATION_LABEL[s.verificationStatus]}</Badge>
              </div>

              {s.images.length > 0 ? (
                <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {s.images.map((im) => <li key={im.sha256}><img src={im.dataUrl} alt={`Evidence photo ${im.name} from ${r.volunteer.fullName}`} className="aspect-square w-full rounded-md object-cover" /></li>)}
                </ul>
              ) : <p className="t-small text-muted">Evidence was removed (account deleted).</p>}
              {s.notes && <p className="t-small whitespace-pre-line rounded-md bg-surface-2 p-3">{s.notes}</p>}

              <div className={`rounded-md p-3 t-small ${s.fraudScore >= 0.5 ? "bg-error-soft text-on-error-soft" : s.fraudFlags.length ? "bg-warning-soft text-on-warning-soft" : "bg-primary-soft text-on-primary-soft"}`}>
                <p className="flex items-center gap-2 font-semibold">
                  {s.fraudScore >= 0.5 ? <ShieldAlert className="size-4" aria-hidden /> : s.fraudFlags.length ? <AlertTriangle className="size-4" aria-hidden /> : <CheckCircle2 className="size-4" aria-hidden />}
                  Automatic checks (advisory): risk {Math.round(s.fraudScore * 100)}%
                </p>
                {s.fraudFlags.length > 0 ? <ul className="mt-1 list-disc pl-5">{s.fraudFlags.map((f) => <li key={f}>{f}</li>)}</ul> : <p className="mt-1">No issues found. A person still makes the decision.</p>}
                {s.gps && <p className="mt-1">Volunteer shared location (±{Math.round(s.gps.accuracy)} m).</p>}
              </div>

              {s.reviewNote && <p className="t-small text-muted"><strong>Review note:</strong> {s.reviewNote}</p>}

              {s.verificationStatus === "pending" && (
                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => setAction({ row: r, decision: "approved" })}><CheckCircle2 className="size-4" aria-hidden /> Approve</Button>
                  <Button variant="secondary" onClick={() => setAction({ row: r, decision: "needs_more_info" })}><HelpCircle className="size-4" aria-hidden /> Request more info</Button>
                  <Button variant="danger" onClick={() => setAction({ row: r, decision: "rejected" })}><XCircle className="size-4" aria-hidden /> Reject</Button>
                </div>
              )}
            </Card>
          );
        })}
      </div>

      <Dialog open={!!action} onClose={close} title={action ? DIALOG[action.decision].title : ""}>
        {action && (
          <div className="space-y-4">
            <p className="t-small text-muted">{DIALOG[action.decision].hint}</p>
            {action.decision === "approved" && <p className="rounded-md bg-accent-soft p-3 t-small text-on-accent-soft">Reward: +{action.row.mission.rewardXP} XP and {action.row.mission.rewardPoints} points (plus any streak bonus), and a certificate for {action.row.volunteer.fullName}.</p>}
            <Textarea label={action.decision === "approved" ? "Note to volunteer (optional)" : "Note to volunteer"} required={action.decision !== "approved"} rows={3} value={note} error={err} onChange={(e) => { setNote(e.target.value); setErr(""); }} data-autofocus />
            <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={close}>Cancel</Button>
              <Button variant={DIALOG[action.decision].variant === "secondary" ? "primary" : DIALOG[action.decision].variant} loading={busy} onClick={confirm}>{DIALOG[action.decision].cta}</Button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}
