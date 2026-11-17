import { describe, expect, it } from "vitest";
import { reviewSubmission, resubmit, canTransition } from "./verification";
import { computeMissionReward, levelForXp, levelTitle, nextStreak, streakBonusMultiplier } from "./rewards";
import { assessSubmission } from "./fraud";
import { CODE_PATTERN, makeVerificationCode } from "./certificates";
import { canEnterArea, canReviewSubmission, DomainError, homeForRole } from "./permissions";
import { registerSchema, missionSchema, ageErrors } from "./validation";
import type { Mission, Organization, Submission, UserProfile } from "./types";

const NOW = "2026-11-16T10:00:00.000Z";
let n = 0;
const newId = () => `id${++n}`;

const user = (over: Partial<UserProfile> = {}): UserProfile => ({
  id: "vol1", email: "v@x.org", emailVerified: true, fullName: "Vera Volunteer", username: "vera", avatar: null,
  bio: "", country: "Uzbekistan", province: "Samarqand Region", city: "Samarkand", feedVisible: true, languages: ["Uzbek"], skills: [], interests: ["environment"],
  level: 1, xp: 0, points: 0, trustScore: 50, reputation: 0, streak: 0, lastApprovedDay: null,
  totalVolunteerHours: 0, totalImpact: 0, impact: {}, onboarded: true, organizationId: null, role: "volunteer",
  status: "active", createdAt: NOW, updatedAt: NOW, lastLogin: null, ...over,
});
const org: Organization = {
  id: "org1", name: "Green Samarkand", logo: null, description: "", website: "", email: "o@x.org", phone: "",
  address: "", country: "Uzbekistan", city: "Samarkand", organizationType: "NGO", verificationStatus: "approved",
  verificationNote: "", ownerId: "orgUser", members: ["orgUser"], rating: 0, totalVolunteers: 0, totalMissions: 0, createdAt: NOW,
};
const orgUser = user({ id: "orgUser", role: "organization", organizationId: "org1", username: "org" });
const admin = user({ id: "adm", role: "admin", username: "adm" });
const mission: Mission = {
  id: "m1", organizationId: "org1", title: "Plant 50 trees", description: "x", category: "environment",
  difficulty: "medium", rewardXP: 130, rewardPoints: 65, location: "Park", coordinates: { lat: 39.65, lng: 66.96 },
  date: "2026-11-15T08:00:00.000Z", deadline: "2026-11-14T08:00:00.000Z", duration: 120, capacity: 20, participantsCount: 1,
  status: "published", featured: false, requirements: "", safety: "", equipment: "",
  impactMetrics: [{ label: "trees planted", amountPerVolunteer: 5 }], moderationNote: "", isDemo: true,
  createdAt: NOW, updatedAt: NOW,
};
const sub = (over: Partial<Submission> = {}): Submission => ({
  id: "s1", missionId: "m1", userId: "vol1", organizationId: "org1",
  images: [{ kind: "image", dataUrl: "d", sha256: "aaa", name: "a.jpg", size: 10 }], videos: [], notes: "",
  gps: null, gpsConsent: false, timestamp: NOW, metadata: { userAgent: "t", submissionCount: 1 },
  aiConfidence: null, fraudScore: 0, fraudFlags: [], verificationStatus: "pending", reviewedBy: null,
  reviewedAt: null, reviewNote: "", rewardGrantedAt: null, certificateId: null, ...over,
});
const review = (over: Partial<Parameters<typeof reviewSubmission>[0]> = {}) =>
  reviewSubmission({
    submission: sub(), mission, volunteer: user(), reviewer: orgUser, organization: org,
    decision: "approved", note: "", now: NOW, newId, origin: "https://worfix.test", ...over,
  });

