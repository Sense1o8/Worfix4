"use client";
import { motion } from "framer-motion";
import { ArrowRight, Camera, Compass, Award, ShieldCheck, Sprout } from "lucide-react";
import { MissionCard } from "@/components/mission-card";
import { ButtonLink, Card, LoadingBlock, Badge } from "@/components/ui";
import { DUR, EASE, fadeUp, stagger } from "@/lib/motion";
import { api } from "@/lib/store/api";
import { useApi } from "@/lib/store/hooks";

const STEPS = [
  { icon: Compass, title: "Find a mission", body: "Browse real missions from approved organizations, filtered by cause, place and time." },
  { icon: Sprout, title: "Take real action", body: "Plant, clean, teach, care. WORFIX exists to get you off the screen and into your community." },
  { icon: Camera, title: "Show your evidence", body: "Upload photos from the mission. Location is optional and only used with your consent." },
  { icon: Award, title: "Earn a verified record", body: "Once a person approves your evidence you get XP, points and a certificate anyone can verify." },
];

export default function Landing() {
  const stats = useApi(() => api.publicStats());
  const missions = useApi(() => api.listMissions({ scope: "public" }));
  return (
    <>
      <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 pb-16 pt-12 sm:px-6 md:grid-cols-[1.1fr_0.9fr] md:pb-24 md:pt-20">
        <motion.div initial="initial" animate="animate" className="space-y-6">
          <motion.p {...stagger(0)} className="inline-flex items-center gap-2 rounded-full bg-primary-soft px-3 py-1 text-sm font-semibold text-on-primary-soft">
            <ShieldCheck className="size-4" aria-hidden /> Verified volunteering
          </motion.p>
          <motion.h1 {...stagger(1)} className="t-hero text-balance">Small actions. <span className="text-primary">Big impact.</span></motion.h1>
          <motion.p {...stagger(2)} className="t-sub max-w-xl">
            Real actions create real impact. WORFIX connects you with volunteering that happens in the real world, checks it, and turns it into a growing record of what you have done for your community.
          </motion.p>
          <motion.div {...stagger(3)} className="flex flex-wrap gap-3">
            <ButtonLink href="/missions" size="lg">Explore missions <ArrowRight className="size-4" aria-hidden /></ButtonLink>
            <ButtonLink href="/register" variant="secondary" size="lg">Create your account</ButtonLink>
          </motion.div>
        </motion.div>

        <ExampleRecord />
      </section>

      <section aria-labelledby="stats-h" className="border-y border-border bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
          <h2 id="stats-h" className="sr-only">Platform activity</h2>
          {stats.data ? (
            <>
              <dl className="grid grid-cols-2 gap-6 md:grid-cols-4">
                <Figure label="Verified actions" value={stats.data.verifiedActions} />
                <Figure label="Volunteer hours" value={stats.data.hours} />
                <Figure label="Open missions" value={stats.data.openMissions} />
                <Figure label="Approved organizations" value={stats.data.organizations} />
              </dl>
              {stats.data.includesDemoData && (
                <p className="mt-4 t-caption text-muted">Numbers come from this browser&apos;s local demo data, which includes clearly labelled demonstration missions. They are not real-world totals.</p>
              )}
            </>
          ) : <LoadingBlock rows={1} />}
        </div>
      </section>

      <section aria-labelledby="how-h" className="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-24">
        <h2 id="how-h" className="t-h1 max-w-2xl text-balance">From good intention to verified impact in four steps</h2>
        <ol className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s, i) => (
            <motion.li key={s.title} initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-40px" }} transition={{ duration: DUR.page, ease: EASE, delay: i * 0.05 }}>
              <Card className="h-full p-6">
                <div className="flex items-center justify-between">
                  <span className="inline-flex size-11 items-center justify-center rounded-md bg-primary-soft text-on-primary-soft"><s.icon className="size-5" aria-hidden /></span>
                  <span aria-hidden className="text-4xl font-bold text-border">{i + 1}</span>
                </div>
                <h3 className="t-h3 mt-5">{s.title}</h3>
                <p className="t-small mt-1.5 text-muted">{s.body}</p>
              </Card>
            </motion.li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="feat-h" className="bg-surface-2">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <h2 id="feat-h" className="t-h1">Missions open now</h2>
            <ButtonLink href="/missions" variant="secondary">See all missions</ButtonLink>
          </div>
          {missions.data ? (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {missions.data.slice(0, 3).map((m, i) => <MissionCard key={m.id} mission={m} organizationName={m.organizationName} index={i} />)}
            </div>
          ) : <LoadingBlock />}
        </div>
      </section>

      <section aria-labelledby="trust-h" className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 md:grid-cols-2 md:py-24">
        <div>
          <h2 id="trust-h" className="t-h1 text-balance">Trust is the product</h2>
          <p className="t-sub mt-4">A certificate is only worth something if people believe it. So nothing is rewarded until a person has looked at the evidence.</p>
        </div>
        <ul className="space-y-3">
          <Layer tone="success" tag="Live" title="Automatic checks" body="Timestamp, optional GPS distance and duplicate-photo detection raise flags for reviewers." />
          <Layer tone="success" tag="Live" title="Human review" body="The organization reviews every submission. Admins can investigate flagged ones." />
          <Layer tone="success" tag="Live" title="Verifiable certificates" body="Every certificate has a code and QR that anyone can check on this site." />
          <Layer tone="info" tag="Planned" title="AI-assisted review" body="Image analysis will help reviewers later. It will never approve uncertain evidence on its own." />
        </ul>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
        <div className="rounded-xl bg-primary px-6 py-12 text-center text-on-primary sm:px-12">
          <h2 className="t-h1 text-balance">Run missions as an organization?</h2>
          <p className="mx-auto mt-3 max-w-xl opacity-90">Publish missions, review evidence and see your real impact. Organizations are approved by our team before they can publish.</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <ButtonLink href="/register?type=organization" variant="secondary" size="lg">Register your organization</ButtonLink>
            <ButtonLink href="/organizations" variant="ghost" size="lg" className="text-on-primary hover:bg-white/15">See organizations</ButtonLink>
          </div>
        </div>
      </section>
    </>
  );
}

