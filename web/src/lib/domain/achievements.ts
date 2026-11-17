import { CATEGORIES } from "./types";

/** Everything achievements are computed from. All values come from verified records, never from the client. */
export interface AchievementStats {
  approvedMissions: number;
  hours: number;
  xp: number;
  level: number;
  streak: number;
  totalImpact: number;
  categories: string[]; // distinct causes with at least one approved mission
  friends: number;
  certificates: number;
  cheersGiven: number;
  cheersReceived: number;
  profileComplete: boolean;
}

export type AchievementTier = "bronze" | "silver" | "gold";

export interface AchievementDef {
  id: string;
  title: string;
  description: string;
  icon: "sprout" | "target" | "clock" | "flame" | "zap" | "compass" | "users" | "award" | "heart" | "leaf" | "user" | "star";
  tier: AchievementTier;
  goal: number;
  value: (s: AchievementStats) => number;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: "first_step", title: "First step", description: "Get your first mission approved.", icon: "sprout", tier: "bronze", goal: 1, value: (s) => s.approvedMissions },
  { id: "on_a_roll", title: "On a roll", description: "Complete 5 verified missions.", icon: "target", tier: "silver", goal: 5, value: (s) => s.approvedMissions },
  { id: "mission_master", title: "Mission master", description: "Complete 25 verified missions.", icon: "target", tier: "gold", goal: 25, value: (s) => s.approvedMissions },
  { id: "ten_hours", title: "Ten-hour helper", description: "Volunteer for 10 verified hours.", icon: "clock", tier: "bronze", goal: 10, value: (s) => s.hours },
  { id: "fifty_hours", title: "Fifty-hour hero", description: "Volunteer for 50 verified hours.", icon: "clock", tier: "gold", goal: 50, value: (s) => s.hours },
  { id: "streak_3", title: "Warming up", description: "Reach a 3-day streak.", icon: "flame", tier: "bronze", goal: 3, value: (s) => s.streak },
  { id: "streak_7", title: "Unstoppable week", description: "Reach a 7-day streak.", icon: "flame", tier: "gold", goal: 7, value: (s) => s.streak },
  { id: "level_5", title: "Rising star", description: "Reach level 5.", icon: "zap", tier: "silver", goal: 5, value: (s) => s.level },
  { id: "level_10", title: "True volunteer", description: "Reach level 10.", icon: "star", tier: "gold", goal: 10, value: (s) => s.level },
  { id: "explorer", title: "Cause explorer", description: "Complete missions in 3 different causes.", icon: "compass", tier: "silver", goal: 3, value: (s) => s.categories.length },
  { id: "all_rounder", title: "All-rounder", description: `Complete a mission in all ${CATEGORIES.length} causes.`, icon: "compass", tier: "gold", goal: CATEGORIES.length, value: (s) => s.categories.length },
  { id: "impact_50", title: "Impact maker", description: "Reach 50 verified impact actions.", icon: "leaf", tier: "silver", goal: 50, value: (s) => s.totalImpact },
  { id: "first_friend", title: "Better together", description: "Add your first friend.", icon: "users", tier: "bronze", goal: 1, value: (s) => s.friends },
  { id: "squad", title: "Squad goals", description: "Have 5 friends on WORFIX.", icon: "users", tier: "silver", goal: 5, value: (s) => s.friends },
  { id: "cheerleader", title: "Cheerleader", description: "Cheer 10 pieces of other people's work.", icon: "heart", tier: "bronze", goal: 10, value: (s) => s.cheersGiven },
  { id: "crowd_favourite", title: "Crowd favourite", description: "Receive 10 cheers on your work.", icon: "heart", tier: "silver", goal: 10, value: (s) => s.cheersReceived },
  { id: "certified", title: "Certified", description: "Earn 3 certificates.", icon: "award", tier: "silver", goal: 3, value: (s) => s.certificates },
  { id: "all_set", title: "All set", description: "Complete your profile: photo, bio, location and skills.", icon: "user", tier: "bronze", goal: 1, value: (s) => (s.profileComplete ? 1 : 0) },
];

export interface AchievementState extends Omit<AchievementDef, "value"> {
  current: number;
  unlocked: boolean;
  fraction: number;
}

export function computeAchievements(stats: AchievementStats): AchievementState[] {
  return ACHIEVEMENTS.map(({ value, ...def }) => {
    const current = Math.max(0, Math.min(value(stats), def.goal));
    return { ...def, current: Math.round(current * 10) / 10, unlocked: current >= def.goal, fraction: def.goal ? current / def.goal : 0 };
  });
}

/** The locked achievement the user is closest to finishing (used for advice on the home screen). */
export function nextAchievement(list: AchievementState[]): AchievementState | null {
  const locked = list.filter((a) => !a.unlocked);
  if (!locked.length) return null;
  return locked.reduce((best, a) => (a.fraction > best.fraction ? a : best));
}
