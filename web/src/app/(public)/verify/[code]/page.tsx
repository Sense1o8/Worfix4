"use client";
import { BadgeCheck, SearchX } from "lucide-react";
import { useParams } from "next/navigation";
import { ButtonLink, Card, ErrorState, LoadingBlock } from "@/components/ui";
import { fmtDate } from "@/lib/format";
import { api } from "@/lib/store/api";
import { useApi } from "@/lib/store/hooks";

export default function VerifyCode() {
  const { code } = useParams<{ code: string }>();
  const r = useApi(() => api.verifyCertificate(decodeURIComponent(code)), [code]);
  return (
    <div className="mx-auto max-w-xl px-4 py-12 sm:px-6" aria-live="polite">
      {r.error ? <ErrorState error={r.error} onRetry={r.reload} /> : r.loading && !r.data && r.data !== null ? <LoadingBlock rows={2} /> : r.data ? (
        <Card className="p-8 text-center">
          <BadgeCheck className="mx-auto size-14 text-primary" aria-hidden />
          <h1 className="t-h1 mt-3">Valid certificate</h1>
          <p className="t-small mt-1 text-muted">This certificate was issued by WORFIX after a person reviewed the evidence.</p>
          <dl className="mt-6 space-y-3 text-left">
            {[
              ["Awarded to", r.data.holderName], ["Mission", r.data.missionTitle], ["Organization", r.data.organizationName],
              ["Issued", fmtDate(r.data.issuedAt)], ["Volunteer hours", String(r.data.hours)], ["XP earned", String(r.data.xp)], ["Code", r.data.verificationCode],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4 border-t border-border pt-3"><dt className="text-muted">{k}</dt><dd className={`text-right font-semibold ${k === "Code" ? "font-mono" : ""}`}>{v}</dd></div>
            ))}
          </dl>
        </Card>
      ) : (
        <Card className="p-8 text-center">
          <SearchX className="mx-auto size-14 text-error" aria-hidden />
          <h1 className="t-h1 mt-3">No certificate found</h1>
          <p className="t-small mt-2 text-muted">We have no certificate with code <span className="font-mono">{decodeURIComponent(code)}</span>. Check for typos, or ask the holder to share it again.</p>
          <ButtonLink href="/verify" variant="secondary" className="mt-6">Try another code</ButtonLink>
        </Card>
      )}
    </div>
  );
}
