"use client";
import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Camera, CheckCircle2, ShieldAlert, ShieldCheck, Loader2, Sparkles } from "lucide-react";
import { scanBill, saveBill, type ScannedBill } from "@/app/actions";
import { btn, Badge, Card, cx } from "@/components/ui";
import { speak } from "@/components/client";

const inr = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");

export default function BillScanner({ lang, ai, samples }: { lang: "hi" | "en"; ai: boolean; samples: { key: string; label: string }[] }) {
  const t = (hi: string, en: string) => (lang === "hi" ? hi : en);
  const [bill, setBill] = useState<ScannedBill | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<Awaited<ReturnType<typeof saveBill>> | null>(null);
  const [scanning, startScan] = useTransition();
  const [saving, startSave] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  function run(fd: FormData, img: string) {
    setError(null);
    setBill(null);
    setDone(null);
    setPreview(img);
    startScan(async () => {
      const r = await scanBill(fd);
      if (r.ok) {
        setBill(r.bill);
        const tax = r.bill.cgst + r.bill.sgst + r.bill.igst;
        speak(
          r.bill.gstin.valid
            ? t(`${r.bill.supplierName} का बिल पढ़ लिया। कुल ${inr(r.bill.total)}, टैक्स क्रेडिट ${inr(tax)}।`, `Read the ${r.bill.supplierName} bill. Total ${inr(r.bill.total)}.`)
            : t(`ध्यान दें, इस बिल का GSTIN गलत लग रहा है।`, `Careful: this bill's GSTIN looks wrong.`),
          lang,
        );
      } else setError(r.error);
    });
  }

  function onFile(f: File | undefined) {
    if (!f) return;
    const fd = new FormData();
    fd.set("file", f);
    run(fd, URL.createObjectURL(f));
  }

  function save() {
    if (!bill) return;
    startSave(async () => {
      const r = await saveBill(bill);
      setDone(r);
      speak(
        t(
          `सेव हो गया। ${r.updated.map((u) => `${u.qty} ${u.unit} ${u.nameHi}`).join(", ")} स्टॉक में जुड़ गया।${r.itcAtRisk ? " GSTIN ठीक करवाएँ, वरना टैक्स क्रेडिट नहीं मिलेगा।" : ""}`,
          `Saved. Stock updated.${r.itcAtRisk ? " Get the GSTIN corrected to claim tax credit." : ""}`,
        ),
        lang,
      );
    });
  }

  const updateItem = (i: number, patch: Partial<ScannedBill["items"][number]>) =>
    setBill((b) => (b ? { ...b, items: b.items.map((it, k) => (k === i ? { ...it, ...patch } : it)) } : b));

  if (done) {
    return (
      <Card className="mt-4 text-center">
        <CheckCircle2 className="mx-auto text-emerald-600" size={44} />
        <div className="mt-2 text-lg font-bold">{t("बिल सेव हो गया", "Bill saved")}</div>
        <ul className="mt-3 space-y-1 text-sm">
          {done.updated.map((u) => (
            <li key={u.name}>
              +{u.qty} {u.unit} {t(u.nameHi, u.name)} → {t("अब", "now")} <b>{Math.round(u.stock * 10) / 10} {u.unit}</b>
            </li>
          ))}
        </ul>
        <div className={cx("mt-3 rounded-xl p-3 text-sm", done.itcAtRisk ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700")}>
          {done.itcAtRisk
            ? t(`${inr(done.itc)} का टैक्स क्रेडिट रुका है। सप्लायर से सही GSTIN वाला बिल माँगें।`, `${inr(done.itc)} of tax credit is on hold until the supplier fixes the GSTIN.`)
            : t(`${inr(done.itc)} का टैक्स क्रेडिट (ITC) दर्ज हुआ।`, `${inr(done.itc)} input tax credit recorded.`)}
        </div>
        <div className="mt-4 flex justify-center gap-2">
          <button className={btn.ghost} onClick={() => { setDone(null); setBill(null); setPreview(null); }}>{t("एक और बिल", "Another bill")}</button>
          <Link href="/app/stock" className={btn.primary}>{t("स्टॉक देखें", "View stock")}</Link>
        </div>
      </Card>
    );
  }

  return (
    <div className="mt-4 space-y-4">
      {!bill && !scanning && (
        <>
          <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
          <button onClick={() => fileRef.current?.click()} className="flex w-full flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-brand/40 bg-brand-soft/60 p-8 text-brand">
            <Camera size={36} />
            <span className="font-bold">{t("कैमरा खोलें / फ़ोटो चुनें", "Open camera / choose photo")}</span>
            {!ai && <span className="text-xs text-muted">{t("AI बंद है: नीचे सैंपल बिल आज़माएँ", "AI is off: try a sample bill below")}</span>}
          </button>
          <div>
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">{t("या सैंपल बिल आज़माएँ", "Or try a sample bill")}</div>
            <div className="grid grid-cols-3 gap-2">
              {samples.map((s) => (
                <button
                  key={s.key}
                  onClick={() => { const fd = new FormData(); fd.set("sample", s.key); run(fd, `/samples/bill-${s.key}.jpg`); }}
                  className="overflow-hidden rounded-xl border border-line bg-white text-left"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/samples/bill-${s.key}.jpg`} alt={s.label} className="h-28 w-full object-cover object-top" />
                  <div className="p-1.5 text-[11px] font-medium leading-tight">{s.label}</div>
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {preview && (scanning || bill) && (
        <div className="relative overflow-hidden rounded-2xl border border-line bg-white">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="bill" className={cx("max-h-64 w-full object-contain", scanning && "opacity-60")} />
          {scanning && (
            <div className="absolute inset-0 grid place-items-center">
              <div className="flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold shadow">
                <Loader2 className="animate-spin" size={16} /> {t("बिल पढ़ रहे हैं…", "Reading the bill…")}
              </div>
            </div>
          )}
        </div>
      )}

      {error && <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      {bill && (
        <>
          <Card>
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="font-bold">{bill.supplierName}</div>
                <div className="text-xs text-muted">
                  {t("बिल", "Bill")} {bill.billNo} · {bill.billDate}
                </div>
              </div>
              <Badge tone={bill.source === "ai" ? "teal" : "gray"}>
                <Sparkles size={12} /> {bill.source === "ai" ? t("AI ने पढ़ा", "Read by AI") : t("सैंपल", "Sample data")}
              </Badge>
            </div>
            <div className={cx("mt-3 flex items-start gap-2 rounded-xl p-2.5 text-sm", bill.gstin.valid ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700")}>
              {bill.gstin.valid ? <ShieldCheck size={18} className="mt-0.5 shrink-0" /> : <ShieldAlert size={18} className="mt-0.5 shrink-0" />}
              <div>
                <div className="font-mono text-xs font-semibold">GSTIN {bill.supplierGstin || "-"}</div>
                {bill.gstin.valid
                  ? t(`सही है (${bill.gstin.state})${bill.supplierKnown ? " · पुराना सप्लायर" : " · नया सप्लायर"}`, `Valid (${bill.gstin.state})${bill.supplierKnown ? " · known supplier" : " · new supplier"}`)
                  : t("गलत GSTIN! टैक्स क्रेडिट नहीं मिलेगा। सप्लायर से सही करवाएँ।", `Invalid: ${bill.gstin.reason}. Tax credit at risk.`)}
              </div>
            </div>
          </Card>

          <Card className="p-0">
            <div className="border-b border-line px-4 py-2.5 text-sm font-bold">{t("सामान", "Items")}</div>
            {bill.items.map((it, i) => (
              <div key={i} className="space-y-2 border-b border-line px-4 py-3 last:border-0">
                <div className="text-sm font-medium">{it.description}</div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <label className="col-span-3">
                    <span className="text-muted">{t("किस माल में जोड़ें", "Add to material")}</span>
                    <select value={it.materialId} onChange={(e) => updateItem(i, { materialId: e.target.value })} className="mt-0.5 w-full rounded-lg border border-line px-2 py-1.5 text-sm">
                      <option value="">{t("— छोड़ें —", "— skip —")}</option>
                      {bill.materials.map((m) => (
                        <option key={m.id} value={m.id}>{t(m.nameHi, m.name)} ({m.unit})</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span className="text-muted">{t("मात्रा", "Qty")}</span>
                    <input type="number" step="0.01" value={it.qty} onChange={(e) => updateItem(i, { qty: Number(e.target.value) })} className="mt-0.5 w-full rounded-lg border border-line px-2 py-1.5 text-sm" />
                  </label>
                  <label>
                    <span className="text-muted">{t("रेट", "Rate")}</span>
                    <input type="number" value={it.rate} onChange={(e) => updateItem(i, { rate: Number(e.target.value) })} className="mt-0.5 w-full rounded-lg border border-line px-2 py-1.5 text-sm" />
                  </label>
                  <div className="text-right">
                    <span className="text-muted">{t("रकम", "Amount")}</span>
                    <div className="mt-1.5 text-sm font-semibold">{inr(it.qty * it.rate)}</div>
                  </div>
                </div>
              </div>
            ))}
          </Card>

          <Card className="space-y-1 text-sm">
            <Row k={t("टैक्स से पहले", "Taxable value")} v={inr(bill.taxable)} />
            {bill.igst > 0 ? <Row k="IGST" v={inr(bill.igst)} /> : <><Row k="CGST" v={inr(bill.cgst)} /><Row k="SGST" v={inr(bill.sgst)} /></>}
            <Row k={t("कुल", "Total")} v={inr(bill.total)} bold />
            <div className={cx("pt-1 text-xs", bill.mathOk ? "text-emerald-700" : "text-amber-700")}>
              {bill.mathOk ? t("✓ जोड़-घटाव सही है", "✓ Totals add up") : t("⚠ जोड़ मेल नहीं खा रहा, एक बार देख लें", "⚠ Totals don't add up, please check")}
            </div>
          </Card>

          <div className="flex gap-2">
            <button className={cx(btn.ghost, "flex-1")} onClick={() => { setBill(null); setPreview(null); }}>{t("रद्द करें", "Cancel")}</button>
            <button className={cx(btn.primary, "flex-[2]")} onClick={save} disabled={saving}>
              {saving ? <Loader2 className="animate-spin" size={16} /> : <CheckCircle2 size={16} />} {t("सेव करें", "Save to stock & GST")}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function Row({ k, v, bold }: { k: string; v: string; bold?: boolean }) {
  return (
    <div className={cx("flex justify-between", bold && "border-t border-line pt-1 font-bold")}>
      <span className="text-muted">{k}</span>
      <span>{v}</span>
    </div>
  );
}
