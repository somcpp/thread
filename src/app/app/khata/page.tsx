import { db } from "@/lib/db";
import { currentProducer, getLang, tr } from "@/lib/session";
import { inr, shortDate, daysFromNow } from "@/lib/format";
import { Card, SectionTitle, Badge, Stat } from "@/components/ui";
import { SettleButton } from "./settle";

export default async function KhataPage() {
  const [p, lang] = await Promise.all([currentProducer(), getLang()]);
  const t = tr(lang);
  const entries = await db.ledgerEntry.findMany({ where: { producerId: p.id }, orderBy: [{ settled: "asc" }, { dueDate: "asc" }], take: 40 });
  const open = entries.filter((e) => !e.settled);
  const receive = open.filter((e) => e.direction === "RECEIVE");
  const pay = open.filter((e) => e.direction === "PAY");
  const total = (xs: typeof open) => xs.reduce((a, e) => a + e.amount, 0);

  const Row = ({ e }: { e: (typeof entries)[number] }) => {
    const d = e.dueDate ? daysFromNow(e.dueDate) : null;
    const overdue = !e.settled && d !== null && d < 0;
    const reminder =
      e.direction === "RECEIVE"
        ? `Namaste, ${p.businessName} se yaad dilana: ${inr(e.amount)} (${e.note}) ${e.dueDate ? `due ${shortDate(e.dueDate)}` : ""}. UPI se bhej sakte hain. Dhanyavaad!`
        : "";
    return (
      <div className="flex items-center gap-2 px-3 py-3">
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">{e.party}</div>
          <div className="truncate text-xs text-muted">{e.note}</div>
          {!e.settled && e.dueDate && (
            <div className={overdue ? "text-xs font-semibold text-red-600" : "text-xs text-muted"}>
              {overdue ? t(`${-d!} दिन से बाकी`, `${-d!} days overdue`) : t(`${shortDate(e.dueDate, "hi")} तक`, `due ${shortDate(e.dueDate)}`)}
            </div>
          )}
        </div>
        <div className="text-right">
          <div className={e.direction === "RECEIVE" ? "font-bold text-teal" : "font-bold text-brand"}>{inr(e.amount)}</div>
          {e.settled ? <Badge tone="green">{t("चुकता", "Settled")}</Badge> : <SettleButton id={e.id} lang={lang} reminder={reminder} />}
        </div>
      </div>
    );
  };

  return (
    <div>
      <h1 className="text-xl font-bold">{t("खाता", "Khata")}</h1>
      <div className="mt-3 grid grid-cols-2 gap-2.5">
        <Stat label={t("लेना है", "To receive")} value={inr(total(receive))} tone="teal" sub={`${receive.length} ${t("लोग", "parties")}`} />
        <Stat label={t("देना है", "To pay")} value={inr(total(pay))} tone="brand" sub={`${pay.length} ${t("लोग", "parties")}`} />
      </div>
      <SectionTitle>{t("लेना है", "To receive")}</SectionTitle>
      <Card className="divide-y divide-line p-0">{receive.map((e) => <Row key={e.id} e={e} />)}</Card>
      <SectionTitle>{t("देना है", "To pay")}</SectionTitle>
      <Card className="divide-y divide-line p-0">{pay.map((e) => <Row key={e.id} e={e} />)}</Card>
      <SectionTitle>{t("पुराना हिसाब", "Settled")}</SectionTitle>
      <Card className="divide-y divide-line p-0">{entries.filter((e) => e.settled).slice(0, 8).map((e) => <Row key={e.id} e={e} />)}</Card>
    </div>
  );
}
