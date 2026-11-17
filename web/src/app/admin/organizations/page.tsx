"use client";
import { useState } from "react";
import { Badge, Button, Card, EmptyState, ErrorState, LoadingBlock, PageHeader, Textarea } from "@/components/ui";
import { Dialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { fmtDate } from "@/lib/format";
import { api, ValidationError } from "@/lib/store/api";
import { useApi } from "@/lib/store/hooks";

export default function AdminOrganizations() {
  const toast = useToast();
  const orgs = useApi(() => api.adminOrganizations());
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  if (orgs.error) return <ErrorState error={orgs.error} onRetry={orgs.reload} />;
  if (!orgs.data) return <LoadingBlock />;

  const decide = async (id: string, d: "approved" | "rejected", n = "") => {
    setBusy(id);
    try { await api.decideOrganization(id, d, n); toast.success(d === "approved" ? "Organization approved." : "Organization rejected."); setRejecting(null); setNote(""); }
    catch (e) { setErr(e instanceof ValidationError ? (e.fields.note ?? e.message) : (e as Error).message); }
    setBusy(null);
  };
  const order = { pending: 0, approved: 1, rejected: 2 } as const;
  const sorted = [...orgs.data].sort((a, b) => order[a.verificationStatus] - order[b.verificationStatus]);

  return (
    <div>
      <PageHeader title="Organizations" subtitle="Approve organizations before they can publish missions." />
      {sorted.length === 0 ? <EmptyState title="No organizations yet" body="Registered organizations appear here for review." /> : (
        <ul className="space-y-4">
          {sorted.map((o) => (
            <li key={o.id}>
              <Card className="space-y-3 p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div><h2 className="t-h3">{o.name}</h2><p className="t-small text-muted">{o.organizationType} · {o.city}, {o.country} · registered {fmtDate(o.createdAt)} · owner {o.ownerName}</p></div>
                  <Badge tone={o.verificationStatus === "approved" ? "success" : o.verificationStatus === "pending" ? "warning" : "danger"}>{o.verificationStatus}</Badge>
                </div>
                <p className="t-small">{o.description}</p>
                <p className="t-small text-muted">{o.email}{o.website ? ` · ${o.website}` : ""}</p>
                {o.verificationNote && <p className="t-small text-muted"><strong>Note:</strong> {o.verificationNote}</p>}
                <div className="flex gap-2">
                  {o.verificationStatus !== "approved" && <Button loading={busy === o.id} onClick={() => decide(o.id, "approved")}>Approve</Button>}
                  {o.verificationStatus !== "rejected" && <Button variant="danger" onClick={() => { setRejecting(o.id); setErr(""); }}>Reject</Button>}
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
      <Dialog open={!!rejecting} onClose={() => setRejecting(null)} title="Reject organization">
        <div className="space-y-4">
          <Textarea label="Reason (sent to the organization)" rows={3} value={note} error={err} onChange={(e) => { setNote(e.target.value); setErr(""); }} data-autofocus />
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setRejecting(null)}>Cancel</Button>
            <Button variant="danger" loading={busy === rejecting} onClick={() => rejecting && decide(rejecting, "rejected", note)}>Reject organization</Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
