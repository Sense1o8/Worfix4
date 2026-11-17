/**
 * WORFIX domain types. Timestamps are ISO-8601 strings at the domain boundary;
 * the Firestore adapter converts to/from Firestore Timestamps.
 * Fields beyond the PRD's Part 9 list are marked "EXTRA" with the reason.
 */

export const ROLES = ["volunteer", "organization", "company", "admin", "super_admin"] as const;
export type Role = (typeof ROLES)[number];

export const USER_STATUSES = ["active", "suspended", "deleted"] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export const CATEGORIES = ["environment", "community", "animals", "education", "water", "recycling"] as const;
export type Category = (typeof CATEGORIES)[number];

export const DIFFICULTIES = ["easy", "medium", "hard"] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

export const MISSION_STATUSES = ["draft", "pending_review", "published", "closed", "cancelled"] as const;
export type MissionStatus = (typeof MISSION_STATUSES)[number];

export const PARTICIPANT_STATUSES = ["pending", "accepted", "rejected", "withdrawn"] as const;
export type ParticipantStatus = (typeof PARTICIPANT_STATUSES)[number];

export const VERIFICATION_STATUSES = ["pending", "approved", "rejected", "needs_more_info"] as const;
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

export const ORG_VERIFICATION_STATUSES = ["pending", "approved", "rejected"] as const;
export type OrgVerificationStatus = (typeof ORG_VERIFICATION_STATUSES)[number];

export interface ImpactMetric {
  label: string; // e.g. "trees planted"
  amountPerVolunteer: number;
}

export interface UserProfile {
  id: string;
  email: string;
  emailVerified: boolean; // EXTRA: gate for joining missions
  fullName: string;
  username: string;
  avatar: string | null;
  bio: string;
  country: string;
  province: string; // EXTRA: province/state/region inside the country ("" when the country has none)
  city: string;
  languages: string[];
  skills: string[];
  interests: Category[];
  feedVisible: boolean; // EXTRA: consent to show approved work in the community feed
  level: number;
  xp: number;
  points: number; // EXTRA: PRD distinguishes XP from "reward points"
  trustScore: number; // server-only; never shown to the owner
  reputation: number;
  streak: number;
  lastApprovedDay: string | null; // EXTRA: needed to compute streak
  totalVolunteerHours: number;
  totalImpact: number;
  impact: Record<string, number>; // EXTRA: per-label breakdown behind totalImpact
  onboarded: boolean; // EXTRA: onboarding flow state
  organizationId: string | null; // EXTRA: links organization role to its org
  role: Role;
  status: UserStatus;
  createdAt: string;
  updatedAt: string;
  lastLogin: string | null;
}

export interface Organization {
  id: string;
  name: string;
  logo: string | null;
  description: string;
  website: string;
  email: string;
  phone: string;
  address: string;
  country: string;
  city: string;
  organizationType: string;
  verificationStatus: OrgVerificationStatus;
  verificationNote: string; // EXTRA: reason shown on rejection
  ownerId: string;
  members: string[];
  rating: number;
  totalVolunteers: number;
  totalMissions: number;
  createdAt: string;
}

export interface Mission {
  id: string;
  organizationId: string;
  title: string;
  description: string;
  category: Category;
  difficulty: Difficulty;
  rewardXP: number; // computed server-side from difficulty+duration
  rewardPoints: number;
  location: string;
  coordinates: { lat: number; lng: number } | null;
  date: string; // ISO start
  deadline: string; // EXTRA: PRD mission details list "Deadline"
  duration: number; // minutes
  capacity: number;
  participantsCount: number;
  status: MissionStatus;
  featured: boolean;
  requirements: string; // EXTRA: PRD mission details list "Requirements"
  safety: string; // EXTRA: PRD 5.6 required "Safety Instructions"
  equipment: string; // EXTRA: PRD 5.6 required "Required Equipment"
  impactMetrics: ImpactMetric[];
  moderationNote: string; // admin-only
  isDemo: boolean; // EXTRA: seed data must be labelled demonstration data
  createdAt: string;
  updatedAt: string;
}

export interface MissionParticipant {
  id: string; // `${missionId}_${userId}` => one join per user per mission
  missionId: string;
  userId: string;
  joinedAt: string;
  status: ParticipantStatus;
  attendance: boolean;
  completionStatus: "joined" | "submitted" | "completed";
}

export interface Evidence {
  kind: "image";
  dataUrl: string; // dev store; Firebase adapter stores a Storage path here
  sha256: string; // EXTRA: duplicate detection
  name: string;
  size: number;
}

export interface Submission {
  id: string;
  missionId: string;
  userId: string;
  organizationId: string; // EXTRA: denormalised for org-scoped queries/rules
  images: Evidence[];
  videos: Evidence[];
  notes: string;
  gps: { lat: number; lng: number; accuracy: number } | null;
  gpsConsent: boolean; // EXTRA: consent record
  timestamp: string;
  metadata: { userAgent: string; submissionCount: number };
  aiConfidence: number | null; // Phase 3; null = not analysed
  fraudScore: number; // 0..1 server-only
  fraudFlags: string[]; // server-only
  verificationStatus: VerificationStatus;
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewNote: string; // visible to volunteer (reason / info request)
  rewardGrantedAt: string | null; // EXTRA: idempotency guard
  certificateId: string | null;
}

export interface VerificationRecord {
  id: string;
  submissionId: string;
  reviewerId: string;
  reviewerRole: Role;
  decision: VerificationStatus;
  note: string;
  createdAt: string;
}

export interface Certificate {
  id: string;
  userId: string;
  missionId: string;
  organizationId: string;
  certificateType: "mission";
  qrCode: string; // payload URL
  verificationCode: string;
  issuedAt: string;
  pdfUrl: string | null; // PDF generation: future
  // EXTRA: snapshot so a certificate verifies even if profile/mission later change
  holderName: string;
  missionTitle: string;
  organizationName: string;
  hours: number;
  xp: number;
}

export interface Notification {
  id: string;
  userId: string;
  type: "submission" | "mission" | "organization" | "reward" | "system";
  title: string;
  message: string;
  link: string | null;
  read: boolean;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  actor: string;
  actorRole: Role | "system";
  action: string;
  resource: string;
  resourceId: string;
  timestamp: string;
  detail: string;
  ipAddress: string | null; // captured server-side in Firebase; null in local dev
  device: string | null;
}

/** EXTRA (community): friend request / friendship between two volunteers. id = `${from}_${to}`. */
export interface Friendship {
  id: string;
  from: string;
  to: string;
  status: "pending" | "accepted";
  createdAt: string;
}

/** EXTRA (community): one "cheer" from a user on an approved submission in the feed. id = `${submissionId}_${userId}`. */
export interface Cheer {
  id: string;
  submissionId: string;
  userId: string;
  createdAt: string;
}
