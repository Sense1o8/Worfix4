import type { AchievementState } from "./achievements";

export interface AdviceInput {
  emailVerified: boolean;
  profileComplete: boolean;
  approvedMissions: number;
  activeMissions: number;
  needsEvidence: number; // joined missions that already started and still have no evidence
  needsMoreInfo: number; // submissions where the reviewer asked for more info
  streak: number;
  lastApprovedDay: string | null;
  today: string; // YYYY-MM-DD
  friends: number;
  pendingFriendRequests: number;
  nearbyOpenMissions: number; // open missions in the user's province/city
  topCategory: string | null;
  untriedCategory: string | null;
  nextAchievement: AchievementState | null;
  friendsRank: number | null; // 1-based rank among friends by XP, null without friends
  xpToNextFriend: number | null;
}

export interface Advice {
  id: string;
  tone: "action" | "tip" | "social" | "celebrate";
  title: string;
  body: string;
  href: string;
  cta: string;
}

/** Deterministic, explainable advice — ordered by how much each step unblocks the volunteer. */
export function buildAdvice(i: AdviceInput): Advice[] {
  const out: Advice[] = [];
  if (i.needsMoreInfo > 0)
    out.push({ id: "more_info", tone: "action", title: "A reviewer asked you for more info", body: "Add the missing photos or notes so your work can be approved and rewarded.", href: "/app/missions", cta: "Open my missions" });
  if (i.needsEvidence > 0)
    out.push({ id: "evidence", tone: "action", title: `Upload evidence for ${i.needsEvidence} mission${i.needsEvidence > 1 ? "s" : ""}`, body: "The mission has started. Photos taken on the day are approved fastest.", href: "/app/missions", cta: "Add evidence" });
  if (!i.emailVerified)
    out.push({ id: "verify", tone: "action", title: "Verify your email", body: "You need a verified email before you can join missions.", href: "/app", cta: "Verify now" });
  if (i.pendingFriendRequests > 0)
    out.push({ id: "requests", tone: "social", title: `${i.pendingFriendRequests} friend request${i.pendingFriendRequests > 1 ? "s" : ""} waiting`, body: "Accept to compare progress and see each other's work in the feed.", href: "/app/friends", cta: "See requests" });
  if (i.streak > 0 && i.lastApprovedDay && i.lastApprovedDay !== i.today)
    out.push({ id: "streak", tone: "tip", title: `Keep your ${i.streak}-day streak alive`, body: `Your streak adds +${Math.min(i.streak * 5, 25)}% XP to the next approved mission. Another approval today or tomorrow keeps it going.`, href: "/missions", cta: "Find a mission" });
  if (i.approvedMissions === 0 && i.activeMissions === 0)
    out.push({ id: "first", tone: "tip", title: "Start with an easy mission", body: "Easy missions take about two hours and are the quickest way to your first XP and certificate.", href: "/missions", cta: "Browse missions" });
  if (i.nearbyOpenMissions > 0)
    out.push({ id: "nearby", tone: "tip", title: `${i.nearbyOpenMissions} open mission${i.nearbyOpenMissions > 1 ? "s" : ""} in your area`, body: "Missions close to home are easier to attend and easier to prove.", href: "/missions", cta: "See what's near" });
  if (i.nextAchievement && i.nextAchievement.fraction >= 0.5)
    out.push({ id: "achievement", tone: "celebrate", title: `Almost there: "${i.nextAchievement.title}"`, body: `${i.nextAchievement.description} You're at ${i.nextAchievement.current} of ${i.nextAchievement.goal}.`, href: "/app/profile?tab=achievements", cta: "View achievements" });
  if (i.friendsRank && i.friendsRank > 1 && i.xpToNextFriend)
    out.push({ id: "rank", tone: "social", title: `You're #${i.friendsRank} among your friends`, body: `${i.xpToNextFriend.toLocaleString()} more XP moves you up one place.`, href: "/app/friends", cta: "Open leaderboard" });
  if (i.friends === 0)
    out.push({ id: "friends", tone: "social", title: "Volunteer with friends", body: "People who add friends complete more missions. Find people from your city.", href: "/app/friends", cta: "Find friends" });
  if (i.untriedCategory && i.approvedMissions >= 2)
    out.push({ id: "variety", tone: "tip", title: `Try a ${i.untriedCategory} mission`, body: `Most of your work is in ${i.topCategory ?? "one cause"}. A new cause counts toward the "Cause explorer" achievement.`, href: "/missions", cta: "Explore causes" });
  if (!i.profileComplete)
    out.push({ id: "profile", tone: "tip", title: "Finish your profile", body: "A photo, bio, location and skills help organizers accept you faster.", href: "/app/profile", cta: "Edit profile" });
  return out.slice(0, 4);
}
