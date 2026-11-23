import Link from "next/link";
import { notFound } from "next/navigation";
import { Check } from "lucide-react";
import { db } from "@/lib/db";
import { currentBuyer } from "@/lib/session";
import { inr, longDate } from "@/lib/format";
import { cx, btn } from "@/components/ui";
import { Chat } from "@/app/app/orders/[code]/parts";

const STEPS = [
  { key: "QUOTED", label: "Requested" },
  { key: "IN_PRODUCTION", label: "Accepted & in production" },
  { key: "DISPATCHED", label: "Dispatched" },
  { key: "DELIVERED", label: "Delivered" },
];

export default async function BuyerOrder({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const buyer = await currentBuyer();
  const o = await db.order.findUnique({ where: { code }, include: { product: true, producer: true, invoices: true, messages: { orderBy: { createdAt: "asc" } } } });
  if (!o || o.buyerId !== buyer.id) notFound();
  const siblings = o.parentId ? await db.order.findMany({ where: { parentId: o.parentId }, include: { producer: true } }) : [];
  const idx = o.status === "DECLINED" ? -1 : Math.max(0, STEPS.findIndex((s) => s.key === (o.status === "CONFIRMED" ? "IN_PRODUCTION" : o.status)));

  return (
    <main className="mx-auto max-w-4xl px-5 py-10">
      <Link href="/market/orders" className="text-sm text-muted">← My orders</Link>
      <h1 className="font-display mt-2 text-3xl font-bold">{o.qty} × {o.product.name}</h1>
      <p className="text-sm text-muted">{o.code} · from {o.producer.name}, {o.producer.businessName} · {inr(o.qty * o.rate)} + GST</p>

      {o.status === "DECLINED" ? (
        <div className="mt-6 rounded-xl bg-stone-100 p-4 text-sm">The maker declined this request.</div>
      ) : (
        <ol className="mt-6 grid gap-2 md:grid-cols-4">
          {STEPS.map((s, i) => (
            <li key={s.key} className={cx("rounded-xl border p-3 text-sm", i <= idx ? "border-teal bg-teal-soft text-teal" : "border-line text-muted")}>
              <div className="flex items-center gap-1.5 font-semibold">{i <= idx ? <Check size={16} /> : <span className="h-4 w-4 rounded-full border" />} {s.label}</div>
            </li>
          ))}
        </ol>
      )}

      <div className="mt-4 grid gap-3 text-sm md:grid-cols-3">
        <div className="rounded-xl bg-paper p-3"><div className="text-xs text-muted">Needed by</div><div className="font-semibold">{longDate(o.wantedBy)}</div></div>
        <div className="rounded-xl bg-paper p-3"><div className="text-xs text-muted">Promised by that date</div><div className="font-semibold">{o.promisedQtyByWanted ?? "-"} pcs</div></div>
        <div className="rounded-xl bg-paper p-3"><div className="text-xs text-muted">Full quantity by</div><div className="font-semibold">{longDate(o.fullDate)}</div></div>
      </div>

      {siblings.length > 1 && (
        <div className="mt-4 rounded-xl border border-line p-4 text-sm">
          <div className="font-semibold">Cluster order {o.parentId}: {siblings.reduce((a, s) => a + s.qty, 0)} pieces from {siblings.length} makers</div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {siblings.map((s) => <Link key={s.id} href={`/market/orders/${s.code}`} className={cx("rounded-full px-2.5 py-1 text-xs", s.id === o.id ? "bg-ink text-white" : "bg-paper")}>{s.producer.name}: {s.qty}</Link>)}
          </div>
        </div>
      )}

      {o.invoices.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {o.invoices.map((i) => <Link key={i.id} href={`/invoice/${encodeURIComponent(i.number)}`} className={btn.small}>{i.kind === "TAX" ? "Tax invoice" : "Proforma"} {i.number}</Link>)}
        </div>
      )}

      <h2 className="mt-8 font-bold">Messages with {o.producer.name}</h2>
      <p className="mb-2 text-xs text-muted">You write in English; {o.producer.name.split(" ")[0]} reads and replies in Hindi. Sutra translates both ways.</p>
      <Chat lang="en" as="BUYER" code={o.code} messages={o.messages.map((m) => ({ id: m.id, sender: m.sender, text: m.textEn ?? m.text, original: m.text, at: m.createdAt.toISOString() }))} />
    </main>
  );
}
