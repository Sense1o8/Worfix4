import type { Metadata } from "next";
import { ButtonLink, Card } from "@/components/ui";

export const metadata: Metadata = { title: "About" };

const VALUES = [
  ["Authenticity", "Every recorded action should represent genuine, verifiable impact."],
  ["Accessibility", "Meaningful volunteering should be open to everyone, whatever their background or experience."],
  ["Integrity", "Data, verification and reporting stay transparent and trustworthy."],
  ["Community", "Collective action creates more impact than isolated efforts."],
];

export default function About() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <p className="text-sm font-semibold text-primary">About WORFIX</p>
      <h1 className="t-hero mt-2 text-balance">Real actions create real impact.</h1>
      <p className="t-sub mt-6 max-w-2xl">
        Planting a tree changes a community. Cleaning a river changes a community. Technology should encourage those actions, not replace them. WORFIX helps people find real volunteering, verifies it, and turns it into a lasting record of contribution.
      </p>

      <section aria-labelledby="who-h" className="mt-14 grid gap-5 sm:grid-cols-3">
        <h2 id="who-h" className="sr-only">Who WORFIX is for</h2>
        {[
          ["Volunteers", "Aged 15 and over. Discover missions, earn verified XP and certificates, and build an impact portfolio for school, scholarships and work."],
          ["Organizations", "NGOs, schools and community groups publish missions, manage volunteers and review evidence with far less admin."],
          ["Communities", "Verified hours and outcomes make local impact visible, so good work gets recognised."],
        ].map(([t, b]) => (
          <Card key={t} className="p-6"><h3 className="t-h3">{t}</h3><p className="t-small mt-2 text-muted">{b}</p></Card>
        ))}
      </section>

      <section aria-labelledby="val-h" className="mt-14">
        <h2 id="val-h" className="t-h2">What we stand for</h2>
        <dl className="mt-5 grid gap-x-8 gap-y-5 sm:grid-cols-2">
          {VALUES.map(([t, b]) => <div key={t}><dt className="font-semibold">{t}</dt><dd className="t-small text-muted">{b}</dd></div>)}
        </dl>
      </section>

      <section aria-labelledby="priv-h" className="mt-14 rounded-lg bg-secondary-soft p-6 text-on-secondary-soft">
        <h2 id="priv-h" className="t-h3">Privacy by default</h2>
        <p className="t-small mt-2">Location is optional and only used to check a submission. Exact volunteer locations are never shown publicly. You can export or delete your data from your profile at any time. Volunteers aged 15–17 are asked to confirm a parent or guardian knows they are joining.</p>
      </section>

      <div className="mt-12 flex flex-wrap gap-3">
        <ButtonLink href="/missions" size="lg">Explore missions</ButtonLink>
        <ButtonLink href="/register" variant="secondary" size="lg">Create an account</ButtonLink>
      </div>
    </div>
  );
}
