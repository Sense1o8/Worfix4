"use client";
/* eslint-disable @next/next/no-img-element -- evidence/avatars are local data URLs; next/image cannot optimise them */
import { Check, Circle, ImagePlus, MapPin, Video, X } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useRef, useState } from "react";
import { Badge, Button, ButtonLink, Card, Checkbox, EmptyState, ErrorState, LoadingBlock, Textarea } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import type { Evidence } from "@/lib/domain/types";
import { VERIFICATION_LABEL, VERIFICATION_TONE, fmtDateTime } from "@/lib/format";
import { api, ValidationError } from "@/lib/store/api";
import { useApi } from "@/lib/store/hooks";
import { getPosition, prepareImage } from "@/lib/store/images";

export default function ParticipationPage() {
  const { id } = useParams<{ id: string }>();
  const res = useApi(() => api.myParticipations());
  const toast = useToast();
  const [leaving, setLeaving] = useState(false);
  if (res.error) return <ErrorState error={res.error} onRetry={res.reload} />;
  if (!res.data) return <LoadingBlock />;
  const p = res.data.find((x) => x.mission.id === id);
  if (!p) return <EmptyState title="You haven't joined this mission" body="Join it from the mission page to add evidence here." action={<ButtonLink href={`/missions/${id}`}>View mission</ButtonLink>} />;
  const { mission: m, submission: s, organizationName } = p;
  const status = s?.verificationStatus;
  const canSubmit = !s || status === "needs_more_info";
  const started = Date.parse(m.date) <= Date.now();

  const steps = [
    { label: "Joined", done: true },
    { label: "Evidence submitted", done: !!s },
    { label: "Under review", done: status === "approved" || status === "rejected" },
    { label: status === "rejected" ? "Not approved" : "Verified", done: status === "approved" },
  ];

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <Link href="/app/missions" className="t-small text-muted hover:text-text">← My missions</Link>
        <h1 className="t-h1 mt-2 text-balance">{m.title}</h1>
        <p className="t-sub">{organizationName} · {fmtDateTime(m.date)} · <Link href={`/missions/${m.id}`} className="underline underline-offset-4">mission details</Link></p>
      </div>

      <Card className="p-6">
        <ol aria-label="Progress" className="grid grid-cols-4 gap-2">
          {steps.map((st, i) => (
            <li key={st.label} className="flex flex-col items-center gap-2 text-center" aria-current={!st.done && steps[i - 1]?.done ? "step" : undefined}>
              <span className={`flex size-8 items-center justify-center rounded-full ${st.done ? "bg-primary text-on-primary" : "bg-surface-2 text-muted"}`}>{st.done ? <Check className="size-4" aria-hidden /> : <Circle className="size-3" aria-hidden />}</span>
              <span className={`t-caption ${st.done ? "font-semibold" : "text-muted"}`}>{st.label}</span>
            </li>
          ))}
        </ol>
      </Card>

      {s && (
        <Card className="space-y-4 p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="t-h3">Your submission</h2>
            <Badge tone={VERIFICATION_TONE[s.verificationStatus]}>{VERIFICATION_LABEL[s.verificationStatus]}</Badge>
          </div>
          {s.reviewNote && (
            <p role="note" className={`rounded-md p-3 t-small ${status === "approved" ? "bg-primary-soft text-on-primary-soft" : status === "rejected" ? "bg-error-soft text-on-error-soft" : "bg-secondary-soft text-on-secondary-soft"}`}>
              <strong>Reviewer note:</strong> {s.reviewNote}
            </p>
          )}
          {status === "pending" && <p className="t-small text-muted">An organizer will review your evidence. You&apos;ll get a notification when there&apos;s a decision.</p>}
          {status === "approved" && <ButtonLink href="/app/certificates">See your certificate</ButtonLink>}
          {s.images.length > 0 && (
            <ul className="grid grid-cols-3 gap-2">
              {s.images.map((im) => (
                <li key={im.sha256}><img src={im.dataUrl} alt={`Evidence photo ${im.name}`} className="aspect-square w-full rounded-md object-cover" /></li>
              ))}
            </ul>
          )}
          {s.notes && <p className="t-small whitespace-pre-line text-muted">{s.notes}</p>}
          <p className="t-caption text-muted">Submitted {fmtDateTime(s.timestamp)}{s.gps ? " · location shared with reviewers" : ""}</p>
        </Card>
      )}

      {canSubmit && (
        <>
          {!started && <p role="note" className="rounded-md bg-secondary-soft p-3 t-small text-on-secondary-soft">This mission starts {fmtDateTime(m.date)}. You can submit evidence after you&apos;ve taken part. Submissions sent before the start time are flagged for the reviewer.</p>}
          <EvidenceForm missionId={m.id} resubmit={status === "needs_more_info"} />
        </>
      )}

      {!s && (
        <div>
          <Button variant="ghost" loading={leaving} onClick={async () => {
            setLeaving(true);
            try { await api.leaveMission(m.id); toast.success("You left the mission."); } catch (e) { toast.error((e as Error).message); setLeaving(false); }
          }}>Withdraw from this mission</Button>
        </div>
      )}
    </div>
  );
}

