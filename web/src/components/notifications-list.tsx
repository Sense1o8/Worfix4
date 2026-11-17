"use client";
import { BellOff } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";
import { Badge, Button, Card, EmptyState, ErrorState, LoadingBlock, PageHeader } from "./ui";
import { fmtDateTime } from "@/lib/format";
import { api } from "@/lib/store/api";
import { useApi } from "@/lib/store/hooks";

export function NotificationsList() {
  const res = useApi(() => api.myNotifications());
  const unread = res.data?.filter((n) => !n.read).length ?? 0;
  useEffect(() => {
    // Leaving the page counts as reading what was shown.
    return () => { void api.markNotificationsRead().catch(() => {}); };
  }, []);
  return (
    <div className="max-w-2xl">
      <PageHeader title="Notifications" actions={unread > 0 ? <Button variant="secondary" size="sm" onClick={() => api.markNotificationsRead()}>Mark all as read</Button> : undefined} />
      {res.error ? <ErrorState error={res.error} onRetry={res.reload} /> : !res.data ? <LoadingBlock /> : res.data.length === 0 ? (
        <EmptyState title="You're all caught up" body="Mission updates and review decisions will appear here." icon={<BellOff className="size-8" />} />
      ) : (
        <ul className="space-y-2">
          {res.data.map((n) => {
            const body = (
              <Card className={`p-4 ${n.read ? "" : "border-secondary"}`}>
                <div className="flex items-start justify-between gap-3">
                  <p className="font-semibold">{n.title}</p>
                  {!n.read && <Badge tone="info">New</Badge>}
                </div>
                <p className="t-small mt-0.5 text-muted">{n.message}</p>
                <p className="t-caption mt-1.5 text-muted">{fmtDateTime(n.createdAt)}</p>
              </Card>
            );
            return <li key={n.id}>{n.link ? <Link href={n.link} className="block">{body}</Link> : body}</li>;
          })}
        </ul>
      )}
    </div>
  );
}
