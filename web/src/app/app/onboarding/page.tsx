"use client";
import { useRouter } from "next/navigation";
import { ProfileForm } from "@/components/profile-form";
import { useMe } from "@/components/shells";
import { Card, LoadingBlock } from "@/components/ui";

export default function Onboarding() {
  const me = useMe();
  const router = useRouter();
  if (!me.data) return <LoadingBlock />;
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="t-h1">Welcome to WORFIX</h1>
      <p className="t-sub mt-1 mb-6">Tell us a little about you so we can show missions that fit. You can change everything later.</p>
      <Card className="p-6"><ProfileForm user={me.data} onboarding onSaved={() => router.replace("/app")} /></Card>
    </div>
  );
}
