"use client";
// Small client-side pieces shared across portals.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTransition, type ReactNode } from "react";
import { Home, Package, ShoppingBag, ReceiptText, Store } from "lucide-react";
import { setPref } from "@/app/actions";
import { cx } from "./ui";

export function PrefSelect({ name, value, options, className }: { name: "lang" | "producer" | "buyer" | "cluster"; value: string; options: { value: string; label: string }[]; className?: string }) {
  const [pending, start] = useTransition();
  return (
    <select
      aria-label={name}
      className={cx("rounded-lg border border-line bg-white px-2 py-1.5 text-xs font-medium text-ink", pending && "opacity-60", className)}
      value={value}
      onChange={(e) => start(() => setPref(name, e.target.value))}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function LangToggle({ lang }: { lang: "hi" | "en" }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      onClick={() => start(() => setPref("lang", lang === "hi" ? "en" : "hi"))}
      className={cx("rounded-lg border border-line bg-white px-2.5 py-1.5 text-xs font-semibold", pending && "opacity-60")}
      aria-label="Switch language"
    >
      {lang === "hi" ? "EN" : "हिं"}
    </button>
  );
}

export function BottomNav({ lang }: { lang: "hi" | "en" }) {
  const path = usePathname();
  const t = (hi: string, en: string) => (lang === "hi" ? hi : en);
  const items = [
    { href: "/app", icon: Home, label: t("होम", "Home") },
    { href: "/app/stock", icon: Package, label: t("स्टॉक", "Stock") },
    { href: "/app/orders", icon: ShoppingBag, label: t("ऑर्डर", "Orders") },
    { href: "/app/catalog", icon: Store, label: t("कैटलॉग", "Catalog") },
    { href: "/app/gst", icon: ReceiptText, label: "GST" },
  ];
  return (
    <nav className="no-print sticky bottom-0 z-20 grid grid-cols-5 border-t border-line bg-white/95 backdrop-blur">
      {items.map(({ href, icon: Icon, label }) => {
        const active = href === "/app" ? path === "/app" : path.startsWith(href);
        return (
          <Link key={href} href={href} className={cx("flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium", active ? "text-brand" : "text-muted")}>
            <Icon size={20} strokeWidth={active ? 2.4 : 1.8} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

/** Read text aloud in Hindi (browser speech synthesis). */
export function speak(text: string, lang: "hi" | "en" = "hi") {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = lang === "hi" ? "hi-IN" : "en-IN";
  const v = window.speechSynthesis.getVoices().find((x) => x.lang.startsWith(lang === "hi" ? "hi" : "en-IN"));
  if (v) u.voice = v;
  u.rate = 0.95;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(u);
}

export function SpeakButton({ text, lang = "hi", children }: { text: string; lang?: "hi" | "en"; children?: ReactNode }) {
  return (
    <button type="button" onClick={() => speak(text, lang)} className="inline-flex items-center gap-1 rounded-lg bg-teal-soft px-2 py-1 text-xs font-semibold text-teal" aria-label="Listen">
      🔊 {children ?? (lang === "hi" ? "सुनें" : "Listen")}
    </button>
  );
}

export function PrintButton({ label = "Print / Save PDF" }: { label?: string }) {
  return (
    <button type="button" onClick={() => window.print()} className="no-print rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white">
      {label}
    </button>
  );
}
