"use client";
import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, CheckCircle2, Info } from "lucide-react";
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { DUR, EASE } from "@/lib/motion";

type Kind = "success" | "error" | "info";
interface T { id: number; kind: Kind; text: string }
interface Ctx { success: (t: string) => void; error: (t: string) => void; info: (t: string) => void }

const ToastCtx = createContext<Ctx | null>(null);
export const useToast = () => {
  const c = useContext(ToastCtx);
  if (!c) throw new Error("useToast outside provider");
  return c;
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<T[]>([]);
  const n = useRef(0);
  const push = useCallback((kind: Kind, text: string) => {
    const id = ++n.current;
    setItems((x) => [...x.slice(-3), { id, kind, text }]);
    setTimeout(() => setItems((x) => x.filter((t) => t.id !== id)), kind === "error" ? 7000 : 4500);
  }, []);
  const api = useMemo<Ctx>(() => ({ success: (t) => push("success", t), error: (t) => push("error", t), info: (t) => push("info", t) }), [push]);
  const Icon = { success: CheckCircle2, error: AlertCircle, info: Info };
  const color = { success: "text-primary", error: "text-error", info: "text-secondary" };
  return (
    <ToastCtx.Provider value={api}>
      {children}
      <div aria-live="polite" aria-atomic="false" className="pointer-events-none fixed inset-x-4 bottom-20 z-[60] flex flex-col items-center gap-2 md:bottom-6 md:items-end md:right-6 md:left-auto">
        <AnimatePresence initial={false}>
          {items.map((t) => {
            const I = Icon[t.kind];
            return (
              <motion.div
                key={t.id} layout="position" role={t.kind === "error" ? "alert" : "status"}
                initial={{ opacity: 0, y: 12, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1, transition: { duration: DUR.ui, ease: EASE } }}
                exit={{ opacity: 0, transition: { duration: DUR.press } }}
                className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-md border border-border bg-surface p-3.5 shadow-high"
              >
                <I className={`mt-0.5 size-5 shrink-0 ${color[t.kind]}`} aria-hidden />
                <p className="t-small">{t.text}</p>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastCtx.Provider>
  );
}
