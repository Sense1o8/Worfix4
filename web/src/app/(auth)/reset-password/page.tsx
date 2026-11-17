"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Button, Card, Input } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { api, ValidationError } from "@/lib/store/api";

function Form() {
  const token = useSearchParams().get("token") ?? "";
  const router = useRouter();
  const toast = useToast();
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.resetPassword(token, password);
      toast.success("Password updated. Log in with your new password.");
      router.replace("/login");
    } catch (e2) {
      setErr(e2 instanceof ValidationError ? (e2.fields.password ?? e2.message) : (e2 as Error).message);
      setBusy(false);
    }
  };
  return (
    <>
      <h1 className="t-h1">Choose a new password</h1>
      <Card className="mt-6 p-6">
        {!token ? <p>This link is missing its token. <Link href="/forgot-password" className="font-semibold underline">Request a new one</Link>.</p> : (
          <form onSubmit={submit} noValidate className="space-y-4">
            <Input label="New password" type="password" autoComplete="new-password" hint="At least 8 characters with a letter and a number." value={password} error={err} onChange={(e) => { setPassword(e.target.value); setErr(""); }} />
            <Button type="submit" size="lg" className="w-full" loading={busy}>Update password</Button>
          </form>
        )}
      </Card>
    </>
  );
}
export default function ResetPassword() { return <Suspense><Form /></Suspense>; }
