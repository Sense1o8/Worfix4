"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Input, PageHeader } from "@/components/ui";
import { CODE_PATTERN, normaliseCode } from "@/lib/domain/certificates";

export default function VerifyIndex() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [err, setErr] = useState("");
  return (
    <div className="mx-auto max-w-xl px-4 py-12 sm:px-6">
      <PageHeader title="Verify a certificate" subtitle="Enter the code printed on a WORFIX certificate, or scan its QR code." />
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          const c = normaliseCode(code);
          if (!CODE_PATTERN.test(c)) return setErr("Codes look like WFX-ABCD-EFGH-JKMN.");
          router.push(`/verify/${c}`);
        }}
        className="space-y-4"
      >
        <Input label="Verification code" value={code} onChange={(e) => { setCode(e.target.value); setErr(""); }} error={err} placeholder="WFX-XXXX-XXXX-XXXX" autoComplete="off" spellCheck={false} className="font-mono uppercase" />
        <Button type="submit" size="lg" className="w-full">Verify certificate</Button>
      </form>
    </div>
  );
}
