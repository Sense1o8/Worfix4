"use client";
import { Search } from "lucide-react";
import { useDeferredValue, useState } from "react";
import { MissionCard } from "@/components/mission-card";
import { ButtonLink, EmptyState, ErrorState, Input, LoadingBlock, PageHeader, Select } from "@/components/ui";
import { CATEGORIES } from "@/lib/domain/types";
import { CATEGORY_LABEL } from "@/lib/format";
import { api } from "@/lib/store/api";
import { useApi } from "@/lib/store/hooks";

export default function MissionsPage() {
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("all");
  const dq = useDeferredValue(q);
  const missions = useApi(() => api.listMissions({ scope: "public", q: dq, category }), [dq, category]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <PageHeader title="Explore missions" subtitle="Real missions from approved organizations. Pick one that fits your time and your cause." />
      <form role="search" onSubmit={(e) => e.preventDefault()} className="mb-8 grid gap-3 sm:grid-cols-[1fr_220px]">
        <div className="relative">
          <Input label="Search missions" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Trees, river, library…" className="pl-10" />
          <Search className="pointer-events-none absolute bottom-3 left-3 size-5 text-muted" aria-hidden />
        </div>
        <Select label="Cause" value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="all">All causes</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
        </Select>
      </form>

      <div aria-live="polite">
        {missions.error ? <ErrorState error={missions.error} onRetry={missions.reload} />
          : !missions.data ? <LoadingBlock />
          : missions.data.length === 0 ? (
            <EmptyState title="No missions match" body="Try a different cause or clear the search. New missions are published regularly." action={<ButtonLink href="/missions" variant="secondary" onClick={() => { setQ(""); setCategory("all"); }}>Clear filters</ButtonLink>} />
          ) : (
            <>
              <p className="mb-4 t-small text-muted">{missions.data.length} {missions.data.length === 1 ? "mission" : "missions"}</p>
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {missions.data.map((m, i) => <MissionCard key={m.id} mission={m} organizationName={m.organizationName} index={i} />)}
              </div>
            </>
          )}
      </div>
    </div>
  );
}
