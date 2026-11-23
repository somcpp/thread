import Link from "next/link";
import { Users, Factory, ShoppingBag, IndianRupee, ShieldCheck, ShieldAlert, PackageSearch } from "lucide-react";
import { db } from "@/lib/db";
import { currentCluster } from "@/lib/session";
import { materialHealth } from "@/lib/engine";
import { validateGstin } from "@/lib/gst";
import { inr, num, DAY, now } from "@/lib/format";
import { industryOf } from "@/lib/industries";
import { Avatar, Badge, Card, Stat, cx } from "@/components/ui";
import { PrefSelect } from "@/components/client";
import { Logo } from "@/components/logo";
import { ProductionChart, ChannelChart } from "./charts";
import SplitTool from "./split";

export const dynamic = "force-dynamic";

export default async function ClusterPage() {
  const cluster = await currentCluster();
  const ind = industryOf(cluster.industry);
  const [clusters, producers] = await Promise.all([
    db.cluster.findMany(),
    db.producer.findMany({ where: { clusterId: cluster.id }, include: { products: true }, orderBy: { machines: "desc" } }),
  ]);
  const ids = producers.map((p) => p.id);
  const since12w = new Date(now() - 84 * DAY);
  const [movements, orders, purchases, healthAll] = await Promise.all([
    db.stockMovement.findMany({ where: { producerId: { in: ids }, kind: "PRODUCE", createdAt: { gte: since12w } }, select: { qty: true, createdAt: true } }),
    db.order.findMany({ where: { producerId: { in: ids }, status: { not: "DECLINED" } }, include: { producer: true } }),
    db.purchase.findMany({ where: { producerId: { in: ids }, createdAt: { gte: new Date(now() - 90 * DAY) } }, include: { supplier: true } }),
    Promise.all(producers.map(async (p) => ({ p, h: await materialHealth(p.id) }))),
  ]);

  // weekly production
  const weeks = Array.from({ length: 12 }, (_, i) => {
    const end = now() - (11 - i) * 7 * DAY;
    const start = end - 7 * DAY;
    return {
      week: new Date(end).toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
      units: movements.filter((m) => m.createdAt.getTime() > start && m.createdAt.getTime() <= end).reduce((a, m) => a + m.qty, 0),
    };
  });
  // monthly sales by channel
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date();
    const from = new Date(d.getFullYear(), d.getMonth() - (5 - i), 1);
    const to = new Date(d.getFullYear(), d.getMonth() - (4 - i), 1);
    const inMonth = orders.filter((o) => o.createdAt >= from && o.createdAt < to);
    const val = (ch: string) => Math.round(inMonth.filter((o) => (ch === "AGENT" ? o.channel === "AGENT" : o.channel !== "AGENT")).reduce((a, o) => a + o.qty * o.rate, 0));
    return { month: from.toLocaleDateString("en-IN", { month: "short" }), agent: val("AGENT"), direct: val("DIRECT") };
  });

  const looms = producers.reduce((a, p) => a + p.machines, 0);
  const openOrders = orders.filter((o) => ["QUOTED", "CONFIRMED", "IN_PRODUCTION"].includes(o.status));
  const direct = orders.filter((o) => o.channel === "MARKETPLACE");
  const saved = direct.reduce((a, o) => a + (o.qty * o.rate * o.producer.agentCutPct) / 100, 0);
  const directValue = direct.reduce((a, o) => a + o.qty * o.rate, 0);

  // group buying: next 30 days of material need across the cluster
  const byMat = new Map<string, { name: string; unit: string; need: number; stock: number; cost: number; supplier: string; makers: number }>();
  for (const { h } of healthAll)
    for (const m of h) {
      const e = byMat.get(m.name) ?? { name: m.name, unit: m.unit, need: 0, stock: 0, cost: m.costPerUnit, supplier: m.supplierName, makers: 0 };
      e.need += m.usagePerDay * 30;
      e.stock += m.stock;
      e.makers += 1;
      byMat.set(m.name, e);
    }
  const groupBuy = [...byMat.values()].map((g) => ({ ...g, toBuy: Math.max(0, g.need - g.stock * 0.5) }));
  const BULK_DISCOUNT = 0.06;

  const badBills = purchases.filter((x) => !x.gstinValid || !validateGstin(x.supplier.gstin).valid);
  const categories = [...new Set(producers.flatMap((p) => p.products.map((x) => x.category)))];
  const catCounts = Object.fromEntries(categories.map((c) => [c, producers.filter((p) => p.products.some((x) => x.category === c)).length]));

  return (
    <div className="min-h-screen bg-paper">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-5 py-3">
          <Link href="/" className="flex items-center gap-2"><Logo /><span className="font-display text-xl font-bold text-brand">Sutra</span></Link>
          <span className="rounded-md bg-ink px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-white">Cluster</span>
          <div className="ml-auto"><PrefSelect name="cluster" value={cluster.slug} options={clusters.map((c) => ({ value: c.slug, label: `${industryOf(c.industry).emoji} ${c.name}` }))} /></div>
        </div>
        <div className="thread" />
      </header>

      <main className="mx-auto max-w-7xl px-5 py-8">
        <div className="text-xs font-semibold uppercase tracking-widest text-teal">{ind.emoji} {ind.name} · {cluster.city}, {cluster.state}</div>
        <h1 className="font-display text-3xl font-bold">{cluster.name}</h1>

        <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-5">
          <Stat label="Makers" value={<span className="flex items-center gap-1.5"><Users size={18} className="text-muted" />{producers.length}</span>} sub={`${looms} ${ind.machine}s in total`} />
          <Stat label="Made, last 4 weeks" value={<span className="flex items-center gap-1.5"><Factory size={18} className="text-muted" />{num(weeks.slice(-4).reduce((a, w) => a + w.units, 0))}</span>} sub="pieces" />
          <Stat label="Open orders" value={<span className="flex items-center gap-1.5"><ShoppingBag size={18} className="text-muted" />{openOrders.length}</span>} sub={`${openOrders.filter((o) => o.status === "QUOTED").length} awaiting reply`} />
          <Stat label="Direct sales on Sutra" value={inr(directValue)} sub={`${direct.length} orders, no agent`} tone="teal" />
          <Stat label="Agent commission kept" value={<span className="flex items-center gap-1"><IndianRupee size={18} />{Math.round(saved).toLocaleString("en-IN")}</span>} sub="stays with the makers" tone="brand" />
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <Card><div className="mb-2 font-bold">Weekly production (pieces)</div><ProductionChart data={weeks} /></Card>
          <Card><div className="mb-2 font-bold">Sales: through agents vs direct on Sutra (₹)</div><ChannelChart data={months} /></Card>
        </div>

        <h2 className="mt-8 text-lg font-bold">Makers</h2>
        <Card className="mt-2 overflow-x-auto p-0">
          <table className="w-full min-w-[760px] text-sm">
            <thead><tr className="border-b border-line bg-paper text-left text-xs uppercase text-muted">
              <th className="p-3">Maker</th><th className="p-3">{ind.machine}s</th><th className="p-3">Raw material</th><th className="p-3">Open orders</th><th className="p-3">On time</th><th className="p-3">GST</th>
            </tr></thead>
            <tbody>
              {healthAll.map(({ p, h }) => {
                const worst = h.some((m) => m.status === "CRITICAL") ? "CRITICAL" : h.some((m) => m.status === "LOW") ? "LOW" : "OK";
                const low = h.filter((m) => m.status !== "OK").map((m) => m.name.split(" ")[0]);
                const g = validateGstin(p.gstin);
                return (
                  <tr key={p.id} className="border-b border-line last:border-0">
                    <td className="p-3"><div className="flex items-center gap-2"><Avatar name={p.name} color={p.avatarColor} size={30} /><div><Link href={`/market/maker/${p.slug}`} className="font-semibold hover:underline">{p.name}</Link><div className="text-xs text-muted">{p.businessName}</div></div></div></td>
                    <td className="p-3">{p.machines}</td>
                    <td className="p-3"><Badge tone={worst === "CRITICAL" ? "red" : worst === "LOW" ? "amber" : "green"}>{worst === "OK" ? "All OK" : `Low: ${low.join(", ")}`}</Badge></td>
                    <td className="p-3">{openOrders.filter((o) => o.producerId === p.id).length}</td>
                    <td className="p-3">{Math.round(p.onTimeRate * 100)}%</td>
                    <td className="p-3">{p.gstin ? (g.valid ? <span className="inline-flex items-center gap-1 text-teal"><ShieldCheck size={15} /> Valid</span> : <span className="text-red-600">Invalid</span>) : <span className="text-muted">Unregistered</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>

        <div className="mt-8 grid gap-4 lg:grid-cols-[1.3fr_1fr]">
          <div>
            <h2 className="text-lg font-bold">Bulk order split</h2>
            <p className="text-sm text-muted">A big buyer wants more than one maker can make. Sutra splits it by each maker&apos;s free capacity.</p>
            <SplitTool clusterId={cluster.id} categories={categories.map((c) => ({ name: c, makers: catCounts[c] }))} />
          </div>
          <div>
            <h2 className="flex items-center gap-2 text-lg font-bold"><PackageSearch size={20} /> Group buying</h2>
            <p className="text-sm text-muted">Raw material the whole cluster needs in the next 30 days. One bulk order instead of {producers.length} small ones.</p>
            <Card className="mt-3 space-y-3">
              {groupBuy.map((g) => (
                <div key={g.name} className="rounded-xl bg-paper p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div><div className="font-semibold">{g.name}</div><div className="text-xs text-muted">{g.makers} makers · {g.supplier}</div></div>
                    <div className="text-right"><div className="font-bold">{num(Math.ceil(g.toBuy))} {g.unit}</div><div className="text-xs text-muted">{inr(g.toBuy * g.cost)}</div></div>
                  </div>
                  <div className="mt-1.5 text-xs text-teal">Bulk price saves ~{inr(g.toBuy * g.cost * BULK_DISCOUNT)} ({BULK_DISCOUNT * 100}% est.)</div>
                </div>
              ))}
            </Card>
          </div>
        </div>

        <h2 className="mt-8 text-lg font-bold">Compliance</h2>
        <div className="mt-2 grid gap-3 md:grid-cols-3">
          <Card><div className="text-xs text-muted">GST-registered makers</div><div className="text-2xl font-bold">{producers.filter((p) => validateGstin(p.gstin).valid).length} / {producers.length}</div><div className="text-xs text-muted">others are below the threshold</div></Card>
          <Card className={cx(badBills.length > 0 && "border-red-200 bg-red-50/50")}>
            <div className="flex items-center gap-1 text-xs text-muted">{badBills.length ? <ShieldAlert size={14} className="text-red-600" /> : <ShieldCheck size={14} className="text-teal" />} Supplier bills with GSTIN errors (90 days)</div>
            <div className="text-2xl font-bold">{badBills.length}</div>
            <div className="text-xs text-muted">{inr(badBills.reduce((a, b) => a + b.cgst + b.sgst + b.igst, 0))} tax credit at risk</div>
          </Card>
          <Card><div className="text-xs text-muted">Supplier bills captured by photo (90 days)</div><div className="text-2xl font-bold">{purchases.length}</div><div className="text-xs text-muted">no manual typing for the CA</div></Card>
        </div>
      </main>
    </div>
  );
}
