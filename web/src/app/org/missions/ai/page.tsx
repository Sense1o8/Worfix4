"use client";
import { Check, Clock, LocateFixed, MapPin, Sparkles, Users } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Badge, Button, ButtonLink, Card, ChipGroup, Input, PageHeader, Select, Skeleton, Textarea } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import type { AiMission, AiPlan, AiRequest } from "@/lib/ai/missions";
import { computeMissionReward } from "@/lib/domain/rewards";
import { CATEGORIES, type Category } from "@/lib/domain/types";
import { CATEGORY_LABEL, DIFFICULTY_LABEL, fmtDuration, toLocalInput } from "@/lib/format";
import { detectLocation } from "@/lib/geo";
import { api, ValidationError } from "@/lib/store/api";
import { useApi } from "@/lib/store/hooks";

/** Default schedule for a saved draft: two weeks from now at 09:00, sign-ups close two days earlier. */
function defaultDates() {
  const start = new Date(Date.now() + 14 * 86_400_000);
  start.setHours(9, 0, 0, 0);
  const deadline = new Date(start.getTime() - 2 * 86_400_000);
  return { date: toLocalInput(start.toISOString()), deadline: toLocalInput(deadline.toISOString()) };
}

export default function AiMissionAgent() {
  const toast = useToast();
  const org = useApi(() => api.myOrganization().catch(() => null));
  const [area, setArea] = useState("");
  const [areaTouched, setAreaTouched] = useState(false);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [causes, setCauses] = useState<Category[]>([]);
  const [notes, setNotes] = useState("");
  const [count, setCount] = useState("3");
  const [locating, setLocating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [plan, setPlan] = useState<AiPlan | null>(null);
  const [saved, setSaved] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState<number | null>(null);

  // Start from the organization's own city until the organizer types something else.
  const orgArea = org.data ? [org.data.city, org.data.country].filter(Boolean).join(", ") : "";
  const areaValue = areaTouched ? area : area || orgArea;

  const locate = async () => {
    setLocating(true);
    try {
      const loc = await detectLocation(true);
      setArea([loc.city, loc.province, loc.country].filter(Boolean).join(", "));
      setAreaTouched(true);
      setCoords(loc.lat !== null && loc.lng !== null ? { lat: loc.lat, lng: loc.lng } : null);
      toast.success("Location found.");
    } catch (e) { toast.error((e as Error).message); }
    setLocating(false);
  };

  const generate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (areaValue.trim().length < 3) return setError("Tell the agent which area to plan for.");
    setBusy(true);
    setError("");
    setPlan(null);
    setSaved({});
    try {
      const payload: AiRequest = { area: areaValue, lat: coords?.lat ?? null, lng: coords?.lng ?? null, causes, notes, organization: org.data?.name ?? "", count: Number(count) };
      const res = await fetch("/api/ai/missions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = (await res.json().catch(() => null)) as (AiPlan & { error?: string }) | null;
      if (!res.ok || !data || data.error) throw new Error(data?.error ?? (res.status === 504 || res.status === 502 ? "The agent took too long to answer. Try again, or ask for fewer missions." : "The agent couldn't be reached. Try again."));
      setPlan(data);
    } catch (err) { setError((err as Error).message); }
    setBusy(false);
  };

  const save = async (m: AiMission, i: number) => {
    setSaving(i);
    try {
      const { id } = await api.saveMission({
        title: m.title, description: m.description, category: m.category, difficulty: m.difficulty, location: m.location,
        lat: null, lng: null, ...defaultDates(), duration: m.durationMinutes, capacity: m.capacity,
        requirements: m.requirements, safety: m.safety, equipment: m.equipment, impactLabel: m.impactLabel, impactAmount: m.impactLabel ? Math.max(m.impactAmount, 1) : 0,
      });
      setSaved((s) => ({ ...s, [i]: id }));
      toast.success("Saved as a draft. Check the date, then publish.");
    } catch (err) {
      toast.error(err instanceof ValidationError ? `Couldn't save: ${err.message}` : (err as Error).message);
    }
    setSaving(null);
  };

  return (
    <div className="max-w-3xl">
      <PageHeader title="AI mission agent" subtitle="Describe an area and the agent drafts missions that fit it. You review, edit and publish." />

      <Card className="p-6">
        <form onSubmit={generate} noValidate className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
            <Input label="Area" required placeholder="e.g. Chilonzor district, Tashkent, Uzbekistan" value={areaValue} error={error && areaValue.trim().length < 3 ? error : undefined}
              onChange={(e) => { setArea(e.target.value); setAreaTouched(true); setCoords(null); }} hint="A city, district or neighbourhood. The more specific, the more local the missions." />
            <Button variant="secondary" loading={locating} onClick={locate} className="sm:mb-[1.625rem]"><LocateFixed className="size-4" aria-hidden /> Use my location</Button>
          </div>
          <ChipGroup legend="Causes to focus on (optional)" options={CATEGORIES} value={causes} onChange={setCauses} labels={CATEGORY_LABEL} />
          <div className="grid gap-4 sm:grid-cols-[1fr_10rem]">
            <Textarea label="Anything the agent should know? (optional)" rows={2} maxLength={400} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. we have 20 pairs of gloves, weekends only, good for students" />
            <Select label="How many ideas" value={count} onChange={(e) => setCount(e.target.value)}>{[3, 4, 5, 6].map((n) => <option key={n} value={n}>{n} missions</option>)}</Select>
          </div>
          <Button type="submit" size="lg" loading={busy}><Sparkles className="size-4" aria-hidden /> {plan ? "Generate again" : "Generate missions"}</Button>
        </form>
      </Card>

      <div className="mt-8 space-y-5" aria-live="polite">
        {error && areaValue.trim().length >= 3 && <p role="alert" className="rounded-lg bg-error-soft p-4 t-small font-medium text-on-error-soft">{error}</p>}
        {busy && (
          <div role="status" aria-label="The agent is planning missions" className="space-y-4">
            <p className="t-small text-muted">Studying {areaValue} and drafting missions… this takes about 10–20 seconds.</p>
            {Array.from({ length: Number(count) }, (_, i) => <Skeleton key={i} className="h-44 w-full" />)}
          </div>
        )}
        {plan && (
          <>
            {plan.areaSummary && (
              <Card className="border-secondary/30 bg-secondary-soft p-5 text-on-secondary-soft">
                <p className="flex items-center gap-2 text-sm font-semibold"><MapPin className="size-4" aria-hidden /> What this area needs</p>
                <p className="mt-1.5 t-small">{plan.areaSummary}</p>
              </Card>
            )}
            <ul className="space-y-4">
              {plan.missions.map((m, i) => {
                const reward = computeMissionReward(m.difficulty, m.durationMinutes);
                return (
                  <li key={i}>
                    <Card className="p-5">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone="info">{CATEGORY_LABEL[m.category]}</Badge>
                        <Badge>{DIFFICULTY_LABEL[m.difficulty]}</Badge>
                        <Badge tone="reward">+{reward.rewardXP} XP</Badge>
                      </div>
                      <h2 className="t-h3 mt-3 text-balance">{m.title}</h2>
                      <p className="mt-2 t-small">{m.description}</p>
                      {m.whyHere && <p className="mt-2 t-small text-muted"><strong className="font-semibold text-text">Why here:</strong> {m.whyHere}</p>}
                      <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 t-small text-muted">
                        <li className="flex items-center gap-1.5"><MapPin className="size-4" aria-hidden /> {m.location}</li>
                        <li className="flex items-center gap-1.5"><Clock className="size-4" aria-hidden /> {fmtDuration(m.durationMinutes)}</li>
                        <li className="flex items-center gap-1.5"><Users className="size-4" aria-hidden /> {m.capacity} volunteers</li>
                      </ul>
                      <dl className="mt-4 grid gap-3 border-t border-border pt-4 t-small sm:grid-cols-2">
                        <div><dt className="font-semibold">Safety</dt><dd className="text-muted">{m.safety}</dd></div>
                        {m.requirements && <div><dt className="font-semibold">Volunteers bring</dt><dd className="text-muted">{m.requirements}</dd></div>}
                        {m.equipment && <div><dt className="font-semibold">You provide</dt><dd className="text-muted">{m.equipment}</dd></div>}
                        {m.impactLabel && <div><dt className="font-semibold">Impact per volunteer</dt><dd className="text-muted">{Math.max(m.impactAmount, 1)} {m.impactLabel}</dd></div>}
                      </dl>
                      <div className="mt-5 flex flex-wrap items-center gap-3">
                        {saved[i] ? (
                          <>
                            <Badge tone="success"><Check className="size-3" aria-hidden /> Saved as draft</Badge>
                            <ButtonLink href={`/org/missions/${saved[i]}/edit`} variant="secondary" size="sm">Set date and review</ButtonLink>
                          </>
                        ) : (
                          <Button size="sm" loading={saving === i} disabled={saving !== null && saving !== i} onClick={() => save(m, i)}>Save as draft</Button>
                        )}
                      </div>
                    </Card>
                  </li>
                );
              })}
            </ul>
            <p className="t-small text-muted">
              Drafts are written by Gemini ({plan.model}) and can be wrong about local details. Check the place, date and safety notes before you publish.
              Saved drafts start two weeks from today — change that in <Link href="/org/missions" className="font-semibold underline underline-offset-4">Missions</Link>.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
