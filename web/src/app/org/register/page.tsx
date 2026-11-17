"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Card, Input, PageHeader, Textarea } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { api, ValidationError } from "@/lib/store/api";

const ORG_TYPES = ["NGO", "School or university", "Community group", "Company", "Government body", "Other"];

export default function RegisterOrganization() {
  const router = useRouter();
  const toast = useToast();
  const [v, setV] = useState({ name: "", description: "", organizationType: "NGO", website: "", email: "", phone: "", address: "", country: "", city: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setV({ ...v, [k]: e.target.value });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    try {
      await api.registerOrganization(v);
      toast.success("Submitted. Our team will review your organization.");
      router.replace("/org");
    } catch (err) {
      if (err instanceof ValidationError) { setErrors(err.fields); toast.error("Check the highlighted fields."); }
      else toast.error((err as Error).message);
      setBusy(false);
    }
  };
  return (
    <div className="max-w-2xl">
      <PageHeader title="Register your organization" subtitle="We review every organization before it can publish missions. This usually protects volunteers and your reputation." />
      <Card className="p-6">
        <form onSubmit={submit} noValidate className="space-y-4">
          <Input label="Organization name" required value={v.name} error={errors.name} onChange={set("name")} />
          <Input label="Type of organization" required value={v.organizationType} error={errors.organizationType} onChange={set("organizationType")} list="org-types" hint="e.g. NGO, school, community group" />
          <datalist id="org-types">{ORG_TYPES.map((t) => <option key={t} value={t} />)}</datalist>
          <Textarea label="What does your organization do?" required rows={4} value={v.description} error={errors.description} onChange={set("description")} hint="30+ characters. Shown publicly once approved." />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Contact email" type="email" required value={v.email} error={errors.email} onChange={set("email")} />
            <Input label="Phone (optional)" type="tel" value={v.phone} error={errors.phone} onChange={set("phone")} />
            <Input label="Website (optional)" type="url" value={v.website} error={errors.website} onChange={set("website")} placeholder="https://" />
            <Input label="Address" required value={v.address} error={errors.address} onChange={set("address")} />
            <Input label="Country" required value={v.country} error={errors.country} onChange={set("country")} />
            <Input label="City" required value={v.city} error={errors.city} onChange={set("city")} />
          </div>
          <Button type="submit" size="lg" loading={busy}>Submit for approval</Button>
        </form>
      </Card>
    </div>
  );
}
