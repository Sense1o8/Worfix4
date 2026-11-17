"use client";
import { motion } from "framer-motion";
import { Award, Printer } from "lucide-react";
import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { LogoMark } from "@/components/brand";
import { Button, Card, EmptyState, ErrorState, LoadingBlock, PageHeader, ButtonLink } from "@/components/ui";
import { Dialog } from "@/components/ui/dialog";
import type { Certificate } from "@/lib/domain/types";
import { fmtDate } from "@/lib/format";
import { EASE } from "@/lib/motion";
import { api } from "@/lib/store/api";
import { useApi } from "@/lib/store/hooks";

export default function Certificates() {
  const res = useApi(() => api.myCertificates());
  const [open, setOpen] = useState<Certificate | null>(null);
  if (res.error) return <ErrorState error={res.error} onRetry={res.reload} />;
  if (!res.data) return <LoadingBlock />;
  return (
    <div>
      <PageHeader title="Certificates" subtitle="Issued only after a reviewer approves your evidence." />
      {res.data.length === 0 ? (
        <EmptyState title="No certificates yet" body="Complete a mission and get your evidence approved to earn your first certificate." icon={<Award className="size-8" />} action={<ButtonLink href="/missions">Find a mission</ButtonLink>} />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {res.data.map((c) => (
            <li key={c.id}>
              <Card className="flex h-full flex-col p-5">
                <Award className="size-7 text-accent" aria-hidden />
                <h2 className="t-h3 mt-3">{c.missionTitle}</h2>
                <p className="t-small text-muted">{c.organizationName} · {fmtDate(c.issuedAt)}</p>
                <p className="t-small mt-2 font-mono text-muted">{c.verificationCode}</p>
                <Button variant="secondary" className="mt-4 self-start" onClick={() => setOpen(c)}>View certificate</Button>
              </Card>
            </li>
          ))}
        </ul>
      )}
      <Dialog open={!!open} onClose={() => setOpen(null)} title="Your certificate">
        {open && <CertificateView c={open} />}
      </Dialog>
    </div>
  );
}

function CertificateView({ c }: { c: Certificate }) {
  const [qr, setQr] = useState<string>("");
  useEffect(() => { QRCode.toDataURL(c.qrCode, { margin: 1, width: 160 }).then(setQr).catch(() => setQr("")); }, [c.qrCode]);
  return (
    <div>
      <motion.div initial={{ opacity: 0, y: 8, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.3, ease: EASE }}
        className="print-area rounded-lg border-2 border-primary bg-white p-6 text-center text-[#14201a]">
        <div className="flex justify-center"><LogoMark size={40} /></div>
        <p className="mt-3 text-xs font-semibold uppercase tracking-widest text-[#1b6b43]">Certificate of verified volunteering</p>
        <p className="mt-5 text-sm">This certifies that</p>
        <p className="mt-1 text-2xl font-bold">{c.holderName}</p>
        <p className="mt-3 text-sm">completed the mission</p>
        <p className="mt-1 text-lg font-semibold">{c.missionTitle}</p>
        <p className="text-sm">with {c.organizationName} · {c.hours} volunteer hours · {c.xp} XP</p>
        <p className="mt-2 text-xs">Issued {fmtDate(c.issuedAt)}</p>
        <div className="mt-5 flex flex-col items-center gap-1">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {qr && <img src={qr} alt={`QR code that opens ${c.qrCode}`} width={120} height={120} />}
          <p className="font-mono text-sm font-semibold">{c.verificationCode}</p>
          <p className="text-[11px]">Verify at {new URL(c.qrCode).host}/verify</p>
        </div>
      </motion.div>
      <div className="mt-4 flex justify-end">
        <Button onClick={() => window.print()}><Printer className="size-4" aria-hidden /> Print or save as PDF</Button>
      </div>
    </div>
  );
}