function EvidenceForm({ missionId, resubmit }: { missionId: string; resubmit: boolean }) {
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [images, setImages] = useState<Evidence[]>([]);
  const [notes, setNotes] = useState("");
  const [consent, setConsent] = useState(false);
  const [gps, setGps] = useState<{ lat: number; lng: number; accuracy: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const add = async (files: FileList | null) => {
    if (!files) return;
    for (const f of Array.from(files)) {
      if (images.length >= 4) { toast.error("Up to 4 photos per submission."); break; }
      try {
        const ev = await prepareImage(f);
        setImages((cur) => (cur.some((c) => c.sha256 === ev.sha256) ? (toast.info("That photo is already added."), cur) : [...cur, ev]));
      } catch (e) { toast.error((e as Error).message); }
    }
    setErrors({});
  };

  const locate = async () => {
    setLocating(true);
    try { setGps(await getPosition()); toast.success("Location captured."); } catch (e) { toast.error((e as Error).message); }
    setLocating(false);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    try {
      await api.submitEvidence(missionId, { notes, gpsConsent: consent, gps: consent ? gps : null, images });
      toast.success(resubmit ? "Thanks — your update is back in the review queue." : "Evidence submitted. A reviewer will take a look.");
      setImages([]); setNotes(""); setGps(null); setConsent(false);
    } catch (err) {
      if (err instanceof ValidationError) setErrors(err.fields);
      toast.error((err as Error).message);
    }
    setBusy(false);
  };

  return (
    <Card className="p-6">
      <h2 className="t-h3">{resubmit ? "Add the information requested" : "Submit your evidence"}</h2>
      <p className="t-small mt-1 text-muted">Photos should show you taking part at the mission. Only submit your own, genuine photos.</p>
      <form onSubmit={submit} noValidate className="mt-5 space-y-5">
        <div>
          <p id="photos-l" className="mb-2 text-sm font-medium">Photos <span className="text-error" aria-hidden>*</span></p>
          <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" aria-labelledby="photos-l" onChange={(e) => { void add(e.target.files); e.target.value = ""; }} />
          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {images.map((im) => (
              <li key={im.sha256} className="relative">
                
                <img src={im.dataUrl} alt={`Selected photo ${im.name}`} className="aspect-square w-full rounded-md object-cover" />
                <button type="button" aria-label={`Remove photo ${im.name}`} onClick={() => setImages((c) => c.filter((x) => x !== im))} className="absolute -right-2 -top-2 flex size-8 items-center justify-center rounded-full bg-text text-bg shadow-med active:scale-95"><X className="size-4" aria-hidden /></button>
              </li>
            ))}
            {images.length < 4 && (
              <li><button type="button" onClick={() => input.current?.click()} className="flex aspect-square w-full flex-col items-center justify-center gap-1 rounded-md border border-dashed border-border-strong text-muted transition-colors duration-150 hover:bg-surface-2 active:scale-[0.98]"><ImagePlus className="size-6" aria-hidden /><span className="t-caption">Add photo</span></button></li>
            )}
          </ul>
          {errors.images && <p role="alert" className="t-small mt-2 font-medium text-error">{errors.images}</p>}
          <p className="t-caption mt-2 flex items-center gap-1.5 text-muted"><Video className="size-3.5" aria-hidden /> Video upload needs cloud storage and isn&apos;t available in local demo mode.</p>
        </div>

        <Textarea label="Notes (optional)" rows={3} value={notes} error={errors.notes} onChange={(e) => setNotes(e.target.value)} hint="What did you do? Anything the reviewer should know?" />

        <fieldset className="space-y-2 rounded-md bg-surface-2 p-4">
          <legend className="sr-only">Location</legend>
          <Checkbox checked={consent} onChange={(e) => { setConsent(e.target.checked); if (!e.target.checked) setGps(null); }} label={<><strong>Share my location with the reviewer (optional).</strong> It helps confirm you were at the mission. It is never shown publicly and is only used for this submission.</>} />
          {consent && (
            <div className="flex flex-wrap items-center gap-3 pl-8">
              <Button variant="secondary" size="sm" loading={locating} onClick={locate}><MapPin className="size-4" aria-hidden /> {gps ? "Update location" : "Capture my location"}</Button>
              {gps && <span className="t-small text-muted">Captured (±{Math.round(gps.accuracy)} m)</span>}
            </div>
          )}
        </fieldset>

        <Button type="submit" size="lg" className="w-full" loading={busy}>{resubmit ? "Send update" : "Submit for review"}</Button>
      </form>
    </Card>
  );
}
