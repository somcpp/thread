import Link from "next/link";
import { db } from "@/lib/db";
import { currentBuyer } from "@/lib/session";
import { PrefSelect } from "@/components/client";
import { Logo } from "@/components/logo";

export const dynamic = "force-dynamic";

export default async function MarketLayout({ children }: { children: React.ReactNode }) {
  const [buyer, buyers] = await Promise.all([currentBuyer(), db.buyer.findMany({ orderBy: { business: "asc" } })]);
  return (
    <div className="min-h-screen bg-white">
      <header className="sticky top-0 z-20 border-b border-line bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-5 py-3">
          <Link href="/market" className="flex items-center gap-2">
            <Logo size={30} />
            <span className="font-display text-xl font-bold text-brand">Sutra</span>
            <span className="rounded-md bg-teal-soft px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-teal">Market</span>
          </Link>
          <nav className="ml-4 hidden gap-1 text-sm md:flex">
            <Link href="/market" className="rounded-lg px-3 py-2 hover:bg-paper">Browse</Link>
            <Link href="/market/orders" className="rounded-lg px-3 py-2 hover:bg-paper">My orders</Link>
          </nav>
          <div className="ml-auto flex items-center gap-2 text-xs text-muted">
            <span className="hidden sm:inline">Buying as</span>
            <PrefSelect name="buyer" value={buyer.id} options={buyers.map((b) => ({ value: b.id, label: `${b.business}, ${b.city}` }))} />
          </div>
        </div>
        <div className="thread" />
      </header>
      {children}
      <footer className="mt-16 border-t border-line bg-paper py-8 text-center text-xs text-muted">
        Every maker on Sutra is GST-verified. Delivery dates are calculated from live stock and loom capacity.
      </footer>
    </div>
  );
}
