"use client";
import { PageHeader } from "@/components/ui";
import { ReviewQueue } from "@/components/review-queue";

export default function AdminSubmissions() {
  return (
    <div>
      <PageHeader title="Submission review" subtitle="Admins can review any submission. The Fraud alerts tab lists pending submissions with a high automatic risk score." />
      <ReviewQueue scope="admin" />
    </div>
  );
}
