"use client";
import { MapPin } from "lucide-react";
import type { ReactNode } from "react";
import { Avatar } from "./ui";
import type { Person } from "@/lib/store/api";

/** One volunteer in a list: avatar, name, place, level — with optional actions on the right. */
export function PersonRow({ p, actions, prefix }: { p: Person; actions?: ReactNode; prefix?: ReactNode }) {
  const place = [p.city, p.province].filter(Boolean).join(", ") || p.country;
  return (
    <div className="flex flex-wrap items-center gap-3">
      {prefix}
      <Avatar name={p.fullName} src={p.avatar} size={44} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">{p.fullName}</p>
        <p className="flex flex-wrap items-center gap-x-2 t-small text-muted">
          <span>Level {p.level} · {p.xp.toLocaleString()} XP</span>
          {place && <span className="inline-flex items-center gap-1"><MapPin className="size-3.5" aria-hidden /> {place}</span>}
        </p>
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
