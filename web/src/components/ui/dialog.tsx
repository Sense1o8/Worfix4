"use client";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { useEffect, useId, useRef, type KeyboardEvent, type ReactNode } from "react";
import { popIn, DUR, EASE } from "@/lib/motion";

const FOCUSABLE = 'a[href],button:not([disabled]),textarea,input:not([type=hidden]),select,[tabindex]:not([tabindex="-1"])';

/** Accessible modal: focus trap, Esc to close, focus restored to the trigger, scroll locked. */
export function Dialog({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const returnTo = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    returnTo.current = document.activeElement as HTMLElement | null;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const t = setTimeout(() => ref.current?.querySelector<HTMLElement>("[data-autofocus]")?.focus() ?? ref.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus(), 30);
    return () => {
      clearTimeout(t);
      document.body.style.overflow = prev;
      returnTo.current?.focus?.();
    };
  }, [open]);

  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") { e.stopPropagation(); onClose(); return; }
    if (e.key !== "Tab") return;
    const els = Array.from(ref.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []);
    if (!els.length) return;
    const first = els[0], last = els[els.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4" onKeyDown={onKey}>
          <motion.div
            className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden
            initial={{ opacity: 0 }} animate={{ opacity: 1, transition: { duration: DUR.ui, ease: EASE } }} exit={{ opacity: 0, transition: { duration: DUR.press } }}
          />
          <motion.div
            ref={ref} role="dialog" aria-modal="true" aria-labelledby={titleId} {...popIn}
            className="relative max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-t-xl bg-surface p-6 shadow-high sm:rounded-xl"
          >
            <div className="mb-4 flex items-start justify-between gap-4">
              <h2 id={titleId} className="t-h2">{title}</h2>
              <button type="button" onClick={onClose} aria-label="Close dialog" className="-m-2 inline-flex size-11 items-center justify-center rounded-md text-muted hover:bg-surface-2 active:scale-95 transition-transform duration-150">
                <X className="size-5" aria-hidden />
              </button>
            </div>
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
