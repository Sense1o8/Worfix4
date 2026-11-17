"use client";
import { MotionConfig } from "framer-motion";
import type { ReactNode } from "react";
import { DevBanner } from "./dev-banner";
import { ToastProvider } from "./ui/toast";

/** Global providers: reduced-motion respected everywhere, toasts, and the honest dev-mode banner. */
export function MotionRoot({ children }: { children: ReactNode }) {
  return (
    <MotionConfig reducedMotion="user">
      <ToastProvider>
        <DevBanner />
        {children}
      </ToastProvider>
    </MotionConfig>
  );
}
