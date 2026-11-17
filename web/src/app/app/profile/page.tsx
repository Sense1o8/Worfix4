"use client";
import { Award, Download, Flame, MapPin, Trash2, Users, Zap } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { AchievementGrid } from "@/components/achievements";
import { ProfileForm } from "@/components/profile-form";
import { useMe } from "@/components/shells";
import { Avatar, Badge, Button, ButtonLink, Card, LoadingBlock, ProgressBar, Tabs } from "@/components/ui";
import { Dialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { levelProgress, levelTitle } from "@/lib/domain/rewards";
import { api } from "@/lib/store/api";
import { useApi } from "@/lib/store/hooks";

type Tab = "details" | "achievements" | "privacy";
const TABS: Tab[] = ["details", "achievements", "privacy"];

function Profile() {
  const me = useMe();
  const insights = useApi(() => api.myInsights());
  const toast = useToast();
  const router = useRouter();
  const param = useSearchParams().get("tab") as Tab | null;
  const [tab, setTab] = useState<Tab>(param && TABS.includes(param) ? param : "details");
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const u = me.data;
  if (!u) return <LoadingBlock />;

  const exportData = async () => {
    try {
      const data = await api.exportMyData();
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
      const a = Object.assign(document.createElement("a"), { href: url, download: "worfix-my-data.json" });
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Your data was downloaded.");
    } catch (e) { toast.error((e as Error).message); }
  };
  const del = async () => {
    setBusy(true);
    try {
      await api.deleteAccount();
      toast.success("Your account was deleted.");
      router.replace("/");
    } catch (e) { toast.error((e as Error).message); setBusy(false); }
  };

  const lp = levelProgress(u.xp);
  const place = [u.city, u.province, u.country].filter(Boolean).join(", ");
  const list = insights.data?.achievements ?? [];
  const unlocked = list.filter((a) => a.unlocked).length;

  return (
    <div className="max-w-3xl">
      <Card className="p-6">
        <div className="flex flex-wrap items-center gap-5">
          <Avatar name={u.fullName} src={u.avatar} size={80} />
          <div className="min-w-0 flex-1">
            <h1 className="t-h1 truncate">{u.fullName}</h1>
            <p className="t-small text-muted">@{u.username} · {u.email}</p>
            {place && <p className="mt-1 flex items-center gap-1.5 t-small text-muted"><MapPin className="size-4" aria-hidden /> {place}</p>}
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge tone="reward"><Zap className="size-3" aria-hidden /> Level {lp.level} · {levelTitle(lp.level)}</Badge>
            {u.streak > 0 && <Badge><Flame className="size-3" aria-hidden /> {u.streak}-day streak</Badge>}
          </div>
        </div>
        <div className="mt-5"><ProgressBar value={lp.fraction} label={`Progress to level ${lp.level + 1}`} /></div>
        <p className="mt-2 t-small text-muted">{u.xp.toLocaleString()} XP · {(lp.next - u.xp).toLocaleString()} XP to level {lp.level + 1}</p>
        <div className="mt-5 flex flex-wrap gap-2">
          <ButtonLink href="/app/friends" variant="secondary" size="sm"><Users className="size-4" aria-hidden /> Friends{insights.data ? ` (${insights.data.friends.count})` : ""}</ButtonLink>
          <ButtonLink href="/app/certificates" variant="secondary" size="sm"><Award className="size-4" aria-hidden /> Certificates</ButtonLink>
        </div>
      </Card>

      <div className="mt-6">
        <Tabs label="Profile sections" value={tab} onChange={setTab} tabs={[
          { id: "details", label: "Details" },
          { id: "achievements", label: "Achievements", count: insights.data ? unlocked : undefined },
          { id: "privacy", label: "Privacy & data" },
        ]} />
      </div>

      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="mt-5">
        {tab === "details" && <Card className="p-6"><ProfileForm user={u} /></Card>}

        {tab === "achievements" && (!insights.data ? <LoadingBlock /> : (
          <div className="space-y-5">
            <Card className="p-5">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="t-small text-muted">Achievements unlocked</p>
                  <p className="text-3xl font-bold tabular-nums tracking-tight">{unlocked}<span className="text-muted"> / {list.length}</span></p>
                </div>
                <p className="max-w-xs t-small text-muted">Achievements unlock automatically from verified activity. They can&apos;t be bought or self-awarded.</p>
              </div>
              <div className="mt-4"><ProgressBar value={list.length ? unlocked / list.length : 0} label="Achievements unlocked" /></div>
            </Card>
            <AchievementGrid list={list} />
          </div>
        ))}

        {tab === "privacy" && (
          <Card className="space-y-4 p-6">
            <p className="t-small text-muted">Your exact location is only collected when you tick the consent box on a submission, and is only visible to the reviewers of that mission. Your country, province and city are shown to organizers and other volunteers. You control whether approved work appears in the community feed under <button type="button" className="font-semibold underline underline-offset-4" onClick={() => setTab("details")}>Details</button>.</p>
            <div className="flex flex-wrap gap-3">
              <Button variant="secondary" onClick={exportData}><Download className="size-4" aria-hidden /> Download my data</Button>
              <Button variant="danger" onClick={() => setConfirm(true)}><Trash2 className="size-4" aria-hidden /> Delete my account</Button>
            </div>
            <p className="t-small text-muted">Looking for certificates? They live in <Link href="/app/certificates" className="font-semibold underline underline-offset-4">Certificates</Link>.</p>
          </Card>
        )}
      </div>

      <Dialog open={confirm} onClose={() => setConfirm(false)} title="Delete your account?">
        <p className="t-small text-muted">This removes your profile details, photos, friends and notifications and signs you out. Certificates you earned stay verifiable but no longer show your name. This can&apos;t be undone.</p>
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setConfirm(false)} data-autofocus>Keep my account</Button>
          <Button variant="danger" loading={busy} onClick={del}>Delete account</Button>
        </div>
      </Dialog>
    </div>
  );
}

export default function ProfilePage() {
  return <Suspense><Profile /></Suspense>;
}
