"use client";
import { motion } from "framer-motion";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { pageVariants } from "@/lib/motion";

/** Keyed by route → one quick fade/rise per navigation, scoped to <main> so fixed/sticky chrome never moves. */
export function PageTransition({ children }: { children: ReactNode }) {
  const path = usePathname();
  return <motion.div key={path} variants={pageVariants} initial="initial" animate="animate">{children}</motion.div>;
}
