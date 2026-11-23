import Link from "next/link";
import { Download, FileJson, ShieldAlert, ShieldCheck, FileText } from "lucide-react";
import { currentProducer, getLang, tr } from "@/lib/session";
import { gstReport, recentMonths } from "@/lib/gst-report";
import { validateGstin } from "@/lib/gst";
import { inr, shortDate } from "@/lib/format";
import { Card, SectionTitle, btn, cx, Badge } from "@/components/ui";

export default async function GstPage({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const [p, lang, sp] = await Promise.all([currentProducer(), getLang(), searchParams]);
  const t = tr(lang);
  const months = recentMonths(6);
  const ym = sp.m && months.includes(sp.m) ? sp.m : months[0];
  const r = await gstReport(p.id, ym);
  const own = validateGstin(p.gstin);
  const label = (m: string) => new Date(`${m}-01`).toLocaleDateString(lang === "hi" ? "hi-IN" : "en-IN", { month: "short", year: "2-digit" });

  return (
    <div>
      <h1 className="text-xl font-bold">GST</h1>
      <div className={cx("mt-2 flex items-center gap-2 rounded-xl p-2.5 text-xs", p.gstin ? (own.valid ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700") : "bg-amber-50 text-amber-800")}>
        {own.valid ? <ShieldCheck size={16} /> : <ShieldAlert size={16} />}
        {p.gstin ? <span className="font-mono">{p.gstin}</span> : t("GST रजिस्ट्रेशन नहीं है (छोटे कारोबार के लिए ठीक)", "Not GST-registered (fine below the threshold)")}
      </div>

      <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1">
        {months.map((m) => (
          <Link key={m} href={`/app/gst?m=${m}`} className={cx("shrink-0 rounded-full border px-3 py-1 text-xs font-semibold", m === ym ? "border-brand bg-brand text-white" : "border-line bg-white")}>{label(m)}</Link>
        ))}
      </div>

      <Card className="mt-3">
        <div className="text-xs text-muted">{t("इस महीने भरना है (अनुमान)", "Estimated GST payable this month")}</div>
        <div className="text-3xl font-bold text-brand">{inr(r.net)}</div>
        <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
          <div className="rounded-xl bg-paper p-2.5">
            <div className="text-[11px] text-muted">{t("बिक्री पर टैक्स", "Tax on sales")}</div>
            <div className="font-bold">{inr(r.outTotal)}</div>
            <div className="text-[11px] text-muted">{r.invoices.length} {t("बिल", "invoices")} · {inr(r.out.taxable)}</div>
          </div>
          <div className="rounded-xl bg-paper p-2.5">
            <div className="text-[11px] text-muted">{t("ख़रीद पर टैक्स क्रेडिट", "Input tax credit")}</div>
            <div className="font-bold text-teal">− {inr(r.itcTotal)}</div>
            <div className="text-[11px] text-muted">{r.purchases.length} {t("ख़रीद बिल", "purchase bills")}</div>
          </div>
        </div>
        <div className="mt-2 grid grid-cols-3 gap-2 text-center text-[11px]">
          <div className="rounded-lg border border-line p-1.5">CGST<br /><b>{inr(r.out.cgst)}</b></div>
          <div className="rounded-lg border border-line p-1.5">SGST<br /><b>{inr(r.out.sgst)}</b></div>
          <div className="rounded-lg border border-line p-1.5">IGST<br /><b>{inr(r.out.igst)}</b></div>
        </div>
      </Card>

      <SectionTitle>{t("जाँच", "Checks")}</SectionTitle>
      {r.issues.length === 0 ? (
        <Card className="flex items-center gap-2 border-emerald-200 bg-emerald-50/60 text-sm text-emerald-800"><ShieldCheck size={18} /> {t("सब ठीक है। कोई गलती नहीं मिली।", "All good. No errors found.")}</Card>
      ) : (
        <div className="space-y-2">
          {r.atRisk > 0 && (
            <Card className="border-red-200 bg-red-50/60 text-sm text-red-800">
              <b>{inr(r.atRisk)}</b> {t("का टैक्स क्रेडिट रुका है", "of tax credit at risk")}
            </Card>
          )}
          {r.issues.map((i, k) => (
            <Card key={k} className="flex items-start gap-2 p-3 text-xs"><ShieldAlert size={16} className="shrink-0 text-red-600" /> {i.text}</Card>
          ))}
        </div>
      )}

      <SectionTitle>{t("CA के लिए डाउनलोड", "Downloads for your CA")}</SectionTitle>
      <div className="grid grid-cols-2 gap-2">
        <a href={`/api/gst?m=${ym}&format=csv`} className={btn.ghost}><Download size={16} /> Excel / CSV</a>
        <a href={`/api/gst?m=${ym}&format=json`} className={btn.ghost}><FileJson size={16} /> GSTR-1 JSON</a>
      </div>

      <SectionTitle>{t("बिक्री के बिल", "Sales invoices")}</SectionTitle>
      <Card className="divide-y divide-line p-0">
        {r.invoices.length === 0 && <div className="p-4 text-center text-sm text-muted">{t("इस महीने कोई बिल नहीं", "No invoices this month")}</div>}
        {r.invoices.slice().reverse().map((i) => (
          <Link key={i.id} href={`/invoice/${encodeURIComponent(i.number)}`} className="flex items-center gap-2 px-3 py-2.5 text-xs hover:bg-paper">
            <FileText size={16} className="text-muted" />
            <div className="min-w-0 flex-1">
              <div className="truncate font-semibold">{i.buyerName}</div>
              <div className="text-muted">{i.number} · {shortDate(i.issuedAt, lang)}</div>
            </div>
            <div className="text-right">
              <div className="font-semibold">{inr(i.total)}</div>
              <Badge tone={i.buyerGstin ? "teal" : "gray"}>{i.buyerGstin ? "B2B" : "B2C"}</Badge>
            </div>
          </Link>
        ))}
      </Card>

      <SectionTitle>{t("ख़रीद के बिल", "Purchase bills")}</SectionTitle>
      <Card className="divide-y divide-line p-0">
        {r.purchases.slice().reverse().map((x) => (
          <div key={x.id} className="flex items-center gap-2 px-3 py-2.5 text-xs">
            <div className="min-w-0 flex-1">
              <div className="truncate font-semibold">{x.supplier.name}</div>
              <div className="text-muted">{x.billNo} · {shortDate(x.billDate, lang)} {x.source === "bill" && <Badge tone="brand">{t("फ़ोटो से", "from photo")}</Badge>}</div>
            </div>
            <div className="text-right">
              <div className="font-semibold">{inr(x.total)}</div>
              <div className={x.gstinValid ? "text-teal" : "text-red-600"}>ITC {inr(x.cgst + x.sgst + x.igst)}</div>
            </div>
          </div>
        ))}
      </Card>
    </div>
  );
}
