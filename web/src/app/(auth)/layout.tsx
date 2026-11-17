import { Logo } from "@/components/brand";
import { ThemeToggle } from "@/components/theme";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex h-16 items-center justify-between px-4 sm:px-6"><Logo /><ThemeToggle /></header>
      <main id="main" className="mx-auto w-full max-w-md flex-1 px-4 pb-16 pt-6">{children}</main>
    </div>
  );
}
