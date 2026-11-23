import Link from "next/link";
import { notFound } from "next/navigation";
import { MapPin, ShieldCheck } from "lucide-react";
import { db } from "@/lib/db";
import { inr, longDate } from "@/lib/format";
import { validateGstin } from "@/lib/gst";
import { industryOf } from "@/lib/industries";
import { Avatar, ProductArt } from "@/components/ui";

export default async function MakerPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const m = await db.producer.findUnique({ where: { slug }, include: { cluster: true, products: { where: { published: true } } } });
  if (!m) notFound();
  const ind = industryOf(m.cluster.industry);
  const gst = validateGstin(m.gstin);
  return (
    <main className="mx-auto max-w-6xl px-5 py-10">
      <div className="flex flex-col gap-6 rounded-3xl bg-paper p-6 md:flex-row md:items-center">
        <Avatar name={m.name} color={m.avatarColor} size={88} />
        <div className="flex-1">
          <div className="text-xs font-semibold uppercase tracking-widest text-teal">{ind.emoji} {m.cluster.name}</div>
          <h1 className="font-display text-3xl font-bold">{m.name}</h1>
          <div className="flex items-center gap-1 text-sm text-muted"><MapPin size={14} /> {m.businessName}, {m.city}, {m.state} · on Sutra since {longDate(m.joinedAt)}</div>
          <p className="mt-2 max-w-2xl text-sm">{m.story}</p>
        </div>
        <div className="grid grid-cols-2 gap-2 text-center text-sm md:w-64">
          <div className="rounded-xl bg-white p-3"><div className="text-xl font-bold">{m.machines}</div><div className="text-xs text-muted">{ind.machine}s</div></div>
          <div className="rounded-xl bg-white p-3"><div className="text-xl font-bold">{Math.round(m.onTimeRate * 100)}%</div><div className="text-xs text-muted">on time</div></div>
          <div className="rounded-xl bg-white p-3"><div className="text-xl font-bold">{m.ordersDone}</div><div className="text-xs text-muted">orders done</div></div>
          <div className="rounded-xl bg-white p-3"><ShieldCheck className="mx-auto text-teal" size={22} /><div className="text-xs text-muted">{gst.valid ? "GST verified" : "Unregistered"}</div></div>
        </div>
      </div>
      <div className="mt-8 grid grid-cols-2 gap-5 md:grid-cols-4">
        {m.products.map((p, i) => (
          <Link key={p.id} href={`/market/p/${p.slug}`}>
            <div className="aspect-square overflow-hidden rounded-2xl"><ProductArt palette={p.palette} imageUrl={p.imageUrl} seed={i} label={p.name} /></div>
            <div className="mt-2 line-clamp-2 text-sm font-semibold">{p.name}</div>
            <div className="text-sm">{inr(p.price)} <span className="text-xs text-muted">· {p.stock} ready</span></div>
          </Link>
        ))}
      </div>
    </main>
  );
}
