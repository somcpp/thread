import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileText } from "lucide-react";
import { db } from "@/lib/db";
import { currentProducer, getLang, tr } from "@/lib/session";
import { quote } from "@/lib/engine";
import { inr, num, shortDate } from "@/lib/format";
import { Badge, Card, SectionTitle, STATUS_LABEL, btn } from "@/components/ui";
import { OrderActions, Chat } from "./parts";

export default async function OrderDetail({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const [p, lang] = await Promise.all([currentProducer(), getLang()]);
  const t = tr(lang);
  const o = await db.order.findUnique({
    where: { code },
    include: { product: true, buyer: true, invoices: true, messages: { orderBy: { createdAt: "asc" } } },
  });
  if (!o || o.producerId !== p.id) notFound();
  const s = STATUS_LABEL[o.status];
  const q = o.status === "QUOTED" && o.wantedBy ? await quote(o.productId, o.qty, o.wantedBy) : null;

  return (
    <div>
      <Link href="/app/orders" className="mb-3 inline-flex items-center gap-1 text-sm text-muted"><ArrowLeft size={16} /> {t("सभी ऑर्डर", "All orders")}</Link>
      <Card>
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="text-xs text-muted">{o.code}</div>
            <div className="text-lg font-bold leading-tight">{o.buyer ? o.buyer.business : t("सीधी बिक्री", "Direct sale")}</div>
            {o.buyer && <div className="text-xs text-muted">{o.buyer.name} · {o.buyer.city}, {o.buyer.state}</div>}
          </div>
          <Badge tone={s.tone}>{t(s.hi, s.en)}</Badge>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          <Mini k={t("मात्रा", "Qty")} v={String(o.qty)} />
          <Mini k={t("रेट", "Rate")} v={inr(o.rate)} />
          <Mini k={t("कुल", "Total")} v={inr(o.qty * o.rate)} />
        </div>
        <div className="mt-2 text-sm">{t(o.product.nameHi, o.product.name)}</div>
        {o.wantedBy && <div className="text-xs text-muted">{t(`चाहिए: ${shortDate(o.wantedBy, "hi")} तक`, `Wanted by ${shortDate(o.wantedBy)}`)}</div>}
        {o.parentId && <div className="mt-1 text-xs text-teal">{t(`क्लस्टर ऑर्डर ${o.parentId} का हिस्सा`, `Part of cluster order ${o.parentId}`)}</div>}
      </Card>

      {q && (
        <>
          <SectionTitle>{t("क्या आप कर पाएँगे?", "Can you deliver?")}</SectionTitle>
          <Card className={q.canMeet ? "border-emerald-200 bg-emerald-50/60" : "border-amber-200 bg-amber-50/60"}>
            <div className="text-sm font-semibold">
              {q.canMeet
                ? t(`हाँ। ${shortDate(o.wantedBy, "hi")} तक सभी ${o.qty} तैयार हो जाएँगे।`, `Yes. All ${o.qty} ready by ${shortDate(o.wantedBy)}.`)
                : t(`${shortDate(o.wantedBy, "hi")} तक ${q.qtyByWanted} बन पाएँगे। पूरे ${o.qty}: ${shortDate(q.fullDate, "hi")} तक।`, `${q.qtyByWanted} by ${shortDate(o.wantedBy)}; all ${o.qty} by ${shortDate(q.fullDate)}.`)}
            </div>
            <div className="mt-1 text-xs text-muted">
              {t(`तैयार स्टॉक ${q.ready} · रोज़ ~${num(q.perDay)} बनती हैं (80% करघे)`, `Ready stock ${q.ready} · ~${num(q.perDay)}/day on 80% of looms`)}
            </div>
            {q.shortfalls.length > 0 && (
              <div className="mt-3 space-y-1.5">
                {q.shortfalls.map((sf) => (
                  <div key={sf.materialId} className="rounded-lg bg-white p-2 text-xs">
                    <b>{t(sf.nameHi, sf.name)}</b>: {t(`${num(sf.needQty)} ${sf.unit} और चाहिए, ${shortDate(sf.orderBy, "hi")} तक मँगाएँ`, `need ${num(sf.needQty)} ${sf.unit} more, order by ${shortDate(sf.orderBy)}`)} ({sf.supplierName})
                  </div>
                ))}
              </div>
            )}
          </Card>
        </>
      )}

      <OrderActions lang={lang} code={o.code} status={o.status} />

      {o.invoices.length > 0 && (
        <>
          <SectionTitle>{t("बिल", "Invoices")}</SectionTitle>
          <div className="flex flex-wrap gap-2">
            {o.invoices.map((i) => (
              <Link key={i.id} href={`/invoice/${encodeURIComponent(i.number)}`} className={btn.small}>
                <FileText size={14} /> {i.kind === "PROFORMA" ? t("प्रोफ़ॉर्मा", "Proforma") : t("टैक्स बिल", "Tax invoice")} {i.number}
              </Link>
            ))}
          </div>
        </>
      )}

      <SectionTitle>{t("बातचीत", "Messages")}</SectionTitle>
      <Chat lang={lang} code={o.code} messages={o.messages.map((m) => ({ id: m.id, sender: m.sender, text: t(m.textHi ?? m.text, m.textEn ?? m.text), original: m.text, at: m.createdAt.toISOString() }))} />
    </div>
  );
}

function Mini({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-xl bg-paper p-2">
      <div className="text-[11px] text-muted">{k}</div>
      <div className="text-sm font-bold">{v}</div>
    </div>
  );
}
