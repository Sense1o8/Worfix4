"use client";
import { useState } from "react";
import { Badge, Button, ErrorState, Input, LoadingBlock, PageHeader, Table, Textarea } from "@/components/ui";
import { Dialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import type { UserProfile } from "@/lib/domain/types";
import { fmtDate } from "@/lib/format";
import { api, ValidationError } from "@/lib/store/api";
import { useApi } from "@/lib/store/hooks";

export default function AdminUsers() {
  const toast = useToast();
  const users = useApi(() => api.adminUsers());
  const [q, setQ] = useState("");
  const [target, setTarget] = useState<UserProfile | null>(null);
  const [reason, setReason] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  if (users.error) return <ErrorState error={users.error} onRetry={users.reload} />;
  if (!users.data) return <LoadingBlock />;
  const list = users.data.filter((u) => `${u.fullName} ${u.email} ${u.username}`.toLowerCase().includes(q.toLowerCase()));
  const close = () => { setTarget(null); setReason(""); setErr(""); };

  const apply = async () => {
    if (!target) return;
    setBusy(true);
    try {
      await api.setUserStatus(target.id, target.status === "suspended" ? "active" : "suspended", reason);
      toast.success(target.status === "suspended" ? "Account reactivated." : "Account suspended.");
      close();
    } catch (e) { setErr(e instanceof ValidationError ? (e.fields.reason ?? e.message) : (e as Error).message); }
    setBusy(false);
  };

  return (
    <div>
      <PageHeader title="Users" subtitle={`${users.data.length} accounts`} />
      <div className="mb-4 max-w-sm"><Input label="Search users" type="search" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      <Table>
        <thead><tr><th scope="col">Name</th><th scope="col">Role</th><th scope="col">Status</th><th scope="col">Trust</th><th scope="col">Joined</th><th scope="col"><span className="sr-only">Actions</span></th></tr></thead>
        <tbody>
          {list.map((u) => (
            <tr key={u.id}>
              <td><p className="font-semibold">{u.fullName}</p><p className="t-caption text-muted">{u.email}</p></td>
              <td className="capitalize">{u.role.replace("_", " ")}</td>
              <td><Badge tone={u.status === "active" ? "success" : u.status === "suspended" ? "danger" : "neutral"}>{u.status}</Badge></td>
              <td className="tabular-nums">{u.trustScore}</td>
              <td>{fmtDate(u.createdAt)}</td>
              <td className="text-right">
                {u.status !== "deleted" && <Button size="sm" variant={u.status === "suspended" ? "secondary" : "ghost"} onClick={() => setTarget(u)}>{u.status === "suspended" ? "Reactivate" : "Suspend"}</Button>}
              </td>
            </tr>
          ))}
        </tbody>
      </Table>

      <Dialog open={!!target} onClose={close} title={target?.status === "suspended" ? `Reactivate ${target?.fullName}?` : `Suspend ${target?.fullName}?`}>
        <div className="space-y-4">
          <p className="t-small text-muted">{target?.status === "suspended" ? "They will be able to sign in again." : "They will be signed out on next action and can't log in. The reason is recorded in the audit log."}</p>
          <Textarea label="Reason" rows={3} value={reason} error={err} onChange={(e) => { setReason(e.target.value); setErr(""); }} data-autofocus />
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={close}>Cancel</Button>
            <Button variant={target?.status === "suspended" ? "primary" : "danger"} loading={busy} onClick={apply}>{target?.status === "suspended" ? "Reactivate account" : "Suspend account"}</Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
