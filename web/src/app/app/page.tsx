"use client";
import { ArrowRight, Award, Clock, Flame, Leaf, Lightbulb, PartyPopper, Star, TrendingUp, Trophy, Users, Zap } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { AchievementMedal } from "@/components/achievements";
import { MissionCard } from "@/components/mission-card";
import { useMe } from "@/components/shells";
import { Avatar, Badge, Button, ButtonLink, Card, EmptyState, ErrorState, LoadingBlock, PageHeader, ProgressBar, Stat, cn } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import type { Advice } from "@/lib/domain/advice";
import { levelProgress, levelTitle } from "@/lib/domain/rewards";
import { CATEGORIES } from "@/lib/domain/types";
import { CATEGORY_LABEL, VERIFICATION_LABEL, VERIFICATION_TONE, fmtDate } from "@/lib/format";
import { api } from "@/lib/store/api";
import { useApi } from "@/lib/store/hooks";

const ADVICE_ICON: Record<Advice["tone"], typeof Lightbulb> = { action: Zap, tip: Lightbulb, social: Users, celebrate: PartyPopper };
const ADVICE_STYLE: Record<Advice["tone"], string> = {
  action: "bg-warning-soft text-on-warning-soft", tip: "bg-secondary-soft text-on-secondary-soft",
  social: "bg-primary-soft text-on-primary-soft", celebrate: "bg-accent-soft text-on-accent-soft",
};

