"use client";
import { motion } from "framer-motion";
import { Calendar, Clock, MapPin, Sparkles, Users } from "lucide-react";
import Link from "next/link";
import { Badge, ProgressBar } from "./ui";
import type { Mission } from "@/lib/domain/types";
import { CATEGORY_LABEL, DIFFICULTY_LABEL, fmtDate, fmtDuration } from "@/lib/format";
import { lift, stagger } from "@/lib/motion";

export function MissionCard({ mission, organizationName, index = 0, href }: { mission: Mission; organizationName?: string; index?: number; href?: string }) {
  const left = mission.capacity - mission.participantsCount;
  return (
    <motion.article {...stagger(index)} whileHover={lift} className="h-full">
      <Link
        href={href ?? `/missions/${mission.id}`}
        className="group flex h-full flex-col rounded-lg border border-border bg-surface p-5 shadow-low transition-shadow duration-200 hover:shadow-med"
      >
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="info">{CATEGORY_LABEL[mission.category]}</Badge>
          <Badge>{DIFFICULTY_LABEL[mission.difficulty]}</Badge>
          {mission.featured && <Badge tone="reward"><Sparkles className="size-3" aria-hidden /> Featured</Badge>}
        </div>
        <h3 className="t-h3 mt-3 text-balance group-hover:underline underline-offset-4">{mission.title}</h3>
        {organizationName && <p className="t-small mt-0.5 text-muted">{organizationName}</p>}
        <ul className="t-small mt-4 space-y-1.5 text-muted">
          <li className="flex items-center gap-2"><Calendar className="size-4 shrink-0" aria-hidden /> {fmtDate(mission.date)}</li>
          <li className="flex items-center gap-2"><MapPin className="size-4 shrink-0" aria-hidden /> <span className="truncate">{mission.location}</span></li>
          <li className="flex items-center gap-2"><Clock className="size-4 shrink-0" aria-hidden /> {fmtDuration(mission.duration)}</li>
        </ul>
        <div className="mt-auto pt-5">
          <div className="mb-1.5 flex items-center justify-between t-small">
            <span className="inline-flex items-center gap-1.5 text-muted"><Users className="size-4" aria-hidden /> {left > 0 ? `${left} spots left` : "Full"}</span>
            <Badge tone="reward">+{mission.rewardXP} XP</Badge>
          </div>
          <ProgressBar value={mission.participantsCount / mission.capacity} label="Spots filled" tone="success" />
        </div>
      </Link>
    </motion.article>
  );
}