function Figure({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dd className="text-4xl font-bold tracking-tight tabular-nums">{value.toLocaleString()}</dd>
      <dt className="t-small text-muted">{label}</dt>
    </div>
  );
}

function Layer({ tag, title, body, tone }: { tag: string; title: string; body: string; tone: "success" | "info" }) {
  return (
    <li className="flex gap-4 rounded-lg border border-border bg-surface p-4">
      <Badge tone={tone} className="mt-0.5 h-fit">{tag}</Badge>
      <div><p className="font-semibold">{title}</p><p className="t-small text-muted">{body}</p></div>
    </li>
  );
}

/** Illustrative record, labelled as an example so it is never mistaken for real data. */
function ExampleRecord() {
  return (
    <motion.div {...fadeUp} className="relative">
      <Card className="p-6 shadow-med">
        <div className="mb-4 flex items-center justify-between">
          <Badge tone="warning">Example record</Badge>
          <Badge tone="success">Verified</Badge>
        </div>
        <h3 className="t-h2">Plant saplings along the canal</h3>
        <p className="t-small mt-1 text-muted">Green Samarkand · 3 hours</p>
        <div className="mt-5 grid grid-cols-3 gap-3 text-center">
          {[["+190", "XP"], ["+95", "Points"], ["3", "Trees planted"]].map(([v, l]) => (
            <div key={l} className="rounded-md bg-surface-2 p-3">
              <p className="text-xl font-bold tabular-nums text-accent">{v}</p>
              <p className="t-caption text-muted">{l}</p>
            </div>
          ))}
        </div>
        <div className="mt-5 flex items-center gap-3 rounded-md border border-border p-3">
          <svg viewBox="0 0 24 24" className="size-9 shrink-0 text-primary" fill="none" aria-hidden>
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.6" opacity=".35" />
            <motion.path d="M7.5 12.5l3 3 6-7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
              initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 0.5, duration: 0.5, ease: EASE }} />
          </svg>
          <div>
            <p className="text-sm font-semibold">Certificate WFX-XXXX-XXXX-XXXX</p>
            <p className="t-caption text-muted">Anyone can verify a real code on this site</p>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}
