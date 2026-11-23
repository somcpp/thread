import Link from "next/link";
import { BadgeCheck, Truck } from "lucide-react";
import { db } from "@/lib/db";
import { inr } from "@/lib/format";
import { industryOf } from "@/lib/industries";
import { weeklyCapacity } from "@/lib/market";
import { ProductArt, cx } from "@/components/ui";

export default async function Market({ searchParams }: { searchParams: Promise<{ c?: string; cat?: string; q?: string }> }) {
  const sp = await searchParams;
  const clusters = await db.cluster.findMany({ include: { _count: { select: { producers: true } } } });
  const cluster = clusters.find((c) => c.slug === sp.c);
  const products = await db.product.findMany({
    where: {
      published: true,
      ...(cluster ? { producer: { clusterId: cluster.id } } : {}),
      ...(sp.cat ? { category: sp.cat } : {}),
      ...(sp.q ? { OR: [{ name: { contains: sp.q } }, { story: { contains: sp.q } }] } : {}),
    },
    include: { producer: { include: { cluster: true } } },
    orderBy: [{ createdAt: "desc" }],
  });
  const cats = [...new Set((await db.product.findMany({ where: cluster ? { producer: { clusterId: cluster.id } } : {}, select: { category: true } })).map((x) => x.category))];
  const qs = (patch: Record<string, string | undefined>) => {
    const u = new URLSearchParams();
    const merged = { c: sp.c, cat: sp.cat, q: sp.q, ...patch };
    Object.entries(merged).forEach(([k, v]) => v && u.set(k, v));
    return `/market?${u}`;
  };

  return (
    <main className="mx-auto max-w-6xl px-5">
      <section className="py-10">
        <h1 className="font-display max-w-3xl text-4xl font-bold leading-tight md:text-5xl">Buy directly from India&apos;s craft clusters.</h1>
        <p className="mt-3 max-w-2xl text-muted">
          No agents in between. Every listing shows what the maker can <b className="text-ink">actually deliver by your date</b>, from their live stock and loom capacity.
        </p>
        <form action="/market" className="mt-5 flex max-w-xl gap-2">
          {sp.c && <input type="hidden" name="c" value={sp.c} />}
          <input name="q" defaultValue={sp.q} placeholder="Search sarees, dupattas, brass diyas…" className="min-w-0 flex-1 rounded-xl border border-line px-4 py-3" />
          <button className="rounded-xl bg-ink px-5 font-semibold text-white">Search</button>
        </form>
      </section>

      <div className="flex flex-wrap gap-2">
        <Link href={qs({ c: undefined, cat: undefined })} className={cx("rounded-full border px-4 py-1.5 text-sm font-medium", !cluster ? "border-ink bg-ink text-white" : "border-line")}>All clusters</Link>
        {clusters.map((c) => (
          <Link key={c.id} href={qs({ c: c.slug, cat: undefined })} className={cx("rounded-full border px-4 py-1.5 text-sm font-medium", cluster?.id === c.id ? "border-ink bg-ink text-white" : "border-line")}>
            {industryOf(c.industry).emoji} {c.name} <span className="opacity-60">· {c._count.producers} makers</span>
          </Link>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {cats.map((c) => (
          <Link key={c} href={qs({ cat: sp.cat === c ? undefined : c })} className={cx("rounded-lg px-3 py-1 text-xs font-semibold", sp.cat === c ? "bg-brand text-white" : "bg-paper text-muted")}>{c}</Link>
        ))}
      </div>

      <div className="mt-6 grid grid-cols-2 gap-5 md:grid-cols-3 lg:grid-cols-4">
        {products.map((p, i) => {
          const cap = weeklyCapacity(p, p.producer.machines);
          return (
            <Link key={p.id} href={`/market/p/${p.slug}`} className="group">
              <div className="aspect-square overflow-hidden rounded-2xl bg-paper">
                <ProductArt palette={p.palette} imageUrl={p.imageUrl} seed={i} label={p.name} className="transition duration-300 group-hover:scale-105" />
              </div>
              <div className="mt-2.5 line-clamp-2 text-sm font-semibold leading-snug">{p.name}</div>
              <div className="mt-0.5 flex items-center gap-1 text-xs text-muted">
                <BadgeCheck size={13} className="text-teal" /> {p.producer.name} · {p.producer.cluster.city}
              </div>
              <div className="mt-1.5 flex items-baseline gap-2">
                <span className="font-bold">{inr(p.price)}</span>
                <span className="text-xs text-muted">+GST · wholesale</span>
              </div>
              <div className="mt-1.5 inline-flex items-center gap-1 rounded-md bg-teal-soft px-2 py-0.5 text-[11px] font-semibold text-teal">
                <Truck size={12} /> {p.stock} ready · +{cap}/week
              </div>
            </Link>
          );
        })}
      </div>
    </main>
  );
}
