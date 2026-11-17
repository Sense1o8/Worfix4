"use client";
import { useState } from "react";
import { Badge, Button, Card, ErrorState, Input, LoadingBlock, PageHeader, Textarea } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { api, ValidationError } from "@/lib/store/api";
import { useApi } from "@/lib/store/hooks";

export default function OrgProfile() {
  const org = useApi(() => api.myOrganization());
  if (org.error) return <ErrorState error={org.error} onRetry={org.reload} />;
  if (!org.data) return <LoadingBlock />;
  return <Form key={org.data.id} org={org.data} />;
}

function Form({ org }: { org: NonNullable<Awaited<ReturnType<typeof api.myOrganization>>> }) {
  const toast = useToast();
  const [v, setV] = useState({ name: org.name, description: org.description, organizationType: org.organizationType, website: org.website, email: org.email, phone: org.phone, address: org.address, country: org.country, city: org.city });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setV({ ...v, [k]: e.target.value });
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    try { await api.updateOrganization(v); toast.success("Organization updated."); }
    catch (err) { if (err instanceof ValidationError) { setErrors(err.fields); toast.error("Check the highlighted fields."); } else toast.error((err as Error).message); }
    setBusy(false);
  };
  return (
    <div className="max-w-2xl">
      <PageHeader title="Organization profile" actions={<Badge tone={org.verificationStatus === "approved" ? "success" : org.verificationStatus === "pending" ? "warning" : "danger"}>{org.verificationStatus}</Badge>} />
      <Card className="p-6">
        <form onSubmit={submit} noValidate className="space-y-4">
          <Input label="Organization name" required value={v.name} error={errors.name} onChange={set("name")} />
          <Input label="Type" required value={v.organizationType} error={errors.organizationType} onChange={set("organizationType")} />
          <Textarea label="Description" required rows={4} value={v.description} error={errors.description} onChange={set("description")} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Contact email" type="email" required value={v.email} error={errors.email} onChange={set("email")} />
            <Input label="Phone" type="tel" value={v.phone} error={errors.phone} onChange={set("phone")} />
            <Input label="Website" type="url" value={v.website} error={errors.website} onChange={set("website")} />
            <Input label="Address" required value={v.address} error={errors.address} onChange={set("address")} />
            <Input label="Country" required value={v.country} error={errors.country} onChange={set("country")} />
            <Input label="City" required value={v.city} error={errors.city} onChange={set("city")} />
          </div>
          <Button type="submit" size="lg" loading={busy}>Save changes</Button>
        </form>
      </Card>
    </div>
  );
}
