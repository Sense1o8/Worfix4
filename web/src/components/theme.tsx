"use client";
import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

/** Runs before paint (inlined in <head>) so there is no light→dark flash. */
export const themeInitScript = `(function(){try{var t=localStorage.getItem('worfix.theme');if(!t){t=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}document.documentElement.dataset.theme=t}catch(e){}})()`;

export function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark" | null>(null);
  useEffect(() => setTheme((document.documentElement.dataset.theme as "light" | "dark") ?? "light"), []);
  const next = theme === "dark" ? "light" : "dark";
  return (
    <button
      type="button"
      aria-label={theme ? `Switch to ${next} mode` : "Toggle color theme"}
      onClick={() => {
        document.documentElement.dataset.theme = next;
        try { localStorage.setItem("worfix.theme", next); } catch {}
        setTheme(next);
      }}
      className="inline-flex size-11 items-center justify-center rounded-md text-muted transition-[background-color,transform] duration-150 hover:bg-surface-2 hover:text-text active:scale-95"
    >
      {theme === "dark" ? <Sun className="size-5" aria-hidden /> : <Moon className="size-5" aria-hidden />}
    </button>
  );
}
