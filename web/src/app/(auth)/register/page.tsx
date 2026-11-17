"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Button, Card, Checkbox, Input } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { homeForRole } from "@/lib/domain/permissions";
import { api, ValidationError } from "@/lib/store/api";

function RegisterForm() {
  const router = useRouter();
  const toast = useToast();
  const initialType = useSearchParams().get("type") === "organization" ? "organization" : "volunteer";
  const [type, setType] = useState<"volunteer" | "organization">(initialType);
  const [v, setV] = useState({ fullName: "", email: "", password: "", birthYear: "", ageConfirmed: false, guardianConsent: false });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const age = v.birthYear ? new Date().getFullYear() - Number(v.birthYear) : null;
  const minor = age !== null && age >= 15 && age < 18;
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setV({ ...v, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    try {
      await api.register({
        fullName: v.fullName, email: v.email, password: v.password, accountType: type,
        birthYear: Number(v.birthYear), ageConfirmed: v.ageConfirmed as true, guardianConsent: v.guardianConsent,
      });
      toast.success(api.mode === "firebase" ? "Account created. We emailed you a verification link." : "Account created. Check the verification step on your dashboard.");
      router.replace(homeForRole(type));
    } catch (err) {
      if (err instanceof ValidationError) setErrors(err.fields);
      else setErrors({ form: (err as Error).message });
      setBusy(false);
    }
  };

  return (
    <>
      <h1 className="t-h1">Join WORFIX</h1>
      <p className="t-sub mt-1">Small actions. Big impact.</p>
      <Card className="mt-6 p-6">
        <form onSubmit={submit} noValidate className="space-y-4">
          <fieldset className="grid grid-cols-2 gap-2">
            <legend className="mb-1.5 text-sm font-medium">I am joining as</legend>
            {(["volunteer", "organization"] as const).map((t) => (
              <label key={t} className={`flex min-h-11 cursor-pointer items-center justify-center rounded-md border px-3 text-sm font-semibold capitalize transition-colors duration-150 has-[:focus-visible]:outline has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--ring)] ${type === t ? "border-primary bg-primary-soft text-on-primary-soft" : "border-border-strong hover:bg-surface-2"}`}>
                <input type="radio" name="type" value={t} checked={type === t} onChange={() => setType(t)} className="sr-only" />
                {t === "volunteer" ? "A volunteer" : "An organization"}
              </label>
            ))}
          </fieldset>
          {errors.form && <p role="alert" className="rounded-md bg-error-soft p-3 t-small font-medium text-on-error-soft">{errors.form}</p>}
          <Input label="Full name" autoComplete="name" value={v.fullName} error={errors.fullName} onChange={set("fullName")} />
          <Input label="Email" type="email" autoComplete="email" value={v.email} error={errors.email} onChange={set("email")} />
          <Input label="Password" type="password" autoComplete="new-password" hint="At least 8 characters with a letter and a number." value={v.password} error={errors.password} onChange={set("password")} />
          <Input label="Year of birth" inputMode="numeric" placeholder="e.g. 2008" hint="WORFIX is for ages 15 and over. We only use this to apply age rules." value={v.birthYear} error={errors.birthYear} onChange={set("birthYear")} />
          {minor && <Checkbox checked={v.guardianConsent} onChange={set("guardianConsent")} error={errors.guardianConsent} label="A parent or guardian knows I am joining WORFIX and taking part in volunteering." />}
          <Checkbox checked={v.ageConfirmed} onChange={set("ageConfirmed")} error={errors.ageConfirmed} label="I am 15 or older and agree to take part honestly: only real actions, only my own evidence." />
          <Button type="submit" size="lg" className="w-full" loading={busy}>Create account</Button>
        </form>
      </Card>
      <p className="mt-6 text-center t-small text-muted">Already have an account? <Link href="/login" className="font-semibold text-primary underline underline-offset-4">Log in</Link></p>
    </>
  );
}

export default function RegisterPage() {
  return <Suspense><RegisterForm /></Suspense>;
}
