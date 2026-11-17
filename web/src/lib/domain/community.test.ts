import { describe, expect, it } from "vitest";
import { ACHIEVEMENTS, computeAchievements, nextAchievement, type AchievementStats } from "./achievements";
import { buildAdvice, type AdviceInput } from "./advice";
import { profileSchema } from "./validation";

const stats = (over: Partial<AchievementStats> = {}): AchievementStats => ({
  approvedMissions: 0, hours: 0, xp: 0, level: 1, streak: 0, totalImpact: 0, categories: [], friends: 0, certificates: 0,
  cheersGiven: 0, cheersReceived: 0, profileComplete: false, ...over,
});

describe("achievements", () => {
  it("has unique ids and nothing is unlocked for a brand-new volunteer", () => {
    expect(new Set(ACHIEVEMENTS.map((a) => a.id)).size).toBe(ACHIEVEMENTS.length);
    expect(computeAchievements(stats()).some((a) => a.unlocked)).toBe(false);
  });
  it("unlocks at the goal and caps progress at the goal", () => {
    const list = computeAchievements(stats({ approvedMissions: 7, friends: 1, hours: 4.5 }));
    const get = (id: string) => list.find((a) => a.id === id)!;
    expect(get("first_step").unlocked).toBe(true);
    expect(get("on_a_roll")).toMatchObject({ unlocked: true, current: 5, fraction: 1 });
    expect(get("mission_master")).toMatchObject({ unlocked: false, current: 7 });
    expect(get("first_friend").unlocked).toBe(true);
    expect(get("ten_hours")).toMatchObject({ unlocked: false, current: 4.5, fraction: 0.45 });
  });
  it("picks the closest locked achievement as the next one", () => {
    const next = nextAchievement(computeAchievements(stats({ approvedMissions: 4, streak: 1 })));
    expect(next?.id).toBe("on_a_roll"); // 4/5 beats 1/3
    const all = computeAchievements(stats({ approvedMissions: 99, hours: 99, level: 99, streak: 99, totalImpact: 99, categories: ["a", "b", "c", "d", "e", "f"], friends: 9, certificates: 9, cheersGiven: 99, cheersReceived: 99, profileComplete: true }));
    expect(nextAchievement(all)).toBeNull();
  });
});

const advice = (over: Partial<AdviceInput> = {}): AdviceInput => ({
  emailVerified: true, profileComplete: true, approvedMissions: 3, activeMissions: 1, needsEvidence: 0, needsMoreInfo: 0, streak: 0,
  lastApprovedDay: null, today: "2026-11-17", friends: 2, pendingFriendRequests: 0, nearbyOpenMissions: 0, topCategory: null,
  untriedCategory: null, nextAchievement: null, friendsRank: 1, xpToNextFriend: null, ...over,
});

describe("advice", () => {
  it("puts blocking actions first and never returns more than four items", () => {
    const list = buildAdvice(advice({ needsMoreInfo: 1, needsEvidence: 2, emailVerified: false, pendingFriendRequests: 1, friends: 0, profileComplete: false, nearbyOpenMissions: 3 }));
    expect(list).toHaveLength(4);
    expect(list.map((a) => a.id)).toEqual(["more_info", "evidence", "verify", "requests"]);
  });
  it("suggests a first mission to someone who has not started", () => {
    expect(buildAdvice(advice({ approvedMissions: 0, activeMissions: 0 })).map((a) => a.id)).toContain("first");
  });
  it("only nudges about the streak when today has no approval yet", () => {
    expect(buildAdvice(advice({ streak: 3, lastApprovedDay: "2026-11-16" })).map((a) => a.id)).toContain("streak");
    expect(buildAdvice(advice({ streak: 3, lastApprovedDay: "2026-11-17" })).map((a) => a.id)).not.toContain("streak");
  });
});

describe("profile location", () => {
  const base = { fullName: "Vera V", username: "vera_v", bio: "", country: "Uzbekistan", city: "Samarkand", feedVisible: true, languages: ["Uzbek"], skills: [], interests: ["water"] };
  it("accepts an empty province (some countries have none) and requires a country", () => {
    expect(profileSchema.safeParse({ ...base, province: "" }).success).toBe(true);
    expect(profileSchema.safeParse({ ...base, province: "Samarqand Region" }).success).toBe(true);
    expect(profileSchema.safeParse({ ...base, province: "", country: "" }).success).toBe(false);
  });
});
