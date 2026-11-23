"use client";
import { useState, useTransition } from "react";
import { Loader2, Send } from "lucide-react";
import { sendReorder } from "@/app/actions";
import { btn, cx } from "@/components/ui";
import { speak } from "@/components/client";

export default function ReorderButton({ lang, materialId, qty, unit, supplier }: { lang: "hi" | "en"; materialId: string; qty: number; unit: string; supplier: string }) {
  const t = (hi: string, en: string) => (lang === "hi" ? hi : en);
  const [amount, setAmount] = useState(qty);
  const [done, setDone] = useState<Awaited<ReturnType<typeof sendReorder>> | null>(null);
  const [pending, start] = useTransition();

  if (done) {
    return (
      <div className="mt-3 space-y-2 rounded-xl bg-emerald-50 p-3 text-xs text-emerald-800">
        <div className="font-semibold">{t(`${done.supplier} को ऑर्डर भेजा। ${done.eta} तक आएगा।`, `Order sent to ${done.supplier}. Arrives by ${done.eta}.`)}</div>
        <div className="rounded-lg bg-white p-2 text-[11px] text-ink">{done.message}</div>
        <a href={done.whatsapp} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-emerald-700 underline">
          {t("WhatsApp पर खोलें", "Open in WhatsApp")}
        </a>
      </div>
    );
  }
  return (
    <div className="mt-3 flex items-center gap-2">
      <input type="number" value={amount} step="0.5" min={0} onChange={(e) => setAmount(Number(e.target.value))} className="w-20 rounded-lg border border-line px-2 py-2 text-sm" aria-label="quantity" />
      <span className="text-xs text-muted">{unit}</span>
      <button
        className={cx(btn.primary, "flex-1 py-2")}
        disabled={pending || amount <= 0}
        onClick={() =>
          start(async () => {
            const r = await sendReorder(materialId, amount);
            setDone(r);
            speak(t(`${supplier} को ${amount} ${unit} का ऑर्डर भेज दिया।`, `Reorder sent to ${supplier}.`), lang);
          })
        }
      >
        {pending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />} {t("सप्लायर को ऑर्डर", "Reorder")}
      </button>
    </div>
  );
}
