"use client";
import { Award, Clock, Compass, Flame, Heart, Leaf, Lock, Sprout, Star, Target, UserRound, Users, Zap } from "lucide-react";
import { Card, ProgressBar, cn } from "./ui";
import type { AchievementState } from "@/lib/domain/achievements";

const ICONS = { sprout: Sprout, target: Target, clock: Clock, flame: Flame, zap: Zap, compass: Compass, users: Users, award: Award, heart: Heart, leaf: Leaf, user: UserRound, star: Star };
const TIER_LABEL = { bronze: "Bronze", silver: "Silver", gold: "Gold" };
// Unlocked medal colours per tier, built from the design tokens.
const TIER_STYLE = { bronze: "bg-accent-soft text-on-accent-soft", silver: "bg-secondary-soft text-on-secondary-soft", gold: "bg-accent-fill text-on-accent-fill" };

export function AchievementMedal({ a, size = 48 }: { a: AchievementState; size?: number }) {
  const Icon = ICONS[a.icon];
  return (
    <span aria-hidden className={cn("inline-flex shrink-0 items-center justify-center rounded-full", a.unlocked ? TIER_STYLE[a.tier] : "bg-surface-2 text-muted")} style={{ width: size, height: size }}>
      {a.unlocked ? <Icon style={{ width: size * 0.48, height: size * 0.48 }} /> : <Lock style={{ width: size * 0.4, height: size * 0.4 }} />}
    </span>
  );
}

export function AchievementGrid({ list }: { list: AchievementState[] }) {
  const sorted = [...list].sort((a, b) => Number(b.unlocked) - Number(a.unlocked) || b.fraction - a.fraction);
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {sorted.map((a) => (
        <li key={a.id}>
          <Card className={cn("flex h-full items-start gap-4 p-4", !a.unlocked && "shadow-none")}>
            <AchievementMedal a={a} />
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-baseline gap-x-2 font-semibold">
                {a.title}
                <span className="t-caption font-medium text-muted">{TIER_LABEL[a.tier]}</span>
              </p>
              <p className="t-small text-muted">{a.description}</p>
              {a.unlocked ? (
                <p className="mt-2 t-small font-semibold text-primary">Unlocked</p>
              ) : (
                <div className="mt-2 flex items-center gap-3">
                  <div className="flex-1"><ProgressBar value={a.fraction} label={`${a.title} progress`} tone="success" /></div>
                  <span className="t-caption tabular-nums text-muted">{a.current}/{a.goal}</span>
                </div>
              )}
            </div>
          </Card>
        </li>
      ))}
    </ul>
  );
}
