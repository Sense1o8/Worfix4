"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Badge, Button, Input, Select, Textarea } from "./ui";
import { useToast } from "./ui/toast";
import { computeMissionReward } from "@/lib/domain/rewards";
import { CATEGORIES, DIFFICULTIES, type Mission } from "@/lib/domain/types";
import { CATEGORY_LABEL, DIFFICULTY_LABEL, toLocalInput } from "@/lib/format";
import { api, ValidationError } from "@/lib/store/api";

const num = (s: string) => (s.trim() === "" ? null : Number(s));

export function MissionForm({ mission }: { mission?: Mission }) {
  const router = useRouter();
  const toast = useToast();
  const m = mission;
  const [v, setV] = useState({
    title: m?.title ?? "", description: m?.description ?? "", category: m?.category ?? "environment", difficulty: m?.difficulty ?? "easy",
    location: m?.location ?? "", lat: m?.coordinates ? String(m.coordinates.lat) : "", lng: m?.coordinates ? String(m.coordinates.lng) : "",
    date: m ? toLocalInput(m.date) : "", deadline: m ? toLocalInput(m.deadline) : "", duration: String(m?.duration ?? 120), capacity: String(m?.capacity ?? 20),
    requirements: m?.requirements ?? "", safety: m?.safety ?? "", equipment: m?.equipment ?? "",
    impactLabel: m?.impactMetrics[0]?.label ?? "", impactAmount: String(m?.impactMetrics[0]?.amountPerVolunteer ?? 0),
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setV({ ...v, [k]: e.target.value });
  const reward = computeMissionReward(v.difficulty as Mission["difficulty"], Number(v.duration) || 0);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    try {
      const { id } = await api.saveMission({
        title: v.title, description: v.description, category: v.category as Mission["category"], difficulty: v.difficulty as Mission["difficulty"],
        location: v.location, lat: num(v.lat), lng: num(v.lng), date: v.date, deadline: v.deadline, duration: Number(v.duration), capacity: Number(v.capacity),
        requirements: v.requirements, safety: v.safety, equipment: v.equipment, impactLabel: v.impactLabel, impactAmount: Number(v.impactAmount) || 0,
      }, m?.id);
      toast.success(m ? "Mission updated." : "Draft saved. Publish it when you're ready.");
      router.push(`/org/missions/${id}`);
    } catch (err) {
      if (err instanceof ValidationError) { setErrors(err.fields); toast.error("Check the highlighted fields."); }
      else toast.error((err as Error).message);
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      <Input label="Title" required value={v.title} error={errors.title} onChange={set("title")} />
      <Textarea label="Description" required rows={5} value={v.description} error={errors.description} onChange={set("description")} hint="What will volunteers do and why does it matter? (30+ characters)" />
      <div className="grid gap-4 sm:grid-cols-2">
        <Select label="Cause" value={v.category} onChange={set("category")}>{CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}</Select>
        <Select label="Difficulty" value={v.difficulty} onChange={set("difficulty")}>{DIFFICULTIES.map((d) => <option key={d} value={d}>{DIFFICULTY_LABEL[d]}</option>)}</Select>
        <Input label="Starts" type="datetime-local" required value={v.date} error={errors.date} onChange={set("date")} />
        <Input label="Sign-up deadline" type="datetime-local" required value={v.deadline} error={errors.deadline} onChange={set("deadline")} />
        <Input label="Duration (minutes)" type="number" inputMode="numeric" min={15} max={720} required value={v.duration} error={errors.duration} onChange={set("duration")} />
        <Input label="Capacity (volunteers)" type="number" inputMode="numeric" min={1} required value={v.capacity} error={errors.capacity} onChange={set("capacity")} />
      </div>
      <p role="status" className="flex flex-wrap items-center gap-2 rounded-md bg-accent-soft p-3 t-small text-on-accent-soft">
        <Badge tone="reward">Reward</Badge> Calculated automatically from difficulty and duration: <strong>{reward.rewardXP} XP</strong> and <strong>{reward.rewardPoints} points</strong>. Organizers can&apos;t set rewards.
      </p>
      <Input label="Location" required value={v.location} error={errors.location} onChange={set("location")} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Latitude (optional)" inputMode="decimal" value={v.lat} error={errors.lat} onChange={set("lat")} hint="Enables the GPS distance check on submissions." />
        <Input label="Longitude (optional)" inputMode="decimal" value={v.lng} error={errors.lng} onChange={set("lng")} />
      </div>
      <Textarea label="Safety instructions" required rows={3} value={v.safety} error={errors.safety} onChange={set("safety")} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Textarea label="Requirements" rows={3} value={v.requirements} error={errors.requirements} onChange={set("requirements")} />
        <Textarea label="Equipment" rows={3} value={v.equipment} error={errors.equipment} onChange={set("equipment")} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Impact measure (optional)" value={v.impactLabel} error={errors.impactLabel} onChange={set("impactLabel")} hint="e.g. trees planted" />
        <Input label="Amount per volunteer" type="number" inputMode="decimal" min={0} value={v.impactAmount} error={errors.impactAmount} onChange={set("impactAmount")} />
      </div>
      <div className="flex gap-3">
        <Button type="submit" size="lg" loading={busy}>{m ? "Save changes" : "Save draft"}</Button>
        <Button variant="secondary" size="lg" onClick={() => router.back()}>Cancel</Button>
      </div>
    </form>
  );
}
