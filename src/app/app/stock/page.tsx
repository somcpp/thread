import { db } from "@/lib/db";
import { currentProducer, getLang, tr } from "@/lib/session";
import { materialHealth } from "@/lib/engine";
import { inr, num, shortDate } from "@/lib/format";
import { Badge, Bar, Card, ProductArt, SectionTitle } from "@/components/ui";
import ReorderButton from "./reorder";

export default async function StockPage() {
  const [p, lang] = await Promise.all([currentProducer(), getLang()]);
  const t = tr(lang);
  const [health, products, pending] = await Promise.all([
    materialHealth(p.id),
    db.product.findMany({ where: { producerId: p.id }, orderBy: { price: "desc" } }),
    db.supplierOrder.findMany({ where: { producerId: p.id, status: "SENT" }, include: { material: true, supplier: true }, orderBy: { createdAt: "desc" } }),
  ]);

  return (
    <div>
      <h1 className="text-xl font-bold">{t("स्टॉक", "Stock")}</h1>
      <p className="mt-1 text-sm text-muted">{t("पिछले 28 दिन के इस्तेमाल से Sutra बताता है कि माल कब ख़त्म होगा।", "Sutra predicts run-out dates from the last 28 days of usage.")}</p>

      <SectionTitle>{t("कच्चा माल", "Raw material")}</SectionTitle>
      <div className="space-y-2.5">
        {health.map((m) => {
          const days = Number.isFinite(m.daysLeft) ? Math.round(m.daysLeft) : null;
          const tone = m.status === "CRITICAL" ? "red" : m.status === "LOW" ? "amber" : "teal";
          const open = pending.find((o) => o.materialId === m.id);
          return (
            <Card key={m.id}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-semibold">{t(m.nameHi, m.name)}</div>
                  <div className="text-xs text-muted">{m.supplierName} · {t(`${m.leadTimeDays} दिन में आता है`, `${m.leadTimeDays}-day lead time`)}</div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold">{num(m.stock)} <span className="text-xs font-medium text-muted">{m.unit}</span></div>
                  <div className="text-[11px] text-muted">{inr(m.stock * m.costPerUnit)}</div>
                </div>
              </div>
              <div className="mt-2.5">
                <Bar value={days === null ? 1 : days / 45} tone={tone} />
                <div className="mt-1.5 flex items-center justify-between text-xs">
                  <span className="text-muted">
                    {num(m.usagePerDay)} {m.unit}/{t("दिन", "day")} · {days === null ? "-" : t(`~${days} दिन चलेगा`, `~${days} days left`)}
                  </span>
                  <Badge tone={tone === "teal" ? "green" : tone}>
                    {m.status === "OK" ? t("ठीक", "OK") : m.reorderBy ? t(`${shortDate(m.reorderBy, "hi")} तक मँगाएँ`, `Order by ${shortDate(m.reorderBy)}`) : ""}
                  </Badge>
                </div>
              </div>
              {open ? (
                <div className="mt-3 rounded-xl bg-teal-soft p-2.5 text-xs text-teal">
                  {t(`ऑर्डर भेजा: ${num(open.qty)} ${m.unit}, ${shortDate(open.createdAt, "hi")} को`, `Reorder sent: ${num(open.qty)} ${m.unit} on ${shortDate(open.createdAt)}`)}
                </div>
              ) : (
                m.status !== "OK" && <ReorderButton lang={lang} materialId={m.id} qty={m.suggestedQty} unit={m.unit} supplier={m.supplierName} />
              )}
            </Card>
          );
        })}
      </div>

      <SectionTitle>{t("तैयार माल", "Finished goods")}</SectionTitle>
      <div className="grid grid-cols-2 gap-2.5">
        {products.map((x, i) => (
          <Card key={x.id} className="overflow-hidden p-0">
            <div className="aspect-[4/3]"><ProductArt palette={x.palette} imageUrl={x.imageUrl} seed={i} label={x.name} /></div>
            <div className="p-2.5">
              <div className="line-clamp-2 text-xs font-semibold leading-snug">{t(x.nameHi, x.name)}</div>
              <div className="mt-1 flex items-baseline justify-between">
                <span className="text-lg font-bold">{x.stock}</span>
                <span className="text-[11px] text-muted">{inr(x.price)}/{t("पीस", "pc")}</span>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
