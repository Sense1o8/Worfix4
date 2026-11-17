"use client";
import Link from "next/link";
import { useState } from "react";
import { Button, Card, Input } from "@/components/ui";
import { api } from "@/lib/store/api";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ token: string | null } | null>(null);
  const [err, setErr] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email)) return setErr("Enter a valid email address.");
    setBusy(true);
    const r = await api.requestPasswordReset(email);
    setDone({ token: r.devResetToken });
    setBusy(false);
  };

  return (
    <>
      <h1 className="t-h1">Reset your password</h1>
      <Card className="mt-6 p-6">
        {done ? (
          <div className="space-y-4" role="status">
            <p>If an account exists for <strong>{email}</strong>, a reset link is on its way.</p>
            {api.mode === "firebase" ? (
              <p className="t-small text-muted">Open the link in that email to choose a new password, then come back and log in. Check your spam folder if it doesn&apos;t arrive.</p>
            ) : (
              <p className="rounded-md bg-warning-soft p-3 t-small text-on-warning-soft">
                <strong>Local demo mode:</strong> no email is sent. {done.token ? <Link className="font-semibold underline" href={`/reset-password?token=${done.token}`}>Open your reset link</Link> : "No account matched, so there is no link."}
              </p>
            )}
          </div>
        ) : (
          <form onSubmit={submit} noValidate className="space-y-4">
            <Input label="Email" type="email" autoComplete="email" value={email} error={err} onChange={(e) => { setEmail(e.target.value); setErr(""); }} />
            <Button type="submit" size="lg" className="w-full" loading={busy}>Send reset link</Button>
          </form>
        )}
      </Card>
      <p className="mt-6 text-center t-small"><Link href="/login" className="font-semibold underline underline-offset-4">Back to log in</Link></p>
    </>
  );
}
