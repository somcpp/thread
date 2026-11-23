import Link from "next/link";
import { Plus, ExternalLink } from "lucide-react";
import { db } from "@/lib/db";
import { currentProducer, getLang, tr } from "@/lib/session";
import { inr } from "@/lib/format";
import { Badge, Card, ProductArt, btn } from "@/components/ui";

export default async function CatalogPage() {
  const [p, lang] = await Promise.all([currentProducer(), getLang()]);
  const t = tr(lang);
  const products = await db.product.findMany({ where: { producerId: p.id }, orderBy: { createdAt: "desc" } });
  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">{t("मेरा कैटलॉग", "My catalog")}</h1>
        <Link href="/app/catalog/new" className={btn.primary}><Plus size={16} /> {t("नया", "New")}</Link>
      </div>
      <p className="mt-1 text-sm text-muted">{t("यही प्रोडक्ट देशभर के ख़रीदारों को मार्केटप्लेस पर दिखते हैं।", "These products are live for buyers across India on the marketplace.")}</p>
      <Link href={`/market/maker/${p.slug}`} className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-teal">
        <ExternalLink size={13} /> {t("ख़रीदार को कैसा दिखता है", "See it as a buyer")}
      </Link>
      <div className="mt-4 space-y-2.5">
        {products.map((x, i) => (
          <Card key={x.id} className="flex gap-3 p-2.5">
            <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl"><ProductArt palette={x.palette} imageUrl={x.imageUrl} seed={i} label={x.name} /></div>
            <div className="min-w-0 flex-1">
              <div className="line-clamp-2 text-sm font-semibold leading-snug">{x.name}</div>
              <div className="text-xs text-muted">{x.nameHi}</div>
              <div className="mt-1 flex items-center gap-2">
                <span className="text-sm font-bold">{inr(x.price)}</span>
                <Badge tone={x.published ? "green" : "gray"}>{x.published ? t("लाइव", "Live") : t("छुपा", "Hidden")}</Badge>
                <span className="text-[11px] text-muted">{t("स्टॉक", "Stock")} {x.stock}</span>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
