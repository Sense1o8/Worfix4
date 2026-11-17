"use client";
import { useParams } from "next/navigation";
import { Card, EmptyState, ErrorState, LoadingBlock, PageHeader } from "@/components/ui";
import { MissionForm } from "@/components/mission-form";
import { api } from "@/lib/store/api";
import { useApi } from "@/lib/store/hooks";

export default function EditMission() {
  const { id } = useParams<{ id: string }>();
  const res = useApi(() => api.getMission(id), [id]);
  if (res.error) return <ErrorState error={res.error} onRetry={res.reload} />;
  if (res.loading && !res.data) return <LoadingBlock />;
  if (!res.data) return <EmptyState title="Mission not found" body="It may have been deleted." />;
  return (
    <div className="max-w-2xl">
      <PageHeader title="Edit mission" />
      <Card className="p-6"><MissionForm key={res.data.mission.id} mission={res.data.mission} /></Card>
    </div>
  );
}
