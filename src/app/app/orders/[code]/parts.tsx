"use client";
import { useState, useTransition } from "react";
import { Check, X, Truck, PackageCheck, Loader2, Send, Hammer } from "lucide-react";
import { respondToOrder, advanceOrder, sendMessage } from "@/app/actions";
import { btn, cx } from "@/components/ui";
import { speak } from "@/components/client";

export function OrderActions({ lang, code, status }: { lang: "hi" | "en"; code: string; status: string }) {
  const t = (hi: string, en: string) => (lang === "hi" ? hi : en);
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<unknown>, say?: string) => start(async () => { await fn(); if (say) speak(say, lang); });

  if (status === "QUOTED")
    return (
      <div className="mt-4 flex gap-2">
        <button className={cx(btn.ghost, "flex-1")} disabled={pending} onClick={() => run(() => respondToOrder(code, false))}>
          <X size={16} /> {t("मना करें", "Decline")}
        </button>
        <button className={cx(btn.primary, "flex-[2]")} disabled={pending} onClick={() => run(() => respondToOrder(code, true), t("ऑर्डर मंज़ूर। ख़रीदार को बता दिया।", "Order accepted. Buyer notified."))}>
          {pending ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} {t("ऑर्डर मंज़ूर", "Accept order")}
        </button>
      </div>
    );
  const next: Record<string, { hi: string; en: string; icon: typeof Truck }> = {
    CONFIRMED: { hi: "बनाना शुरू", en: "Start production", icon: Hammer },
    IN_PRODUCTION: { hi: "माल भेज दिया (GST बिल बनाएँ)", en: "Mark dispatched (creates GST invoice)", icon: Truck },
    DISPATCHED: { hi: "पहुँच गया", en: "Mark delivered", icon: PackageCheck },
  };
  const n = next[status];
  if (!n) return null;
  const Icon = n.icon;
  return (
    <button className={cx(btn.teal, "mt-4 w-full")} disabled={pending} onClick={() => run(() => advanceOrder(code))}>
      {pending ? <Loader2 size={16} className="animate-spin" /> : <Icon size={16} />} {t(n.hi, n.en)}
    </button>
  );
}

export function Chat({ lang, code, messages, as = "PRODUCER" }: { lang: "hi" | "en"; code: string; messages: { id: string; sender: string; text: string; original: string; at: string }[]; as?: "PRODUCER" | "BUYER" }) {
  const t = (hi: string, en: string) => (lang === "hi" ? hi : en);
  const [text, setText] = useState("");
  const [pending, start] = useTransition();
  return (
    <div className="rounded-2xl border border-line bg-white p-3">
      <div className="max-h-80 space-y-2 overflow-y-auto">
        {messages.length === 0 && <div className="py-4 text-center text-xs text-muted">{t("अभी कोई संदेश नहीं", "No messages yet")}</div>}
        {messages.map((m) => {
          const mine = m.sender === as;
          return (
            <div key={m.id} className={cx("flex", mine ? "justify-end" : "justify-start")}>
              <div className={cx("max-w-[85%] rounded-2xl px-3 py-2 text-sm", mine ? "rounded-br-sm bg-brand text-white" : "rounded-bl-sm bg-paper")}>
                {m.text}
                {m.text !== m.original && <div className={cx("mt-1 text-[10px]", mine ? "text-white/70" : "text-muted")}>{t("अनुवाद किया गया", "translated")} · “{m.original.slice(0, 60)}{m.original.length > 60 ? "…" : ""}”</div>}
              </div>
            </div>
          );
        })}
      </div>
      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const v = text;
          setText("");
          start(() => sendMessage(code, v, as));
        }}
      >
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder={as === "PRODUCER" ? t("हिंदी में लिखें, ख़रीदार को अंग्रेज़ी में जाएगा", "Write a reply") : "Write in English; the maker reads it in Hindi"} className="min-w-0 flex-1 rounded-xl border border-line px-3 py-2 text-sm" />
        <button className={btn.primary} disabled={pending || !text.trim()} aria-label="Send">
          {pending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
        </button>
      </form>
    </div>
  );
}
