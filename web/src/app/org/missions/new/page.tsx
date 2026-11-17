"use client";
import { Card, PageHeader } from "@/components/ui";
import { MissionForm } from "@/components/mission-form";

export default function NewMission() {
  return (
    <div className="max-w-2xl">
      <PageHeader title="New mission" subtitle="Saved as a draft first. Publish when you're ready." />
      <Card className="p-6"><MissionForm /></Card>
    </div>
  );
}
