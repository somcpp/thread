import Link from "next/link";
import { db } from "@/lib/db";
import { currentProducer, getLang } from "@/lib/session";
import { BottomNav, LangToggle, PrefSelect } from "@/components/client";
import { Logo } from "@/components/logo";
import { industryOf } from "@/lib/industries";

export const dynamic = "force-dynamic";

export default async function ProducerLayout({ children }: { children: React.ReactNode }) {
  const [producer, lang, all] = await Promise.all([
    currentProducer(),
    getLang(),
    db.producer.findMany({ include: { cluster: true }, orderBy: [{ clusterId: "asc" }, { machines: "desc" }] }),
  ]);
  return (
    <div className="min-h-screen bg-stone-200/60 md:py-6">
      <div className="mx-auto flex min-h-screen max-w-md flex-col bg-paper md:min-h-[calc(100vh-3rem)] md:overflow-hidden md:rounded-[28px] md:border md:border-line md:shadow-xl">
        <header className="no-print sticky top-0 z-20 border-b border-line bg-white/95 backdrop-blur">
          <div className="flex items-center gap-2 px-4 py-2.5">
            <Link href="/" aria-label="Sutra home"><Logo size={28} /></Link>
            <PrefSelect
              name="producer"
              value={producer.slug}
              className="min-w-0 flex-1 truncate"
              options={all.map((p) => ({ value: p.slug, label: `${industryOf(p.cluster.industry).emoji} ${p.name} · ${p.businessName}` }))}
            />
            <LangToggle lang={lang} />
          </div>
          <div className="thread" />
        </header>
        <main className="flex-1 px-4 pb-6 pt-4">{children}</main>
        <BottomNav lang={lang} />
      </div>
    </div>
  );
}
