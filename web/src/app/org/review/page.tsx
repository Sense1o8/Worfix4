"use client";
import { PageHeader } from "@/components/ui";
import { ReviewQueue } from "@/components/review-queue";

export default function OrgReview() {
  return (
    <div>
      <PageHeader title="Review evidence" subtitle="Approve only what you can see happened. Approval grants rewards once and can't be undone." />
      <ReviewQueue scope="org" />
    </div>
  );
}
