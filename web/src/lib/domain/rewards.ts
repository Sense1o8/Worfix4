import type { Difficulty, ImpactMetric, UserProfile } from "./types";

/** Base XP by difficulty. PRD 5.10: XP depends on difficulty, duration, impact, consistency, campaigns. */
const BASE_XP: Record<Difficulty, number> = { easy: 50, medium: 100, hard: 200 };

export const MAX_STREAK_BONUS = 0.25;

/** Reward for a mission. Computed server-side; clients never supply reward values. */
export function computeMissionReward(difficulty: Difficulty, durationMinutes: number) {
  const minutes = Math.max(0, Math.min(durationMinutes, 12 * 60));
  const rewardXP = BASE_XP[difficulty] + Math.floor(minutes / 30) * 10;
  const rewardPoints = Math.round(rewardXP / 2);
  return { rewardXP, rewardPoints };
}

/** Consistency bonus: +5% per streak day already held, capped at 25%. */
export function streakBonusMultiplier(streak: number) {
  return 1 + Math.min(Math.max(streak, 0) * 0.05, MAX_STREAK_BONUS);
}

/** Level n starts at 100*(n-1)^2 XP (level 10 = 8,100 XP; level 100 = 980,100 XP). */
export function levelForXp(xp: number) {
  return Math.floor(Math.sqrt(Math.max(xp, 0) / 100)) + 1;
}

export function xpForLevel(level: number) {
  return 100 * Math.pow(Math.max(level, 1) - 1, 2);
}

export function levelProgress(xp: number) {
  const level = levelForXp(xp);
  const start = xpForLevel(level);
  const next = xpForLevel(level + 1);
  return { level, start, next, fraction: next === start ? 0 : (xp - start) / (next - start) };
}

/** PRD 5.11 example tiers. */
export function levelTitle(level: number) {
  if (level >= 100) return "Legend";
  if (level >= 50) return "Guardian";
  if (level >= 25) return "Protector";
  if (level >= 10) return "Volunteer";
  return "Explorer";
}

/** Consecutive-day streak, evaluated on calendar days (UTC). */
export function nextStreak(prevStreak: number, lastDay: string | null, today: string) {
  if (!lastDay) return 1;
  if (lastDay === today) return Math.max(prevStreak, 1);
  const diff = Math.round((Date.parse(today) - Date.parse(lastDay)) / 86_400_000);
  return diff === 1 ? prevStreak + 1 : 1;
}

export function dayKey(iso: string) {
  return iso.slice(0, 10);
}

export interface RewardGrant {
  xp: number;
  points: number;
  hours: number;
  impact: Record<string, number>;
}

export function computeGrant(
  mission: { rewardXP: number; rewardPoints: number; duration: number; impactMetrics: ImpactMetric[] },
  user: Pick<UserProfile, "streak">,
): RewardGrant {
  const mult = streakBonusMultiplier(user.streak);
  const impact: Record<string, number> = {};
  for (const m of mission.impactMetrics) impact[m.label] = (impact[m.label] ?? 0) + m.amountPerVolunteer;
  return {
    xp: Math.round(mission.rewardXP * mult),
    points: Math.round(mission.rewardPoints * mult),
    hours: Math.round((mission.duration / 60) * 100) / 100,
    impact,
  };
}
