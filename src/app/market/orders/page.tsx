import Link from "next/link";
import { db } from "@/lib/db";
import { currentBuyer } from "@/lib/session";
import { inr, shortDate } from "@/lib/format";
import { Badge, ProductArt, STATUS_LABEL } from "@/components/ui";

export default async function BuyerOrders() {
  const buyer = await currentBuyer();
  const orders = await db.order.findMany({ where: { buyerId: buyer.id }, include: { product: true, producer: true }, orderBy: { createdAt: "desc" }, take: 30 });
  return (
    <main className="mx-auto max-w-4xl px-5 py-10">
      <h1 className="font-display text-3xl font-bold">My orders</h1>
      <p className="text-sm text-muted">{buyer.business}, {buyer.city} · {buyer.name}</p>
      <div className="mt-6 divide-y divide-line rounded-2xl border border-line">
        {orders.map((o, i) => {
          const s = STATUS_LABEL[o.status];
          return (
            <Link key={o.id} href={`/market/orders/${o.code}`} className="flex items-center gap-4 p-4 hover:bg-paper">
              <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl"><ProductArt palette={o.product.palette} imageUrl={o.product.imageUrl} seed={i} /></div>
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold">{o.qty} × {o.product.name}</div>
                <div className="text-xs text-muted">{o.code} · {o.producer.name}, {o.producer.city}{o.parentId ? ` · cluster order ${o.parentId}` : ""}</div>
              </div>
              <div className="text-right">
                <Badge tone={s.tone}>{s.en}</Badge>
                <div className="mt-1 text-xs text-muted">{inr(o.qty * o.rate)} · {o.wantedBy ? `due ${shortDate(o.wantedBy)}` : ""}</div>
              </div>
            </Link>
          );
        })}
      </div>
    </main>
  );
}
