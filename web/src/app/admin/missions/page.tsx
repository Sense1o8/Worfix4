"use client";
import Link from "next/link";
import { useState } from "react";
import { Badge, Button, ErrorState, LoadingBlock, PageHeader, Table, Textarea } from "@/components/ui";
import { Dialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { MISSION_STATUS_LABEL, fmtDate } from "@/lib/format";
import { api, ValidationError } from "@/lib/store/api";
import { useApi } from "@/lib/store/hooks";

export default function AdminMissions() {
  const toast = useToast();
  const res = useApi(() => api.listMissions({ scope: "all" }));
  const [cancel, setCancel] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  if (res.error) return <ErrorState error={res.error} onRetry={res.reload} />;
  if (!res.data) return <LoadingBlock />;

  const act = async (id: string, a: "feature" | "unfeature" | "cancel", n = "") => {
    setBusy(true);
    try { await api.moderateMission(id, a, n); toast.success(a === "cancel" ? "Mission cancelled." : a === "feature" ? "Mission featured." : "Feature removed."); setCancel(null); setNote(""); }
    catch (e) { setErr(e instanceof ValidationError ? (e.fields.note ?? e.message) : (e as Error).message); }
    setBusy(false);
  };

  return (
    <div>
      <PageHeader title="Mission moderation" subtitle="Feature good missions; cancel ones that break the rules." />
      <Table>
        <thead><tr><th scope="col">Mission</th><th scope="col">Organization</th><th scope="col">Status</th><th scope="col">Date</th><th scope="col"><span className="sr-only">Actions</span></th></tr></thead>
        <tbody>
          {res.data.map((m) => (
            <tr key={m.id}>
              <td><Link href={`/missions/${m.id}`} className="font-semibold underline-offset-4 hover:underline">{m.title}</Link>{m.featured && <Badge tone="reward" className="ml-2">Featured</Badge>}</td>
              <td>{m.organizationName}</td>
              <td><Badge tone={m.status === "published" ? "success" : m.status === "cancelled" ? "danger" : "neutral"}>{MISSION_STATUS_LABEL[m.status]}</Badge></td>
              <td>{fmtDate(m.date)}</td>
              <td className="space-x-1 text-right whitespace-nowrap">
                {m.status === "published" && <Button size="sm" variant="ghost" onClick={() => act(m.id, m.featured ? "unfeature" : "feature")}>{m.featured ? "Unfeature" : "Feature"}</Button>}
                {(m.status === "published" || m.status === "draft") && <Button size="sm" variant="ghost" onClick={() => { setCancel(m.id); setErr(""); }}>Cancel</Button>}
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
      <Dialog open={!!cancel} onClose={() => setCancel(null)} title="Cancel this mission?">
        <div className="space-y-4">
          <p className="t-small text-muted">The organization is notified with your reason. Volunteers who joined can no longer submit new evidence for it.</p>
          <Textarea label="Reason" rows={3} value={note} error={err} onChange={(e) => { setNote(e.target.value); setErr(""); }} data-autofocus />
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setCancel(null)}>Keep mission</Button>
            <Button variant="danger" loading={busy} onClick={() => cancel && act(cancel, "cancel", note)}>Cancel mission</Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
