"use client";
import { CheckCircle2, XCircle } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { ButtonLink, Card, LoadingBlock } from "@/components/ui";
import { api } from "@/lib/store/api";

function Verify() {
  const token = useSearchParams().get("token") ?? "";
  const [state, setState] = useState<"working" | "ok" | { error: string }>("working");
  useEffect(() => {
    let live = true;
    api.verifyEmail(token).then(() => live && setState("ok")).catch((e: Error) => live && setState({ error: e.message }));
    return () => { live = false; };
  }, [token]);
  return (
    <Card className="mt-6 p-8 text-center" aria-live="polite">
      {state === "working" ? <LoadingBlock rows={1} /> : state === "ok" ? (
        <>
          <CheckCircle2 className="mx-auto size-12 text-primary" aria-hidden />
          <h1 className="t-h2 mt-3">Email verified</h1>
          <p className="t-small mt-1 text-muted">You can now join missions.</p>
          <ButtonLink href="/app" className="mt-6">Go to dashboard</ButtonLink>
        </>
      ) : (
        <>
          <XCircle className="mx-auto size-12 text-error" aria-hidden />
          <h1 className="t-h2 mt-3">Link not valid</h1>
          <p className="t-small mt-1 text-muted">{state.error}</p>
          <ButtonLink href="/login" variant="secondary" className="mt-6">Back to log in</ButtonLink>
        </>
      )}
    </Card>
  );
}
export default function VerifyEmail() { return <Suspense><Verify /></Suspense>; }
