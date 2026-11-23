import Link from "next/link";
import { ArrowRight, Mic, Camera, Store, LayoutDashboard, Smartphone, ShoppingCart } from "lucide-react";
import { db } from "@/lib/db";
import { inr } from "@/lib/format";
import { INDUSTRIES } from "@/lib/industries";
import { Logo } from "@/components/logo";

export const dynamic = "force-dynamic";

export default async function Landing() {
  const [producers, clusters, marketplaceOrders] = await Promise.all([
    db.producer.count(),
    db.cluster.findMany({ include: { _count: { select: { producers: true } } } }),
    db.order.findMany({ where: { channel: "MARKETPLACE", status: { not: "DECLINED" } }, include: { producer: true } }),
  ]);
  const saved = marketplaceOrders.reduce((a, o) => a + (o.qty * o.rate * o.producer.agentCutPct) / 100, 0);

  const portals = [
    { href: "/app", icon: Smartphone, title: "Producer App", who: "For Rohit and other makers", body: "Hindi, voice-first. Snap a bill, speak a note, and stock, GST and catalog update on their own.", color: "bg-brand" },
    { href: "/market", icon: ShoppingCart, title: "Buyer Marketplace", who: "For boutiques and retailers", body: "Find verified makers, see what they can really deliver by your date, and order directly.", color: "bg-teal" },
    { href: "/cluster", icon: LayoutDashboard, title: "Cluster Dashboard", who: "For cooperatives, FPOs and CAs", body: "Every maker on one screen. Split bulk orders, buy raw material together, track GST.", color: "bg-ink" },
  ];

  return (
    <main className="mx-auto max-w-6xl px-5 pb-16">
      <header className="flex items-center justify-between py-5">
        <div className="flex items-center gap-2">
          <Logo />
          <span className="font-display text-2xl font-bold text-brand">Sutra</span>
        </div>
        <nav className="flex gap-1 text-sm">
          <Link href="/app" className="rounded-lg px-3 py-2 hover:bg-white">Producer App</Link>
          <Link href="/market" className="rounded-lg px-3 py-2 hover:bg-white">Marketplace</Link>
          <Link href="/cluster" className="rounded-lg px-3 py-2 hover:bg-white">Cluster</Link>
        </nav>
      </header>
      <div className="thread rounded-full" />

      <section className="grid items-center gap-10 py-14 md:grid-cols-[1.2fr_1fr]">
        <div>
          <p className="text-sm font-semibold uppercase tracking-widest text-teal">Build for Bharat · MSME track</p>
          <h1 className="font-display mt-3 text-5xl font-bold leading-[1.05] text-ink md:text-6xl">
            One thread that ties a small business together.
          </h1>
          <p className="mt-5 max-w-xl text-lg text-muted">
            Small producers run on paper and WhatsApp. Sutra turns the <b className="text-ink">bill photos</b> and <b className="text-ink">voice notes</b> they already send
            into stock tracking, GST invoices and a storefront that bulk buyers can order from directly. No agent. No accountant.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link href="/app" className="inline-flex items-center gap-2 rounded-xl bg-brand px-5 py-3 font-semibold text-white hover:bg-brand-dark">
              Open Producer App <ArrowRight size={18} />
            </Link>
            <Link href="/market" className="inline-flex items-center gap-2 rounded-xl border border-line bg-white px-5 py-3 font-semibold">
              Browse as a buyer
            </Link>
          </div>
        </div>
        <div className="rounded-3xl border border-line bg-white p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted">How it works</div>
          {[
            { icon: Camera, a: "Photo of a supplier bill", b: "Stock up, GST purchase entry, supplier GSTIN checked" },
            { icon: Mic, a: "“aaj 6 saree bani, 4 Jaipur bheji”", b: "Production recorded, GST invoice created" },
            { icon: Store, a: "Photo of a finished product", b: "Catalog card with an English story for buyers" },
          ].map(({ icon: Icon, a, b }) => (
            <div key={a} className="mt-4 flex gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand"><Icon size={20} /></div>
              <div>
                <div className="font-semibold">{a}</div>
                <div className="text-sm text-muted">→ {b}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {portals.map(({ href, icon: Icon, title, who, body, color }) => (
          <Link key={href} href={href} className="group rounded-2xl border border-line bg-white p-5 transition hover:-translate-y-0.5 hover:shadow-md">
            <div className={`grid h-11 w-11 place-items-center rounded-xl text-white ${color}`}><Icon size={22} /></div>
            <div className="mt-4 text-lg font-bold">{title}</div>
            <div className="text-xs font-semibold uppercase tracking-wide text-muted">{who}</div>
            <p className="mt-2 text-sm text-muted">{body}</p>
            <div className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-brand group-hover:gap-2 transition-all">Open <ArrowRight size={16} /></div>
          </Link>
        ))}
      </section>

      <section className="mt-12 grid gap-4 rounded-3xl bg-ink p-6 text-white md:grid-cols-4">
        <Metric k={String(producers)} v="makers on Sutra (demo data)" />
        <Metric k={String(clusters.length)} v="clusters: Chanderi handloom, Moradabad brass" />
        <Metric k={String(marketplaceOrders.length)} v="direct orders, no agent" />
        <Metric k={inr(saved)} v="agent commission kept by makers" />
      </section>

      <section className="mt-12">
        <h2 className="font-display text-2xl font-bold">Not just for weavers</h2>
        <p className="mt-1 max-w-2xl text-muted">
          The engine is the same everywhere: raw material → production → finished goods → buyers. Only the settings change.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-6">
          {Object.values(INDUSTRIES).map((i) => (
            <div key={i.key} className="rounded-2xl border border-line bg-white p-4 text-center">
              <div className="text-3xl">{i.emoji}</div>
              <div className="mt-2 text-sm font-semibold">{i.name}</div>
              <div className="text-xs text-muted">capacity per {i.machine}</div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

function Metric({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <div className="text-3xl font-bold text-amber-300">{k}</div>
      <div className="text-sm text-white/70">{v}</div>
    </div>
  );
}
