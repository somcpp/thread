import Link from "next/link";
import { notFound } from "next/navigation";
import { BadgeCheck, MapPin, ShieldCheck, Clock, Package } from "lucide-react";
import { db } from "@/lib/db";
import { inr, daysAheadISO } from "@/lib/format";
import { validateGstin } from "@/lib/gst";
import { industryOf } from "@/lib/industries";
import { weeklyCapacity } from "@/lib/market";
import { Avatar, ProductArt } from "@/components/ui";
import QuoteBox from "./quote";

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const p = await db.product.findUnique({ where: { slug }, include: { producer: { include: { cluster: true } } } });
  if (!p) notFound();
  const maker = p.producer;
  const ind = industryOf(maker.cluster.industry);
  const more = await db.product.findMany({ where: { producerId: maker.id, id: { not: p.id } }, take: 4 });
  const gst = validateGstin(maker.gstin);
  const defaultDate = daysAheadISO(22);

  return (
    <main className="mx-auto max-w-6xl px-5 py-8">
      <div className="mb-4 text-sm text-muted">
        <Link href="/market">Market</Link> / <Link href={`/market?c=${maker.cluster.slug}`}>{maker.cluster.name}</Link> / {p.category}
      </div>
      <div className="grid gap-10 md:grid-cols-[1fr_1.05fr]">
        <div>
          <div className="aspect-square overflow-hidden rounded-3xl bg-paper">
            <ProductArt palette={p.palette} imageUrl={p.imageUrl} seed={p.name.length} label={p.name} />
          </div>
          <div className="mt-5 rounded-2xl border border-line p-5">
            <div className="flex items-center gap-3">
              <Avatar name={maker.name} color={maker.avatarColor} size={48} />
              <div>
                <Link href={`/market/maker/${maker.slug}`} className="font-bold hover:underline">{maker.name}</Link>
                <div className="flex items-center gap-1 text-xs text-muted"><MapPin size={12} /> {maker.businessName}, {maker.city}, {maker.state}</div>
              </div>
            </div>
            <p className="mt-3 text-sm text-muted">{maker.story}</p>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
              <Trust icon={<ShieldCheck size={16} />} k={gst.valid ? "GST verified" : "Unregistered"} v={gst.valid ? maker.gstin!.slice(0, 2) + "•••" + maker.gstin!.slice(-3) : "B2C only"} />
              <Trust icon={<Clock size={16} />} k="On-time" v={`${Math.round(maker.onTimeRate * 100)}%`} />
              <Trust icon={<Package size={16} />} k="Orders done" v={String(maker.ordersDone)} />
            </div>
          </div>
        </div>

        <div>
          <div className="text-xs font-semibold uppercase tracking-widest text-teal">{ind.emoji} {p.category}</div>
          <h1 className="font-display mt-1 text-3xl font-bold leading-tight">{p.name}</h1>
          <div className="mt-1 flex items-center gap-1 text-sm text-muted"><BadgeCheck size={15} className="text-teal" /> Made by {maker.name} in {maker.cluster.city}</div>
          <div className="mt-4 flex items-baseline gap-3">
            <span className="text-3xl font-bold">{inr(p.price)}</span>
            <span className="text-sm text-muted">per piece + {p.gstRate}% GST · HSN {p.hsn}</span>
          </div>
          <div className="text-xs text-muted">Typical retail price {inr(p.mrp)}</div>
          <p className="mt-5 leading-relaxed text-ink/90">{p.story}</p>
          <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl bg-paper p-3"><div className="text-xs text-muted">Ready to ship</div><div className="text-lg font-bold">{p.stock} pcs</div></div>
            <div className="rounded-xl bg-paper p-3"><div className="text-xs text-muted">Can make</div><div className="text-lg font-bold">~{weeklyCapacity(p, maker.machines)} / week</div><div className="text-[11px] text-muted">{maker.machines} {ind.machine}s</div></div>
          </div>
          <QuoteBox productId={p.id} defaultQty={p.category.includes("Saree") ? 200 : 100} defaultDate={defaultDate} price={p.price} gstRate={p.gstRate} makerName={maker.name.split(" ")[0]} />
        </div>
      </div>

      {more.length > 0 && (
        <section className="mt-14">
          <h2 className="text-lg font-bold">More from {maker.name}</h2>
          <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">
            {more.map((x, i) => (
              <Link key={x.id} href={`/market/p/${x.slug}`}>
                <div className="aspect-square overflow-hidden rounded-2xl"><ProductArt palette={x.palette} imageUrl={x.imageUrl} seed={i + 1} label={x.name} /></div>
                <div className="mt-2 line-clamp-1 text-sm font-semibold">{x.name}</div>
                <div className="text-sm">{inr(x.price)}</div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}

function Trust({ icon, k, v }: { icon: React.ReactNode; k: string; v: string }) {
  return (
    <div className="rounded-xl bg-paper p-2.5">
      <div className="mx-auto mb-1 w-fit text-teal">{icon}</div>
      <div className="font-bold">{v}</div>
      <div className="text-muted">{k}</div>
    </div>
  );
}
