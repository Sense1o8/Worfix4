"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Button, Card, Input } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { homeForRole } from "@/lib/domain/permissions";
import { api, ValidationError } from "@/lib/store/api";
import { DEMO_ACCOUNTS } from "@/lib/store/db";

function LoginForm() {
  const router = useRouter();
  const next = useSearchParams().get("next");
  const toast = useToast();
  const [v, setV] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    try {
      const user = await api.login(v);
      toast.success(`Welcome back, ${user.fullName.split(" ")[0]}.`);
      const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : null;
      router.replace(safeNext ?? homeForRole(user.role));
    } catch (err) {
      if (err instanceof ValidationError) setErrors(err.fields);
      else setErrors({ form: (err as Error).message });
      setBusy(false);
    }
  };

  return (
    <>
      <h1 className="t-h1">Log in</h1>
      <p className="t-sub mt-1">Continue your impact record.</p>
      <Card className="mt-6 p-6">
        <form onSubmit={submit} noValidate className="space-y-4">
          {errors.form && <p role="alert" className="rounded-md bg-error-soft p-3 t-small font-medium text-on-error-soft">{errors.form}</p>}
          <Input label="Email" type="email" autoComplete="email" value={v.email} error={errors.email} onChange={(e) => setV({ ...v, email: e.target.value })} />
          <Input label="Password" type="password" autoComplete="current-password" value={v.password} error={errors.password} onChange={(e) => setV({ ...v, password: e.target.value })} />
          <Button type="submit" size="lg" className="w-full" loading={busy}>Log in</Button>
          <p className="text-center t-small"><Link href="/forgot-password" className="font-medium underline underline-offset-4">Forgot your password?</Link></p>
        </form>
      </Card>
      <p className="mt-6 text-center t-small text-muted">New here? <Link href="/register" className="font-semibold text-primary underline underline-offset-4">Create an account</Link></p>

      {api.mode === "local" && <section aria-labelledby="demo-h" className="mt-8 rounded-lg border border-dashed border-border-strong p-4">
        <h2 id="demo-h" className="text-sm font-semibold">Demo accounts (local demo mode only)</h2>
        <ul className="mt-2 space-y-1">
          {DEMO_ACCOUNTS.map((a) => (
            <li key={a.email}>
              <button type="button" onClick={() => setV({ email: a.email, password: a.password })} className="min-h-11 w-full rounded-md px-2 text-left t-small hover:bg-surface-2">
                <span className="font-semibold">{a.label}</span> <span className="text-muted">· {a.email}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>}
    </>
  );
}

export default function LoginPage() {
  return <Suspense><LoginForm /></Suspense>;
}
