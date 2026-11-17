"use client";
import { AlertTriangle, Calendar, CheckCircle2, Clock, Gauge, HardHat, MapPin, ShieldAlert, Target, Users } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { MapPreview } from "@/components/map-preview";
import { useMe } from "@/components/shells";
import { Badge, Button, ButtonLink, Card, EmptyState, ErrorState, LoadingBlock, ProgressBar } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { CATEGORY_LABEL, DIFFICULTY_LABEL, fmtDate, fmtDateTime, fmtDuration } from "@/lib/format";
import { api } from "@/lib/store/api";
import { useApi } from "@/lib/store/hooks";

export default function MissionDetail() {
  const { id } = useParams<{ id: string }>();
  const res = useApi(() => api.getMission(id), [id]);
  if (res.error) return <div className="mx-auto max-w-3xl p-6"><ErrorState error={res.error} onRetry={res.reload} /></div>;
  if (!res.data && res.loading) return <div className="mx-auto max-w-3xl p-6"><LoadingBlock /></div>;
  if (!res.data) return <div className="mx-auto max-w-3xl p-6"><EmptyState title="Mission not found" body="It may have been closed or removed." action={<ButtonLink href="/missions">Browse missions</ButtonLink>} /></div>;
  const { mission: m, organizationName } = res.data;
  const left = m.capacity - m.participantsCount;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <nav aria-label="Breadcrumb" className="mb-6 t-small text-muted"><Link href="/missions" className="hover:text-text">Missions</Link> / <span aria-current="page">{m.title}</span></nav>
      <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
        <div className="space-y-8">
          <header className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Badge tone="info">{CATEGORY_LABEL[m.category]}</Badge>
              <Badge>{DIFFICULTY_LABEL[m.difficulty]}</Badge>
              {m.isDemo && <Badge tone="warning">Demonstration mission</Badge>}
              {m.status !== "published" && <Badge tone="danger">{m.status}</Badge>}
            </div>
            <h1 className="t-h1 text-balance">{m.title}</h1>
            <p className="t-sub">Organized by <span className="font-semibold text-text">{organizationName}</span></p>
          </header>

          <section aria-labelledby="about-h"><h2 id="about-h" className="t-h2 mb-2">About this mission</h2><p className="whitespace-pre-line text-[1.0625rem] leading-relaxed">{m.description}</p></section>

          <section aria-labelledby="need-h" className="grid gap-4 sm:grid-cols-2">
            <h2 id="need-h" className="sr-only">What you need to know</h2>
            <Info icon={Target} title="Requirements" body={m.requirements || "No special requirements."} />
            <Info icon={HardHat} title="Equipment" body={m.equipment || "Nothing to bring."} />
            <Info icon={ShieldAlert} title="Safety instructions" body={m.safety} wide />
          </section>

          {m.coordinates && <section aria-labelledby="where-h"><h2 id="where-h" className="t-h2 mb-3">Location</h2><MapPreview lat={m.coordinates.lat} lng={m.coordinates.lng} label={m.location} /></section>}
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start" aria-label="Mission summary">
          <Card className="space-y-5 p-6">
            <dl className="space-y-3 text-sm">
              <Row icon={Calendar} label="Starts" value={fmtDateTime(m.date)} />
              <Row icon={Clock} label="Duration" value={fmtDuration(m.duration)} />
              <Row icon={MapPin} label="Where" value={m.location} />
              <Row icon={Gauge} label="Sign up by" value={fmtDate(m.deadline)} />
              <Row icon={Users} label="Volunteers" value={`${m.participantsCount} of ${m.capacity} (${left > 0 ? `${left} left` : "full"})`} />
            </dl>
            <ProgressBar value={m.participantsCount / m.capacity} label="Spots filled" tone="success" />
            <div className="rounded-md bg-accent-soft p-4 text-on-accent-soft">
              <p className="text-sm font-semibold">Reward when your evidence is approved</p>
              <p className="mt-1 text-2xl font-bold tabular-nums">+{m.rewardXP} XP <span className="text-base font-semibold">· {m.rewardPoints} points</span></p>
              {m.impactMetrics.map((i) => <p key={i.label} className="t-small mt-1">Impact: {i.amountPerVolunteer} {i.label} per volunteer</p>)}
            </div>
            <JoinPanel missionId={m.id} orgId={m.organizationId} full={left <= 0} deadlinePassed={Date.parse(m.deadline) < Date.now()} open={m.status === "published"} />
          </Card>
        </aside>
      </div>
    </div>
  );
}

function Row({ icon: I, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return <div className="flex gap-3"><I className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden /><div><dt className="t-caption text-muted">{label}</dt><dd className="font-medium">{value}</dd></div></div>;
}
function Info({ icon: I, title, body, wide }: { icon: React.ComponentType<{ className?: string }>; title: string; body: string; wide?: boolean }) {
  return <Card className={`p-5 ${wide ? "sm:col-span-2" : ""}`}><h3 className="flex items-center gap-2 font-semibold"><I className="size-4 text-secondary" aria-hidden /> {title}</h3><p className="t-small mt-1.5 text-muted">{body}</p></Card>;
}

function JoinPanel({ missionId, orgId, full, deadlinePassed, open }: { missionId: string; orgId: string; full: boolean; deadlinePassed: boolean; open: boolean }) {
  const me = useMe();
  const mine = useApi(() => (me.data?.role === "volunteer" ? api.myParticipations() : Promise.resolve([])), [me.data?.id]);
  const toast = useToast();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const joined = mine.data?.find((p) => p.mission.id === missionId);

  if (me.loading) return <Button disabled className="w-full">Loading…</Button>;
  if (!me.data) return <ButtonLink href={`/login?next=/missions/${missionId}`} className="w-full" size="lg">Log in to join</ButtonLink>;
  if (me.data.role !== "volunteer") return <p className="t-small rounded-md bg-surface-2 p-3 text-muted">{me.data.organizationId === orgId ? "This is your organization's mission." : "Only volunteer accounts can join missions."}</p>;
  if (joined) return (
    <div className="space-y-2">
      <p className="flex items-center gap-2 text-sm font-semibold text-primary"><CheckCircle2 className="size-5" aria-hidden /> You&apos;ve joined this mission</p>
      <ButtonLink href={`/app/missions/${missionId}`} className="w-full" size="lg">Open my mission</ButtonLink>
    </div>
  );
  const blocked = !open ? "This mission isn't open for sign-ups." : deadlinePassed ? "Sign-ups have closed." : full ? "This mission is full." : null;
  if (blocked) return <Button disabled className="w-full" size="lg">{blocked}</Button>;

  const join = async () => {
    setBusy(true);
    try {
      await api.joinMission(missionId);
      toast.success("You're in! The mission is now on your dashboard.");
      router.push(`/app/missions/${missionId}`);
    } catch (e) {
      toast.error((e as Error).message);
      setBusy(false);
    }
  };
  return (
    <div className="space-y-3">
      {!me.data.emailVerified && (
        <p className="flex gap-2 rounded-md bg-warning-soft p-3 t-small text-on-warning-soft"><AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden /> Verify your email to join. <Link href="/app" className="font-semibold underline">Go to dashboard</Link></p>
      )}
      <Button className="w-full" size="lg" loading={busy} onClick={join}>Join this mission</Button>
    </div>
  );
}