describe("review → rewards", () => {
  it("approval grants XP/points/hours/impact, a certificate, and marks the reward granted", () => {
    const r = review();
    expect(r.volunteer.xp).toBe(130);
    expect(r.volunteer.points).toBe(65);
    expect(r.volunteer.totalVolunteerHours).toBe(2);
    expect(r.volunteer.impact["trees planted"]).toBe(5);
    expect(r.volunteer.totalImpact).toBe(5);
    expect(r.volunteer.streak).toBe(1);
    expect(r.certificate?.verificationCode).toMatch(CODE_PATTERN);
    expect(r.certificate?.qrCode).toContain(r.certificate!.verificationCode);
    expect(r.submission.rewardGrantedAt).toBe(NOW);
    expect(r.audit.action).toBe("submission.approved");
  });

  it("cannot approve twice — XP is never awarded twice for one submission", () => {
    const first = review();
    expect(() => review({ submission: first.submission, volunteer: first.volunteer })).toThrow(DomainError);
    // even if status were tampered back to pending, the reward guard still blocks it
    const tampered = { ...first.submission, verificationStatus: "pending" as const };
    expect(() => review({ submission: tampered, volunteer: first.volunteer })).toThrow(/already granted/);
  });

  it("rejection and info requests grant nothing and need an explanation", () => {
    const rej = review({ decision: "rejected", note: "Photo does not show the site." });
    expect(rej.volunteer.xp).toBe(0);
    expect(rej.certificate).toBeNull();
    expect(rej.submission.rewardGrantedAt).toBeNull();
    expect(() => review({ decision: "rejected", note: "" })).toThrow(/explanation/);
    expect(() => review({ decision: "needs_more_info", note: "no" })).toThrow(DomainError);
  });

  it("rejected submissions are final", () => {
    const rej = review({ decision: "rejected", note: "Not enough evidence." });
    expect(() => review({ submission: rej.submission, decision: "approved" })).toThrow(/cannot become/);
  });

  it("needs_more_info → resubmit → pending → approvable", () => {
    const info = review({ decision: "needs_more_info", note: "Please add a wider photo." });
    expect(canTransition(info.submission.verificationStatus, "approved")).toBe(false);
    const again = resubmit(info.submission, { images: [], notes: "Added" }, NOW);
    expect(again.verificationStatus).toBe("pending");
    expect(again.metadata.submissionCount).toBe(2);
    expect(review({ submission: again }).volunteer.xp).toBe(130);
  });
});

describe("permissions", () => {
  it("volunteers cannot review, authors cannot review their own work", () => {
    expect(() => review({ reviewer: user({ id: "other" }) })).toThrow(/not allowed/);
    expect(() => review({ reviewer: { ...admin, id: "vol1" } })).toThrow(/not allowed/);
  });
  it("organizations can only review their own missions, and only when approved", () => {
    const other = { ...orgUser, organizationId: "org2" };
    expect(canReviewSubmission(other, sub(), org)).toBe(false);
    expect(canReviewSubmission(orgUser, sub(), { verificationStatus: "pending" })).toBe(false);
    expect(canReviewSubmission(orgUser, sub(), org)).toBe(true);
    expect(canReviewSubmission(admin, sub(), null)).toBe(true);
    expect(canReviewSubmission({ ...admin, status: "suspended" }, sub(), null)).toBe(false);
  });
  it("routes by role", () => {
    expect(homeForRole("volunteer")).toBe("/app");
    expect(homeForRole("organization")).toBe("/org");
    expect(homeForRole("super_admin")).toBe("/admin");
    expect(canEnterArea("volunteer", "admin")).toBe(false);
    expect(canEnterArea("organization", "admin")).toBe(false);
    expect(canEnterArea("admin", "organization")).toBe(true);
  });
});

