"use client";
import { useState } from "react";
import { ErrorState, Input, LoadingBlock, PageHeader, Table } from "@/components/ui";
import { fmtDateTime } from "@/lib/format";
import { api } from "@/lib/store/api";
import { useApi } from "@/lib/store/hooks";

export default function AuditLog() {
  const res = useApi(() => api.adminAudit(300));
  const [q, setQ] = useState("");
  if (res.error) return <ErrorState error={res.error} onRetry={res.reload} />;
  if (!res.data) return <LoadingBlock />;
  const rows = res.data.filter((a) => `${a.action} ${a.detail} ${a.actorRole} ${a.resourceId}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <div>
      <PageHeader title="Audit log" subtitle="Every sensitive action is recorded. Entries can't be edited from the app." />
      <div className="mb-4 max-w-sm"><Input label="Filter" type="search" value={q} onChange={(e) => setQ(e.target.value)} hint="Action, role, detail or id" /></div>
      <Table>
        <thead><tr><th scope="col">When</th><th scope="col">Action</th><th scope="col">Actor</th><th scope="col">Detail</th></tr></thead>
        <tbody>
          {rows.map((a) => (
            <tr key={a.id}>
              <td className="whitespace-nowrap">{fmtDateTime(a.timestamp)}</td>
              <td className="font-mono">{a.action}</td>
              <td className="capitalize">{a.actorRole.replace("_", " ")}</td>
              <td className="max-w-xs truncate text-muted" title={a.detail}>{a.detail || a.resourceId}</td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}
