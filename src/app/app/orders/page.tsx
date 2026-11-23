import Link from "next/link";
import { db } from "@/lib/db";
import { currentProducer, getLang, tr } from "@/lib/session";
import { inr, shortDate, ago } from "@/lib/format";
import { Badge, Card, Empty, SectionTitle, STATUS_LABEL } from "@/components/ui";

export default async function OrdersPage() {
  const [p, lang] = await Promise.all([currentProducer(), getLang()]);
  const t = tr(lang);
  const orders = await db.order.findMany({
    where: { producerId: p.id },
    include: { product: true, buyer: true, messages: { orderBy: { createdAt: "desc" }, take: 1 } },
    orderBy: { createdAt: "desc" },
    take: 40,
  });
  const groups = [
    { key: "new", title: t("नई माँग", "New requests"), items: orders.filter((o) => o.status === "QUOTED") },
    { key: "open", title: t("चालू ऑर्डर", "In progress"), items: orders.filter((o) => ["CONFIRMED", "IN_PRODUCTION", "DISPATCHED"].includes(o.status)) },
    { key: "done", title: t("पूरे हुए", "Completed"), items: orders.filter((o) => o.status === "DELIVERED").slice(0, 12) },
  ];
  return (
    <div>
      <h1 className="text-xl font-bold">{t("ऑर्डर", "Orders")}</h1>
      <p className="mt-1 text-sm text-muted">{t("ख़रीदार अंग्रेज़ी में लिखते हैं, आपको हिंदी में दिखता है।", "Buyers write in English; you read it in Hindi.")}</p>
      {groups.map((g) => (
        <div key={g.key}>
          <SectionTitle>
            {g.title} <span className="text-muted">({g.items.length})</span>
          </SectionTitle>
          {g.items.length === 0 ? (
            <Empty>{t("कुछ नहीं", "Nothing here")}</Empty>
          ) : (
            <div className="space-y-2">
              {g.items.map((o) => {
                const s = STATUS_LABEL[o.status];
                const last = o.messages[0];
                return (
                  <Link key={o.id} href={`/app/orders/${o.code}`}>
                    <Card className="p-3 transition hover:border-brand/40">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold">{o.buyer ? `${o.buyer.business}, ${o.buyer.city}` : o.channel === "AGENT" ? t("एजेंट", "Agent") : t("सीधी बिक्री", "Direct sale")}</div>
                          <div className="truncate text-xs text-muted">{o.qty} × {t(o.product.nameHi, o.product.name)}</div>
                        </div>
                        <Badge tone={s.tone}>{t(s.hi, s.en)}</Badge>
                      </div>
                      {last && g.key !== "done" && <div className="mt-2 line-clamp-2 rounded-lg bg-paper p-2 text-xs">“{t(last.textHi ?? last.text, last.textEn ?? last.text)}”</div>}
                      <div className="mt-2 flex justify-between text-[11px] text-muted">
                        <span>{o.code} · {inr(o.qty * o.rate)}</span>
                        <span>{o.status === "DELIVERED" ? shortDate(o.deliveredAt, lang) : o.wantedBy ? t(`${shortDate(o.wantedBy, "hi")} तक`, `by ${shortDate(o.wantedBy)}`) : ago(o.createdAt, lang)}</span>
                      </div>
                    </Card>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