describe("rewards maths", () => {
  it("computes reward from difficulty and duration", () => {
    expect(computeMissionReward("easy", 60)).toEqual({ rewardXP: 70, rewardPoints: 35 });
    expect(computeMissionReward("hard", 240).rewardXP).toBe(280);
    expect(computeMissionReward("easy", 100000).rewardXP).toBe(50 + 24 * 10); // capped at 12h
  });
  it("levels follow the PRD tiers", () => {
    expect(levelForXp(0)).toBe(1);
    expect(levelForXp(8100)).toBe(10);
    expect(levelTitle(9)).toBe("Explorer");
    expect(levelTitle(10)).toBe("Volunteer");
    expect(levelTitle(25)).toBe("Protector");
    expect(levelTitle(50)).toBe("Guardian");
    expect(levelTitle(100)).toBe("Legend");
  });
  it("streak bonus is capped and streak resets after a gap", () => {
    expect(streakBonusMultiplier(100)).toBe(1.25);
    expect(nextStreak(3, "2026-11-15", "2026-11-16")).toBe(4);
    expect(nextStreak(3, "2026-11-16", "2026-11-16")).toBe(3);
    expect(nextStreak(3, "2026-11-10", "2026-11-16")).toBe(1);
  });
});

describe("fraud heuristics (advisory only)", () => {
  it("flags reused photos, early timestamps and distant GPS", () => {
    const s = sub({ gps: { lat: 41.3, lng: 69.2, accuracy: 10 }, timestamp: "2026-11-01T00:00:00.000Z" });
    const r = assessSubmission(s, mission, [{ userId: "someoneElse", images: s.images }]);
    expect(r.flags.length).toBe(3);
    expect(r.score).toBeGreaterThan(0.9);
  });
  it("a clean, nearby submission scores low", () => {
    const s = sub({ gps: { lat: 39.651, lng: 66.961, accuracy: 10 } });
    expect(assessSubmission(s, mission, []).score).toBe(0);
  });
});

describe("validation", () => {
  const base = { fullName: "Vera V", email: "V@X.org", password: "abcdef12", accountType: "volunteer" as const, ageConfirmed: true as const, guardianConsent: false, birthYear: 2000 };
  it("accepts adults, blocks under-15 and requires guardian confirmation for 15–17", () => {
    expect(registerSchema.safeParse(base).success).toBe(true);
    const y = new Date().getFullYear();
    expect(registerSchema.safeParse({ ...base, birthYear: y - 14 }).success).toBe(false);
    expect(registerSchema.safeParse({ ...base, birthYear: y - 16 }).success).toBe(false);
    expect(registerSchema.safeParse({ ...base, birthYear: y - 16, guardianConsent: true }).success).toBe(true);
  });
  it("age rules are reported on their own, even when other fields are invalid", () => {
    const y = new Date().getFullYear();
    expect(ageErrors(y - 13, false).birthYear).toMatch(/15 and over/);
    expect(ageErrors(y - 16, false).guardianConsent).toMatch(/Under 18/);
    expect(ageErrors(y - 16, true)).toEqual({});
    expect(ageErrors(y - 30, false)).toEqual({});
    expect(ageErrors("abc", false)).toEqual({}); // field schema reports the bad year itself
  });
  it("rejects weak passwords", () => {
    expect(registerSchema.safeParse({ ...base, password: "abcdefgh" }).success).toBe(false);
  });
  it("mission deadline must precede start", () => {
    const m = { title: "Clean the river", description: "x".repeat(40), category: "water", difficulty: "easy", location: "River bank", lat: null, lng: null,
      date: "2026-12-01T09:00", deadline: "2026-12-02T09:00", duration: 60, capacity: 10, requirements: "", safety: "Wear gloves.", equipment: "", impactLabel: "", impactAmount: 0 };
    expect(missionSchema.safeParse(m).success).toBe(false);
    expect(missionSchema.safeParse({ ...m, deadline: "2026-11-30T09:00" }).success).toBe(true);
  });
});

describe("certificate codes", () => {
  it("are unique and well-formed", () => {
    const codes = new Set(Array.from({ length: 500 }, makeVerificationCode));
    expect(codes.size).toBe(500);
    for (const c of codes) expect(c).toMatch(CODE_PATTERN);
  });
});
