import Link from "next/link";
import { Camera, Mic, Plus, BookOpen, AlertTriangle, ShoppingBag, IndianRupee, ReceiptText } from "lucide-react";
import { db } from "@/lib/db";
import { currentProducer, getLang, tr } from "@/lib/session";
import { materialHealth } from "@/lib/engine";
import { ago, inr, num, DAY, now } from "@/lib/format";
import { industryOf } from "@/lib/industries";
import { Badge, Card, SectionTitle, Avatar, cx } from "@/components/ui";
import { SpeakButton } from "@/components/client";

export default async function ProducerHome() {
  const [p, lang] = await Promise.all([currentProducer(), getLang()]);
  const t = tr(lang);
  const ind = industryOf(p.cluster.industry);
  const monthStart = new Date(now() - 30 * DAY);
  const [alerts, health, products, invoices, ledger, openOrders, inquiries] = await Promise.all([
    db.alert.findMany({ where: { producerId: p.id, read: false }, orderBy: { createdAt: "desc" }, take: 4 }),
    materialHealth(p.id),
    db.product.findMany({ where: { producerId: p.id } }),
    db.invoice.findMany({ where: { producerId: p.id, kind: "TAX", issuedAt: { gte: monthStart } } }),
    db.ledgerEntry.findMany({ where: { producerId: p.id, settled: false } }),
    db.order.count({ where: { producerId: p.id, status: { in: ["CONFIRMED", "IN_PRODUCTION"] } } }),
    db.order.count({ where: { producerId: p.id, status: "QUOTED" } }),
  ]);
  const stockValue = health.reduce((a, m) => a + m.stock * m.costPerUnit, 0) + products.reduce((a, x) => a + x.stock * x.price, 0);
  const sales = invoices.reduce((a, i) => a + i.taxable, 0);
  const toReceive = ledger.filter((l) => l.direction === "RECEIVE").reduce((a, l) => a + l.amount, 0);
  const lowCount = health.filter((m) => m.status !== "OK").length;
  const first = p.name.replace(/^(Mohd\.|Md\.)\s*/, "").split(" ")[0];
  const greeting = t(`नमस्ते ${first} जी`, `Namaste, ${first}`);
  const spoken = t(
    `${greeting}। ${inquiries ? `${inquiries} नई माँग आई है। ` : ""}${lowCount ? `${lowCount} कच्चा माल कम है। ` : ""}इस महीने की बिक्री ${inr(sales)} है।`,
    `${greeting}. ${inquiries ? `${inquiries} new order requests. ` : ""}${lowCount ? `${lowCount} materials running low. ` : ""}Sales this month ${inr(sales)}.`,
  );

  return (
    <div>
      <div className="flex items-center gap-3">
        <Avatar name={p.name} color={p.avatarColor} size={46} />
        <div className="min-w-0 flex-1">
          <div className="text-lg font-bold leading-tight">{greeting}</div>
          <div className="truncate text-xs text-muted">
            {p.businessName} · {p.city} · {p.machines} {t(ind.machineHi, ind.machine + "s")}
          </div>
        </div>
        <SpeakButton text={spoken} lang={lang} />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2.5">
        <Link href="/app/bill" className="flex flex-col gap-2 rounded-2xl bg-brand p-4 text-white shadow-sm active:scale-[0.98]">
          <Camera size={26} />
          <div className="font-bold leading-tight">{t("बिल की फ़ोटो", "Snap a bill")}</div>
          <div className="text-xs text-white/80">{t("स्टॉक + GST अपने आप", "Stock + GST, automatic")}</div>
        </Link>
        <Link href="/app/voice" className="flex flex-col gap-2 rounded-2xl bg-teal p-4 text-white shadow-sm active:scale-[0.98]">
          <Mic size={26} />
          <div className="font-bold leading-tight">{t("बोलकर लिखें", "Voice entry")}</div>
          <div className="text-xs text-white/80">{t("“आज 6 साड़ी बनी…”", "“aaj 6 saree bani…”")}</div>
        </Link>
        <Link href="/app/catalog/new" className="flex items-center gap-2 rounded-2xl border border-line bg-white p-3 text-sm font-semibold">
          <Plus size={18} className="text-brand" /> {t("नया प्रोडक्ट", "New product")}
        </Link>
        <Link href="/app/khata" className="flex items-center gap-2 rounded-2xl border border-line bg-white p-3 text-sm font-semibold">
          <BookOpen size={18} className="text-brand" /> {t("खाता", "Khata")}
        </Link>
      </div>

      {alerts.length > 0 && (
        <>
          <SectionTitle>{t("ज़रूरी", "Needs attention")}</SectionTitle>
          <div className="space-y-2">
            {alerts.map((a) => (
              <Link key={a.id} href={a.href ?? "/app"} className={cx("block rounded-2xl border p-3", a.kind === "ORDER" ? "border-amber-200 bg-amber-50" : a.kind === "LOW_STOCK" ? "border-red-200 bg-red-50" : "border-line bg-white")}>
                <div className="flex items-start gap-2">
                  {a.kind === "ORDER" ? <ShoppingBag size={18} className="mt-0.5 text-amber-700" /> : a.kind === "PAYMENT" ? <IndianRupee size={18} className="mt-0.5 text-brand" /> : a.kind === "GST" ? <ReceiptText size={18} className="mt-0.5 text-brand" /> : <AlertTriangle size={18} className="mt-0.5 text-red-600" />}
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold">{t(a.titleHi, a.title)}</div>
                    <div className="text-xs text-muted">{t(a.bodyHi, a.body)}</div>
                  </div>
                  <span className="shrink-0 text-[11px] text-muted">{ago(a.createdAt, lang)}</span>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}

      <SectionTitle>{t("कारोबार एक नज़र में", "Business at a glance")}</SectionTitle>
      <div className="grid grid-cols-2 gap-2.5">
        <Kpi label={t("30 दिन की बिक्री", "Sales, last 30 days")} value={inr(sales)} sub={`${invoices.length} ${t("बिल", "invoices")}`} />
        <Kpi label={t("माल की कीमत", "Stock value")} value={inr(stockValue)} sub={t("धागा + तैयार माल", "materials + finished")} />
        <Kpi label={t("लेना बाकी", "To receive")} value={inr(toReceive)} sub={t("खाते से", "from khata")} href="/app/khata" />
        <Kpi label={t("चालू ऑर्डर", "Open orders")} value={String(openOrders)} sub={inquiries ? `${inquiries} ${t("नई माँग", "new requests")}` : t("कोई नई माँग नहीं", "no new requests")} href="/app/orders" />
      </div>

      <SectionTitle action={<Link href="/app/stock" className="text-xs font-semibold text-brand">{t("सब देखें", "See all")}</Link>}>
        {t("कच्चा माल", "Raw material")}
      </SectionTitle>
      <Card className="divide-y divide-line p-0">
        {health.map((m) => (
          <div key={m.id} className="flex items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold">{t(m.nameHi, m.name)}</div>
              <div className="text-xs text-muted">
                {num(m.stock)} {m.unit} · {Number.isFinite(m.daysLeft) ? t(`${Math.round(m.daysLeft)} दिन चलेगा`, `lasts ${Math.round(m.daysLeft)} days`) : "-"}
              </div>
            </div>
            <Badge tone={m.status === "CRITICAL" ? "red" : m.status === "LOW" ? "amber" : "green"}>
              {m.status === "CRITICAL" ? t("बहुत कम", "Critical") : m.status === "LOW" ? t("कम", "Low") : t("ठीक", "OK")}
            </Badge>
          </div>
        ))}
      </Card>
    </div>
  );
}

function Kpi({ label, value, sub, href }: { label: string; value: string; sub: string; href?: string }) {
  const body = (
    <Card className="p-3.5">
      <div className="text-[11px] text-muted">{label}</div>
      <div className="mt-0.5 text-lg font-bold tracking-tight">{value}</div>
      <div className="text-[11px] text-muted">{sub}</div>
    </Card>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}
