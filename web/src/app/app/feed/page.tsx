"use client";
import { BookOpen, Clock, Droplets, Heart, Leaf, MapPin, Newspaper, PawPrint, Recycle, Users } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Avatar, Badge, ButtonLink, Card, EmptyState, ErrorState, LoadingBlock, PageHeader, Tabs, cn } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import type { Category } from "@/lib/domain/types";
import { CATEGORY_LABEL, fmtDuration } from "@/lib/format";
import { api } from "@/lib/store/api";
import { useApi } from "@/lib/store/hooks";

type Scope = "all" | "friends" | "area" | "mine";
const CATEGORY_ICON: Record<Category, typeof Leaf> = { environment: Leaf, community: Users, animals: PawPrint, education: BookOpen, water: Droplets, recycling: Recycle };
const EMPTY: Record<Scope, { title: string; body: string }> = {
  all: { title: "Nothing here yet", body: "Approved work from the community shows up here. Be the first — complete a mission." },
  friends: { title: "No work from friends yet", body: "Add friends and their approved missions will appear here." },
  area: { title: "Nothing from your area yet", body: "When volunteers from your province get work approved, you'll see it here." },
  mine: { title: "You have no approved work yet", body: "Once a reviewer approves your evidence, it appears here and in the community feed." },
};

function ago(iso: string) {
  const min = Math.max(1, Math.round((Date.now() - Date.parse(iso)) / 60_000));
  if (min < 60) return `${min} min ago`;
  if (min < 60 * 24) return `${Math.round(min / 60)} h ago`;
  const d = Math.round(min / (60 * 24));
  return d < 14 ? `${d} day${d > 1 ? "s" : ""} ago` : new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

export default function FeedPage() {
  const toast = useToast();
  const [scope, setScope] = useState<Scope>("all");
  const feed = useApi(() => api.feed({ scope }), [scope]);

  const cheer = async (id: string) => {
    try { await api.toggleCheer(id); } catch (e) { toast.error((e as Error).message); }
  };

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Community feed" subtitle="Verified work from volunteers. Every post was approved by a reviewer." />
      <Tabs label="Feed filter" value={scope} onChange={setScope} tabs={[{ id: "all", label: "Everyone" }, { id: "friends", label: "Friends" }, { id: "area", label: "My area" }, { id: "mine", label: "My work" }]} />

      <div role="tabpanel" id={`panel-${scope}`} aria-labelledby={`tab-${scope}`} className="mt-5">
        {feed.error ? <ErrorState error={feed.error} onRetry={feed.reload} /> : !feed.data ? <LoadingBlock /> : feed.data.length === 0 ? (
          <EmptyState {...EMPTY[scope]} icon={<Newspaper className="size-8" />} action={scope === "friends" ? <ButtonLink href="/app/friends">Find friends</ButtonLink> : <ButtonLink href="/missions">Find a mission</ButtonLink>} />
        ) : (
          <ul className="space-y-5">
            {feed.data.map((item) => {
              const Icon = CATEGORY_ICON[item.mission.category];
              const impact = item.mission.impactMetrics[0];
              return (
                <li key={item.id}>
                  <Card className="overflow-hidden">
                    <div className="flex items-center gap-3 p-4">
                      <Avatar name={item.author.fullName} src={item.author.avatar} size={44} />
                      <div className="min-w-0 flex-1">
                        <p className="flex flex-wrap items-center gap-x-2 font-semibold">
                          <span className="truncate">{item.isMe ? "You" : item.author.fullName}</span>
                          {item.isFriend && <Badge tone="info">Friend</Badge>}
                          {item.mission.isDemo && <Badge>Demo</Badge>}
                        </p>
                        <p className="t-small text-muted">Level {item.author.level} · {[item.author.city, item.author.country].filter(Boolean).join(", ")} · {ago(item.at)}</p>
                      </div>
                    </div>

                    {item.photos.length > 0 ? (
                      <div className={cn("grid gap-0.5 bg-border", item.photos.length > 1 && "grid-cols-2")}>
                        {item.photos.slice(0, 4).map((src, i) => (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img key={i} src={src} alt={`Evidence photo ${i + 1} from ${item.mission.title}`} loading="lazy" className={cn("w-full object-cover", item.photos.length === 1 ? "max-h-96" : "aspect-square", item.photos.length === 3 && i === 0 && "col-span-2 aspect-[2/1]")} />
                        ))}
                      </div>
                    ) : (
                      <div className="flex items-center gap-4 bg-primary-soft px-5 py-6 text-on-primary-soft">
                        <Icon className="size-10 shrink-0" aria-hidden />
                        <p className="t-small">Completed and verified{item.mission.isDemo ? " (demo post, no photo)" : ""}.</p>
                      </div>
                    )}

                    <div className="space-y-3 p-4">
                      <div>
                        <p className="font-semibold">
                          {item.mission.isDemo ? item.mission.title : <Link href={`/missions/${item.mission.id}`} className="underline-offset-4 hover:underline">{item.mission.title}</Link>}
                        </p>
                        <p className="t-small text-muted">{item.organizationName}</p>
                      </div>
                      {item.notes && <p className="t-small">{item.notes}</p>}
                      <ul className="flex flex-wrap gap-2">
                        <li><Badge tone="info">{CATEGORY_LABEL[item.mission.category]}</Badge></li>
                        <li><Badge><Clock className="size-3" aria-hidden /> {fmtDuration(item.mission.duration)}</Badge></li>
                        {impact && <li><Badge tone="success"><Leaf className="size-3" aria-hidden /> {impact.amountPerVolunteer} {impact.label}</Badge></li>}
                        <li><Badge><MapPin className="size-3" aria-hidden /> {item.mission.location}</Badge></li>
                      </ul>
                      <div className="flex items-center gap-3 border-t border-border pt-3">
                        <button type="button" onClick={() => cheer(item.id)} disabled={item.isMe} aria-pressed={item.cheered}
                          aria-label={item.isMe ? `${item.cheers} cheers on your work` : item.cheered ? "Remove your cheer" : "Cheer this work"}
                          className={cn("inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition-[background-color,transform] duration-150 active:scale-95 disabled:pointer-events-none",
                            item.cheered ? "border-accent bg-accent-soft text-on-accent-soft" : "border-border-strong hover:bg-surface-2")}>
                          <Heart className={cn("size-4", item.cheered && "fill-current")} aria-hidden />
                          {item.isMe ? "Cheers" : item.cheered ? "Cheered" : "Cheer"}
                          <span className="tabular-nums">{item.cheers}</span>
                        </button>
                      </div>
                    </div>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
