"use client";
import { Camera, LocateFixed } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Avatar, Button, Checkbox, ChipGroup, Input, Select, Textarea } from "./ui";
import { useToast } from "./ui/toast";
import { CATEGORIES, type Category } from "@/lib/domain/types";
import { CATEGORY_LABEL } from "@/lib/format";
import { detectLocation, loadGeo, type GeoCountry } from "@/lib/geo";
import { api, ValidationError, type SelfUser } from "@/lib/store/api";
import { avatarFromFile } from "@/lib/store/images";

const split = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);

export function ProfileForm({ user, onboarding, onSaved }: { user: SelfUser; onboarding?: boolean; onSaved?: () => void }) {
  const toast = useToast();
  const [v, setV] = useState({
    fullName: user.fullName, username: onboarding ? "" : user.username, bio: user.bio, country: user.country, province: user.province ?? "", city: user.city,
    languages: user.languages.join(", "), skills: user.skills.join(", "),
  });
  const [interests, setInterests] = useState<Category[]>(user.interests);
  const [feedVisible, setFeedVisible] = useState(user.feedVisible ?? true);
  const [avatar, setAvatar] = useState<string | null>(user.avatar);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [geo, setGeo] = useState<GeoCountry[] | null>(null);
  const [locating, setLocating] = useState(false);
  const [detected, setDetected] = useState<"" | "approximate" | "precise">("");
  const file = useRef<HTMLInputElement>(null);
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setV((s) => ({ ...s, [k]: e.target.value }));

  // Countries and provinces load on demand. A new profile is pre-filled from the approximate network
  // location (no permission prompt); "Use my location" asks for the precise one.
  const emptyLocation = !user.country;
  useEffect(() => {
    let live = true;
    void loadGeo().then((g) => live && setGeo(g));
    if (emptyLocation) {
      detectLocation(false)
        .then((loc) => {
          if (!live) return;
          setV((s) => (s.country ? s : { ...s, country: loc.country, province: loc.province, city: s.city || loc.city }));
          setDetected("approximate");
        })
        .catch(() => undefined);
    }
    return () => { live = false; };
  }, [emptyLocation]);

  const provinces = geo?.find((g) => g.n === v.country)?.s ?? [];
  // Keep a previously saved value selectable even if it isn't in the list.
  const countryKnown = !v.country || !geo || geo.some((g) => g.n === v.country);
  const provinceKnown = !v.province || provinces.includes(v.province);

  const locate = async () => {
    setLocating(true);
    try {
      const loc = await detectLocation(true);
      setV((s) => ({ ...s, country: loc.country, province: loc.province, city: loc.city || s.city }));
      setDetected("precise");
      toast.success(`Location set to ${[loc.city, loc.province, loc.country].filter(Boolean).join(", ")}.`);
    } catch (e) { toast.error((e as Error).message); }
    setLocating(false);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    try {
      await api.updateProfile(
        { fullName: v.fullName, username: v.username, bio: v.bio, country: v.country, province: v.province, city: v.city, feedVisible, languages: split(v.languages), skills: split(v.skills), interests },
        { avatar, onboarded: onboarding ? true : undefined },
      );
      toast.success(onboarding ? "You're all set. Let's find your first mission." : "Profile saved.");
      onSaved?.();
    } catch (err) {
      if (err instanceof ValidationError) {
        setErrors(err.fields);
        toast.error("Check the highlighted fields.");
      } else toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-6">
      <div className="flex items-center gap-4">
        <Avatar name={v.fullName || "?"} src={avatar} size={72} />
        <div>
          <input ref={file} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" aria-label="Upload profile picture"
            onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; try { setAvatar(await avatarFromFile(f)); } catch (er) { toast.error((er as Error).message); } e.target.value = ""; }} />
          <Button variant="secondary" size="sm" onClick={() => file.current?.click()}><Camera className="size-4" aria-hidden /> {avatar ? "Change photo" : "Add photo"}</Button>
          {avatar && <Button variant="ghost" size="sm" onClick={() => setAvatar(null)} className="ml-1">Remove</Button>}
          <p className="t-caption mt-1.5 text-muted">Optional. Shown to organizers and other volunteers.</p>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Full name" required value={v.fullName} error={errors.fullName} onChange={set("fullName")} autoComplete="name" />
        <Input label="Username" required value={v.username} error={errors.username} onChange={set("username")} hint="Lowercase letters, numbers, underscores." autoComplete="username" />
      </div>

      <fieldset className="space-y-4 rounded-lg border border-border p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <legend className="float-left text-sm font-semibold">Where you volunteer</legend>
          <Button variant="secondary" size="sm" loading={locating} onClick={locate}><LocateFixed className="size-4" aria-hidden /> Use my location</Button>
        </div>
        {detected && (
          <p role="status" className="clear-both rounded-md bg-secondary-soft p-2.5 t-small text-on-secondary-soft">
            {detected === "precise" ? "Filled in from your device location." : "Filled in from your approximate network location."} Check it and change anything that&apos;s wrong.
          </p>
        )}
        <div className="clear-both grid gap-4 sm:grid-cols-2">
          <Select label="Country" required value={v.country} error={errors.country} autoComplete="country-name"
            onChange={(e) => setV((s) => ({ ...s, country: e.target.value, province: "" }))}>
            <option value="">{geo ? "Select a country" : "Loading countries…"}</option>
            {!countryKnown && <option value={v.country}>{v.country}</option>}
            {!geo && v.country && <option value={v.country}>{v.country}</option>}
            {geo?.map((g) => <option key={g.c} value={g.n}>{g.n}</option>)}
          </Select>
          <Select label="Province / region" value={v.province} error={errors.province} disabled={!v.country || (Boolean(geo) && provinces.length === 0 && !v.province)}
            onChange={(e) => setV((s) => ({ ...s, province: e.target.value }))}
            hint={!v.country ? "Choose a country first." : geo && provinces.length === 0 ? "No provinces listed for this country." : undefined}>
            <option value="">{v.country ? "Select a province" : "—"}</option>
            {!provinceKnown && <option value={v.province}>{v.province}</option>}
            {provinces.map((p) => <option key={p} value={p}>{p}</option>)}
          </Select>
        </div>
        <Input label="City / town" required value={v.city} error={errors.city} onChange={set("city")} autoComplete="address-level2" />
      </fieldset>

      <Input label="Languages" required value={v.languages} error={errors.languages} onChange={set("languages")} hint="Separate with commas, e.g. Uzbek, English" />
      <Input label="Skills" value={v.skills} error={errors.skills} onChange={set("skills")} hint="Optional. e.g. first aid, teaching, photography" />
      <ChipGroup legend="Causes you care about" options={CATEGORIES} value={interests} onChange={setInterests} error={errors.interests} labels={CATEGORY_LABEL} />
      <Textarea label="Bio" value={v.bio} error={errors.bio} onChange={set("bio")} hint={`${v.bio.length}/280`} rows={3} />
      <Checkbox checked={feedVisible} onChange={(e) => setFeedVisible(e.target.checked)}
        label={<><span className="font-medium">Show my approved work in the community feed.</span> <span className="text-muted">Other volunteers see the mission, your photos and your note — never your GPS location. Turn this off to keep your work visible only to reviewers.</span></>} />
      <Button type="submit" size="lg" loading={busy} className="w-full sm:w-auto">{onboarding ? "Finish and explore missions" : "Save profile"}</Button>
    </form>
  );
}
