import type { Mission, Submission } from "./types";

/** Great-circle distance in km. */
export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export interface FraudResult {
  score: number; // 0 (clean) .. 1 (very suspicious)
  flags: string[];
}

/**
 * Stage 1 automatic checks from PRD 5.9 (GPS, timestamp, duplicate detection).
 * These raise flags for human reviewers; they never approve or reject anything by themselves.
 */
export function assessSubmission(
  sub: Pick<Submission, "gps" | "images" | "timestamp" | "userId">,
  mission: Pick<Mission, "coordinates" | "date">,
  others: Pick<Submission, "images" | "userId">[],
): FraudResult {
  const flags: string[] = [];
  let score = 0;

  const hashes = new Set(sub.images.map((i) => i.sha256));
  const reused = others.filter((o) => o.images.some((i) => hashes.has(i.sha256)));
  if (reused.some((o) => o.userId !== sub.userId)) {
    flags.push("Same photo already submitted by another volunteer");
    score += 0.6;
  } else if (reused.length > 0) {
    flags.push("Same photo already used in an earlier submission");
    score += 0.4;
  }

  if (Date.parse(sub.timestamp) < Date.parse(mission.date)) {
    flags.push("Submitted before the mission start time");
    score += 0.4;
  }

  if (sub.gps && mission.coordinates) {
    const km = haversineKm(sub.gps, mission.coordinates);
    if (km > 2) {
      flags.push(`GPS is ${km.toFixed(1)} km from the mission location`);
      score += km > 20 ? 0.5 : 0.3;
    }
  } else if (!sub.gps) {
    flags.push("No GPS shared (optional; reviewer judgement)");
    score += 0.05;
  }

  return { score: Math.min(1, Math.round(score * 100) / 100), flags };
}
