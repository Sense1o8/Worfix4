"use client";
import { Check, Search, Trophy, UserMinus, UserPlus, Users, X } from "lucide-react";
import { useState } from "react";
import { PersonRow } from "@/components/person";
import { Badge, Button, Card, EmptyState, ErrorState, Input, LoadingBlock, PageHeader, Tabs, cn } from "@/components/ui";
import { Dialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { api, type Person } from "@/lib/store/api";
import { useApi } from "@/lib/store/hooks";

type Tab = "friends" | "find" | "leaderboard";

export default function FriendsPage() {
  const toast = useToast();
  const [tab, setTab] = useState<Tab>("friends");
  const [q, setQ] = useState("");
  const [removing, setRemoving] = useState<Person | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const overview = useApi(() => api.friendsOverview());
  const people = useApi(() => api.people(q), [q]);

  const run = async (key: string, fn: () => Promise<void>, ok: string) => {
    setBusy(key);
    try { await fn(); toast.success(ok); } catch (e) { toast.error((e as Error).message); }
    setBusy(null);
  };

  if (overview.error) return <ErrorState error={overview.error} onRetry={overview.reload} />;
  const o = overview.data;
  if (!o) return <LoadingBlock />;

  return (
    <div className="max-w-3xl">
      <PageHeader title="Friends" subtitle="Volunteer together, cheer each other on and compare progress." />

      {o.incoming.length > 0 && (
        <section aria-labelledby="req-h" className="mb-6">
          <h2 id="req-h" className="t-h3 mb-3">Friend requests <Badge tone="reward">{o.incoming.length}</Badge></h2>
          <ul className="space-y-3">
            {o.incoming.map(({ friendshipId, person }) => (
              <li key={friendshipId}>
                <Card className="p-4">
                  <PersonRow p={person} actions={<>
                    <Button size="sm" loading={busy === friendshipId} onClick={() => run(friendshipId, () => api.respondFriendRequest(friendshipId, true), `You and ${person.fullName} are now friends.`)}><Check className="size-4" aria-hidden /> Accept</Button>
                    <Button size="sm" variant="secondary" disabled={busy === friendshipId} onClick={() => run(friendshipId, () => api.respondFriendRequest(friendshipId, false), "Request declined.")}><X className="size-4" aria-hidden /> Decline</Button>
                  </>} />
                </Card>
              </li>
            ))}
          </ul>
        </section>
      )}

      <Tabs label="Friends sections" value={tab} onChange={setTab} tabs={[{ id: "friends", label: "My friends", count: o.friends.length }, { id: "find", label: "Find people" }, { id: "leaderboard", label: "Leaderboard" }]} />

      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="mt-5">
        {tab === "friends" && (
          <div className="space-y-6">
            {o.friends.length === 0 ? (
              <EmptyState title="No friends yet" body="Find people from your city or search by name, then send a request." icon={<Users className="size-8" />} action={<Button onClick={() => setTab("find")}>Find people</Button>} />
            ) : (
              <ul className="space-y-3">
                {o.friends.map((p) => (
                  <li key={p.id}><Card className="p-4"><PersonRow p={p} actions={<Button size="sm" variant="ghost" aria-label={`Remove ${p.fullName}`} onClick={() => setRemoving(p)}><UserMinus className="size-4" aria-hidden /> Remove</Button>} /></Card></li>
                ))}
              </ul>
            )}
            {o.outgoing.length > 0 && (
              <section aria-labelledby="out-h">
                <h2 id="out-h" className="t-h3 mb-3">Requests you sent</h2>
                <ul className="space-y-3">
                  {o.outgoing.map(({ friendshipId, person }) => (
                    <li key={friendshipId}><Card className="p-4"><PersonRow p={person} actions={<Button size="sm" variant="secondary" loading={busy === friendshipId} onClick={() => run(friendshipId, () => api.removeFriend(person.id), "Request cancelled.")}>Cancel request</Button>} /></Card></li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        )}

        {tab === "find" && (
          <div className="space-y-4">
            <div className="relative">
              <Input label="Search volunteers" type="search" placeholder="Name, username or city" value={q} onChange={(e) => setQ(e.target.value)} className="pl-10" />
              <Search className="pointer-events-none absolute left-3 top-[2.375rem] size-5 text-muted" aria-hidden />
            </div>
            {!people.data ? <LoadingBlock /> : people.data.length === 0 ? (
              <EmptyState title={q ? "No one matches that search" : "No other volunteers yet"} body={q ? "Try a different name or city." : "Invite friends to join WORFIX and they'll show up here."} icon={<Search className="size-8" />} />
            ) : (
              <ul className="space-y-3">
                {people.data.map((p) => (
                  <li key={p.id}>
                    <Card className="p-4">
                      <PersonRow p={p} actions={<>
                        {p.nearby && <Badge tone="info">Near you</Badge>}
                        {p.relation === "friend" ? <Badge tone="success"><Check className="size-3" aria-hidden /> Friends</Badge>
                          : p.relation === "outgoing" ? <Badge tone="warning">Request sent</Badge>
                          : <Button size="sm" variant={p.relation === "incoming" ? "primary" : "secondary"} loading={busy === p.id}
                              onClick={() => run(p.id, () => api.sendFriendRequest(p.id), p.relation === "incoming" ? `You and ${p.fullName} are now friends.` : "Friend request sent.")}>
                              <UserPlus className="size-4" aria-hidden /> {p.relation === "incoming" ? "Accept request" : "Add friend"}
                            </Button>}
                      </>} />
                    </Card>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {tab === "leaderboard" && (o.leaderboard.length < 2 ? (
          <EmptyState title="Add a friend to start a leaderboard" body="You'll be ranked by verified XP against your friends only." icon={<Trophy className="size-8" />} action={<Button onClick={() => setTab("find")}>Find people</Button>} />
        ) : (
          <ol className="space-y-3">
            {o.leaderboard.map((p, i) => (
              <li key={p.id}>
                <Card className={cn("p-4", p.isMe && "border-primary bg-primary-soft/40")}>
                  <PersonRow p={p} prefix={<span className={cn("inline-flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-bold tabular-nums", i === 0 ? "bg-accent-fill text-on-accent-fill" : "bg-surface-2")}>{i + 1}</span>}
                    actions={<>{p.isMe && <Badge tone="success">You</Badge>}<Badge>{p.hours} h</Badge></>} />
                </Card>
              </li>
            ))}
          </ol>
        ))}
      </div>

      <Dialog open={removing !== null} onClose={() => setRemoving(null)} title={`Remove ${removing?.fullName ?? "friend"}?`}>
        <p className="t-small text-muted">You&apos;ll stop seeing each other in the Friends feed and leaderboard. You can send a new request later.</p>
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setRemoving(null)} data-autofocus>Keep friend</Button>
          <Button variant="danger" onClick={async () => { const p = removing!; setRemoving(null); await run(p.id, () => api.removeFriend(p.id), "Friend removed."); }}>Remove</Button>
        </div>
      </Dialog>
    </div>
  );
}
