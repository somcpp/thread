"use client";
import { useTransition } from "react";
import { settleEntry } from "@/app/actions";

export function SettleButton({ id, lang, reminder }: { id: string; lang: "hi" | "en"; reminder: string }) {
  const [pending, start] = useTransition();
  const t = (hi: string, en: string) => (lang === "hi" ? hi : en);
  return (
    <div className="mt-1 flex justify-end gap-1">
      {reminder && (
        <a href={`https://wa.me/?text=${encodeURIComponent(reminder)}`} target="_blank" rel="noreferrer" className="rounded-md bg-emerald-50 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-700">
          {t("याद दिलाएँ", "Remind")}
        </a>
      )}
      <button disabled={pending} onClick={() => start(() => settleEntry(id))} className="rounded-md bg-stone-100 px-1.5 py-0.5 text-[11px] font-semibold disabled:opacity-50">
        {t("चुकता", "Settle")}
      </button>
    </div>
  );
}
