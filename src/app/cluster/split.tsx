"use client";
import { useState, useTransition } from "react";
import { Loader2, Split } from "lucide-react";
import { planClusterSplit } from "@/app/actions";
import { btn, Card, cx } from "@/components/ui";

type Result = Awaited<ReturnType<typeof planClusterSplit>>;

export default function SplitTool({ clusterId, categories }: { clusterId: string; categories: { name: string; makers: number }[] }) {
  const [category, setCategory] = useState(categories[0]?.name ?? "");
  const [qty, setQty] = useState(400);
  const [date, setDate] = useState(() => new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10));
  const [r, setR] = useState<Result | null>(null);
  const [pending, start] = useTransition();
  const max = r ? Math.max(...r.rows.map((x) => x.capacityByDate), 1) : 1;

  return (
    <Card className="mt-3">
      <div className="grid gap-2 md:grid-cols-4">
        <select value={category} onChange={(e) => setCategory(e.target.value)} className="rounded-lg border border-line px-2 py-2 text-sm md:col-span-2">
          {categories.map((c) => <option key={c.name} value={c.name}>{c.name} ({c.makers} makers)</option>)}
        </select>
        <input type="number" value={qty} onChange={(e) => setQty(Number(e.target.value))} className="rounded-lg border border-line px-2 py-2 text-sm" aria-label="Quantity" />
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="rounded-lg border border-line px-2 py-2 text-sm" aria-label="Due date" />
      </div>
      <button className={cx(btn.primary, "mt-3 w-full")} disabled={pending} onClick={() => start(async () => setR(await planClusterSplit(clusterId, category, qty, date)))}>
        {pending ? <Loader2 size={16} className="animate-spin" /> : <Split size={16} />} Split {qty} pieces across the cluster
      </button>
      {r && (
        <div className="mt-4">
          <div className={cx("rounded-xl p-3 text-sm font-semibold", r.covered >= r.qty ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800")}>
            {r.covered >= r.qty ? `All ${r.qty} covered by ${r.rows.filter((x) => x.assigned).length} makers.` : `${r.covered} of ${r.qty} possible by this date (cluster capacity ${r.totalCapacity}). Pick a later date for the rest.`}
          </div>
          <div className="mt-3 space-y-2">
            {r.rows.map((x) => (
              <div key={x.producerId} className="text-sm">
                <div className="flex justify-between"><span className="font-medium">{x.producerName} <span className="text-xs text-muted">· {x.machines} looms</span></span><span><b>{x.assigned}</b> <span className="text-xs text-muted">/ {x.capacityByDate} free</span></span></div>
                <div className="relative mt-1 h-2.5 rounded-full bg-stone-100">
                  <div className="absolute h-full rounded-full bg-stone-300" style={{ width: `${(x.capacityByDate / max) * 100}%` }} />
                  <div className="absolute h-full rounded-full bg-brand" style={{ width: `${(x.assigned / max) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