export default function VolunteerDashboard() {
  const me = useMe();
  const mine = useApi(() => api.myParticipations());
  const insights = useApi(() => api.myInsights());
  const recs = useApi(async () => {
    const [all, joined] = await Promise.all([api.listMissions({ scope: "public" }), api.myParticipations()]);
    const taken = new Set(joined.map((j) => j.mission.id));
    return all.filter((m) => !taken.has(m.id) && m.capacity > m.participantsCount);
  });
  if (me.error) return <ErrorState error={me.error} onRetry={me.reload} />;
  const u = me.data;
  if (!u) return <LoadingBlock />;
  const lp = levelProgress(u.xp);
  const interests = new Set(u.interests);
  const nearIds = new Set((insights.data?.nearby ?? []).map((m) => m.id));
  // Missions in your area first, then the causes you picked.
  const recommended = [...(recs.data ?? [])]
    .sort((a, b) => Number(nearIds.has(b.id)) - Number(nearIds.has(a.id)) || Number(interests.has(b.category)) - Number(interests.has(a.category)))
    .slice(0, 3);
  const active = (mine.data ?? []).filter((p) => p.submission?.verificationStatus !== "approved" && p.submission?.verificationStatus !== "rejected");
  const ins = insights.data;

  return (
    <div className="space-y-8">
      {!u.emailVerified && <VerifyBanner />}
      <PageHeader title={`Hi, ${u.fullName.split(" ")[0]}`} subtitle="Here is your impact so far." />

      <Card className="p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="t-small text-muted">Level {lp.level}</p>
            <p className="t-h2">{levelTitle(lp.level)}</p>
          </div>
          <Badge tone="reward"><Zap className="size-3" aria-hidden /> {u.xp.toLocaleString()} XP</Badge>
        </div>
        <div className="mt-4"><ProgressBar value={lp.fraction} label={`Progress to level ${lp.level + 1}`} /></div>
        <p className="t-small mt-2 text-muted">{(lp.next - u.xp).toLocaleString()} XP to level {lp.level + 1}</p>
      </Card>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Reward points" value={u.points.toLocaleString()} tone="reward" />
        <Stat label="Volunteer hours" value={u.totalVolunteerHours} tone="info" />
        <Stat label="Verified impact" value={u.totalImpact.toLocaleString()} hint="actions counted" tone="success" />
        <Stat label="Day streak" value={<span className="inline-flex items-center gap-1.5">{u.streak}<Flame className="size-6 text-accent" aria-hidden /></span>} />
      </div>
      {Object.keys(u.impact).length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label="Impact breakdown">
          {Object.entries(u.impact).map(([k, n]) => <li key={k}><Badge tone="success"><Leaf className="size-3" aria-hidden /> {n} {k}</Badge></li>)}
        </ul>
      )}

      {/* ── Advice ── */}
      <section aria-labelledby="adv-h">
        <h2 id="adv-h" className="t-h2 mb-3 flex items-center gap-2"><Lightbulb className="size-5 text-accent" aria-hidden /> Your next steps</h2>
        {!ins ? <LoadingBlock rows={1} /> : ins.advice.length === 0 ? (
          <Card className="p-5 t-small text-muted">You&apos;re on top of everything. Pick a new mission whenever you&apos;re ready.</Card>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {ins.advice.map((a) => {
              const Icon = ADVICE_ICON[a.tone];
              return (
                <li key={a.id}>
                  <Link href={a.href} className="group flex h-full items-start gap-3 rounded-lg border border-border bg-surface p-4 shadow-low transition-shadow duration-200 hover:shadow-med">
                    <span aria-hidden className={cn("inline-flex size-10 shrink-0 items-center justify-center rounded-full", ADVICE_STYLE[a.tone])}><Icon className="size-5" /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold">{a.title}</span>
                      <span className="mt-0.5 block t-small text-muted">{a.body}</span>
                      <span className="mt-2 inline-flex items-center gap-1 t-small font-semibold text-primary">{a.cta} <ArrowRight className="size-4 transition-transform duration-150 group-hover:translate-x-0.5" aria-hidden /></span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* ── Analytics ── */}
      <section aria-labelledby="ana-h">
        <h2 id="ana-h" className="t-h2 mb-3 flex items-center gap-2"><TrendingUp className="size-5 text-secondary" aria-hidden /> Your analytics</h2>
        {!ins ? <LoadingBlock rows={2} /> : (
          <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
            <Card className="p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="font-semibold">XP earned per week</h3>
                <p className="t-small text-muted">Last 8 weeks · {ins.weekly.reduce((a, w) => a + w.xp, 0).toLocaleString()} XP</p>
              </div>
              <WeeklyChart weeks={ins.weekly} />
            </Card>
            <Card className="p-5">
              <h3 className="font-semibold">Missions by cause</h3>
              {ins.totals.approved === 0 ? <p className="mt-3 t-small text-muted">Your approved missions will be broken down by cause here.</p> : (
                <ul className="mt-3 space-y-2.5">
                  {CATEGORIES.filter((c) => ins.byCategory[c]).sort((a, b) => (ins.byCategory[b] ?? 0) - (ins.byCategory[a] ?? 0)).map((c) => (
                    <li key={c}>
                      <div className="mb-1 flex justify-between t-small"><span>{CATEGORY_LABEL[c]}</span><span className="tabular-nums text-muted">{ins.byCategory[c]}</span></div>
                      <ProgressBar value={(ins.byCategory[c] ?? 0) / ins.totals.approved} label={`${CATEGORY_LABEL[c]} share of missions`} tone="success" />
                    </li>
                  ))}
                </ul>
              )}
            </Card>
            <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:col-span-2">
              {[
                ["Missions approved", ins.totals.approved],
                ["Awaiting review", ins.totals.pending],
                ["Approval rate", ins.totals.approvalRate === null ? "—" : `${ins.totals.approvalRate}%`],
                ["Cheers received", ins.totals.cheersReceived],
              ].map(([label, value]) => (
                <Card key={label} className="p-4">
                  <dt className="t-small text-muted">{label}</dt>
                  <dd className="mt-0.5 text-2xl font-bold tabular-nums tracking-tight">{value}</dd>
                </Card>
              ))}
            </dl>
          </div>
        )}
      </section>

      {/* ── Friends + achievements ── */}
      <div className="grid gap-6 lg:grid-cols-2">
        <section aria-labelledby="fr-h">
          <div className="mb-3 flex items-center justify-between"><h2 id="fr-h" className="t-h2 flex items-center gap-2"><Trophy className="size-5 text-accent" aria-hidden /> Friends</h2><Link href="/app/friends" className="t-small font-semibold text-primary underline underline-offset-4">Open friends</Link></div>
          {!ins ? <LoadingBlock rows={1} /> : ins.friends.count === 0 ? (
            <EmptyState title="Volunteer with friends" body="Add friends to get a private leaderboard and see their approved work." icon={<Users className="size-8" />} action={<ButtonLink href="/app/friends">Find friends</ButtonLink>} />
          ) : (
            <Card className="p-2">
              <ol>
                {ins.friends.top.map((p, i) => (
                  <li key={p.id} className={cn("flex items-center gap-3 rounded-md px-3 py-2.5", p.isMe && "bg-primary-soft text-on-primary-soft")}>
                    <span className="w-5 text-center text-sm font-bold tabular-nums">{i + 1}</span>
                    <Avatar name={p.fullName} src={p.avatar} size={32} />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{p.isMe ? "You" : p.fullName}</span>
                    <span className="t-small tabular-nums">{p.xp.toLocaleString()} XP</span>
                  </li>
                ))}
              </ol>
            </Card>
          )}
        </section>

        <section aria-labelledby="ach-h">
          <div className="mb-3 flex items-center justify-between"><h2 id="ach-h" className="t-h2 flex items-center gap-2"><Award className="size-5 text-accent" aria-hidden /> Achievements</h2><Link href="/app/profile?tab=achievements" className="t-small font-semibold text-primary underline underline-offset-4">View all</Link></div>
          {!ins ? <LoadingBlock rows={1} /> : (
            <Card className="p-4">
              <p className="t-small text-muted">{ins.totals.unlocked} of {ins.achievements.length} unlocked</p>
              <ul className="mt-3 space-y-3">
                {[...ins.achievements].sort((a, b) => Number(a.unlocked) - Number(b.unlocked) || b.fraction - a.fraction).slice(0, 3).map((a) => (
                  <li key={a.id} className="flex items-center gap-3">
                    <AchievementMedal a={a} size={40} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{a.title}</p>
                      {a.unlocked ? <p className="t-small text-primary">Unlocked</p> : (
                        <div className="mt-1 flex items-center gap-2"><div className="flex-1"><ProgressBar value={a.fraction} label={`${a.title} progress`} tone="success" /></div><span className="t-caption tabular-nums text-muted">{a.current}/{a.goal}</span></div>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </section>
      </div>

      <section aria-labelledby="act-h">
        <div className="mb-3 flex items-center justify-between"><h2 id="act-h" className="t-h2">Your active missions</h2><Link href="/app/missions" className="t-small font-semibold text-primary underline underline-offset-4">View all</Link></div>
        {!mine.data ? <LoadingBlock rows={2} /> : active.length === 0 ? (
          <EmptyState title="No active missions" body="Join a mission and it will show up here, along with what to do next." icon={<Clock className="size-8" />} action={<ButtonLink href="/missions">Find a mission</ButtonLink>} />
        ) : (
          <ul className="space-y-3">
            {active.slice(0, 4).map(({ mission, submission, organizationName }) => (
              <li key={mission.id}>
                <Link href={`/app/missions/${mission.id}`} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface p-4 hover:shadow-med transition-shadow duration-200">
                  <div><p className="font-semibold">{mission.title}</p><p className="t-small text-muted">{organizationName} · {fmtDate(mission.date)}</p></div>
                  {submission ? <Badge tone={VERIFICATION_TONE[submission.verificationStatus]}>{VERIFICATION_LABEL[submission.verificationStatus]}</Badge> : <Badge tone="info">{Date.parse(mission.date) > Date.now() ? "Upcoming" : "Add evidence"}</Badge>}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="rec-h">
        <h2 id="rec-h" className="t-h2 mb-3 flex items-center gap-2"><Star className="size-5 text-accent" aria-hidden /> Recommended for you</h2>
        <p className="t-small mb-4 text-muted">Missions in your area come first, then the causes you picked.</p>
        {!recs.data ? <LoadingBlock rows={1} /> : recommended.length === 0 ? <p className="t-small text-muted">You&apos;ve joined everything that&apos;s open right now.</p> : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{recommended.map((m, i) => <MissionCard key={m.id} mission={m} organizationName={m.organizationName} index={i} />)}</div>
        )}
      </section>

      <p className="flex items-center gap-2 t-small text-muted"><Award className="size-4" aria-hidden /> Only approved submissions earn XP, points and certificates.</p>
    </div>
  );
}

/** Eight weekly bars with the value on top of each; a screen-reader list carries the same numbers. */
function WeeklyChart({ weeks }: { weeks: { start: string; xp: number; missions: number }[] }) {
  const max = Math.max(...weeks.map((w) => w.xp), 1);
  const empty = weeks.every((w) => w.xp === 0);
  const label = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });
  return (
    <div className="mt-4">
      <div aria-hidden className="relative flex h-40 items-end gap-2 border-b border-border">
        {empty && <p className="absolute inset-0 flex items-center justify-center px-6 text-center t-small text-muted">Your weekly XP will chart here after your first approved mission.</p>}
        {weeks.map((w, i) => (
          <div key={w.start} className="flex h-full flex-1 flex-col items-center justify-end gap-1" title={`Week of ${label(w.start)}: ${w.xp} XP, ${w.missions} mission${w.missions === 1 ? "" : "s"}`}>
            {w.xp > 0 && <span className="t-caption font-semibold tabular-nums">{w.xp}</span>}
            <div className={cn("w-full max-w-10 rounded-t-sm", i === weeks.length - 1 ? "bg-primary" : "bg-primary/55")} style={{ height: `${w.xp ? Math.max((w.xp / max) * 78, 3) : 0}%` }} />
          </div>
        ))}
      </div>
      <div aria-hidden className="mt-1.5 flex gap-2">
        {weeks.map((w, i) => <span key={w.start} className="flex-1 text-center t-caption text-muted">{i % 2 === 1 || i === weeks.length - 1 ? (i === weeks.length - 1 ? "This wk" : label(w.start)) : ""}</span>)}
      </div>
      <ul className="sr-only">{weeks.map((w) => <li key={w.start}>Week of {label(w.start)}: {w.xp} XP from {w.missions} missions</li>)}</ul>
    </div>
  );
}

function VerifyBanner() {
  const toast = useToast();
  const [link, setLink] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  if (api.mode === "firebase") {
    return (
      <div role="status" className="rounded-lg border border-border bg-warning-soft p-4 text-on-warning-soft">
        <p className="font-semibold">Verify your email to join missions</p>
        <p className="t-small mt-0.5">We sent a verification link to your inbox. Open it, then come back and press the button.</p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Button size="sm" loading={busy} onClick={async () => {
            setBusy(true);
            try { if (await api.refreshEmailVerified()) toast.success("Email verified. You can join missions now."); else toast.info("Not verified yet. Open the link in the email first."); } catch (e) { toast.error((e as Error).message); }
            setBusy(false);
          }}>I&apos;ve verified my email</Button>
          <Button size="sm" variant="secondary" disabled={sent} onClick={async () => {
            try { await api.resendVerification(); setSent(true); toast.success("Verification email sent."); } catch (e) { toast.error((e as Error).message); }
          }}>{sent ? "Email sent" : "Send the email again"}</Button>
        </div>
      </div>
    );
  }
  return (
    <div role="status" className="rounded-lg border border-border bg-warning-soft p-4 text-on-warning-soft">
      <p className="font-semibold">Verify your email to join missions</p>
      <p className="t-small mt-0.5">In local demo mode no email is sent. Generate your verification link here.</p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        {link ? <ButtonLink href={link} size="sm">Verify my email now</ButtonLink> : (
          <Button size="sm" variant="secondary" loading={busy} onClick={async () => {
            setBusy(true);
            try { const r = await api.resendVerification(); setLink(`/verify-email?token=${r.devVerifyToken}`); } catch (e) { toast.error((e as Error).message); }
            setBusy(false);
          }}>Get verification link</Button>
        )}
      </div>
    </div>
  );
}
