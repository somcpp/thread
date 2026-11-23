import Link from "next/link";
import type { ReactNode } from "react";

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx("rounded-2xl border border-line bg-white p-4 shadow-[0_1px_0_rgba(0,0,0,0.03)]", className)}>{children}</div>;
}

const tones = {
  brand: "bg-brand-soft text-brand-dark",
  teal: "bg-teal-soft text-teal",
  red: "bg-red-50 text-red-700",
  amber: "bg-amber-50 text-amber-800",
  green: "bg-emerald-50 text-emerald-700",
  gray: "bg-stone-100 text-stone-600",
  blue: "bg-sky-50 text-sky-700",
};
export type Tone = keyof typeof tones;

export function Badge({ children, tone = "gray", className }: { children: ReactNode; tone?: Tone; className?: string }) {
  return <span className={cx("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium", tones[tone], className)}>{children}</span>;
}

export const btn = {
  primary: "inline-flex items-center justify-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-50 transition",
  teal: "inline-flex items-center justify-center gap-2 rounded-xl bg-teal px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 transition",
  ghost: "inline-flex items-center justify-center gap-2 rounded-xl border border-line bg-white px-4 py-2.5 text-sm font-semibold text-ink hover:bg-stone-50 disabled:opacity-50 transition",
  small: "inline-flex items-center justify-center gap-1.5 rounded-lg border border-line bg-white px-2.5 py-1.5 text-xs font-semibold text-ink hover:bg-stone-50 transition",
};

export function Stat({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: "brand" | "teal" }) {
  return (
    <Card className="p-3.5">
      <div className="text-xs text-muted">{label}</div>
      <div className={cx("mt-1 text-xl font-bold tracking-tight", tone === "brand" && "text-brand", tone === "teal" && "text-teal")}>{value}</div>
      {sub && <div className="mt-0.5 text-xs text-muted">{sub}</div>}
    </Card>
  );
}

export function Bar({ value, tone = "teal" }: { value: number; tone?: "teal" | "red" | "amber" | "brand" }) {
  const color = { teal: "bg-teal", red: "bg-red-500", amber: "bg-amber-500", brand: "bg-brand" }[tone];
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-stone-100">
      <div className={cx("h-full rounded-full", color)} style={{ width: `${Math.max(2, Math.min(100, value * 100))}%` }} />
    </div>
  );
}

export function Avatar({ name, color, size = 40 }: { name: string; color: string; size?: number }) {
  const initials = name.replace(/^(Mohd\.|Md\.)\s*/, "").split(" ").map((s) => s[0]).slice(0, 2).join("");
  return (
    <div className="grid shrink-0 place-items-center rounded-full font-semibold text-white" style={{ background: color, width: size, height: size, fontSize: size * 0.38 }}>
      {initials}
    </div>
  );
}

/** Product visual: photo if uploaded, else a woven swatch generated from the product palette. */
export function ProductArt({ palette, imageUrl, seed = 0, className, label }: { palette: string; imageUrl?: string | null; seed?: number; className?: string; label?: string }) {
  if (imageUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={imageUrl} alt={label ?? ""} className={cx("h-full w-full object-cover", className)} />;
  }
  const [a, b] = palette.split(",");
  const motif = seed % 3;
  return (
    <svg viewBox="0 0 200 200" className={cx("h-full w-full", className)} role="img" aria-label={label}>
      <rect width="200" height="200" fill={a} />
      {Array.from({ length: 20 }).map((_, i) => (
        <rect key={`v${i}`} x={i * 10} y="0" width="1" height="200" fill={b} opacity="0.12" />
      ))}
      {Array.from({ length: 20 }).map((_, i) => (
        <rect key={`h${i}`} x="0" y={i * 10} width="200" height="1" fill={b} opacity="0.08" />
      ))}
      <rect x="0" y="160" width="200" height="22" fill={b} opacity="0.85" />
      <rect x="0" y="166" width="200" height="2" fill={a} opacity="0.6" />
      <rect x="0" y="175" width="200" height="2" fill={a} opacity="0.6" />
      {Array.from({ length: 4 }).map((_, r) =>
        Array.from({ length: 5 }).map((_, c) => {
          const x = 22 + c * 39 + (r % 2) * 19;
          const y = 22 + r * 35;
          return motif === 0 ? (
            <circle key={`${r}-${c}`} cx={x} cy={y} r="5" fill={b} opacity="0.9" />
          ) : motif === 1 ? (
            <path key={`${r}-${c}`} d={`M${x} ${y - 7} L${x + 6} ${y} L${x} ${y + 7} L${x - 6} ${y} Z`} fill={b} opacity="0.9" />
          ) : (
            <g key={`${r}-${c}`} fill={b} opacity="0.9">
              <circle cx={x} cy={y - 5} r="3" />
              <circle cx={x + 5} cy={y} r="3" />
              <circle cx={x} cy={y + 5} r="3" />
              <circle cx={x - 5} cy={y} r="3" />
            </g>
          );
        }),
      )}
    </svg>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-2 mt-6 flex items-end justify-between">
      <h2 className="text-base font-bold">{children}</h2>
      {action}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-xl border border-dashed border-line p-6 text-center text-sm text-muted">{children}</div>;
}

export function NavLink({ href, children, active }: { href: string; children: ReactNode; active?: boolean }) {
  return (
    <Link href={href} className={cx("rounded-lg px-3 py-2 text-sm font-medium", active ? "bg-brand-soft text-brand-dark" : "text-muted hover:text-ink")}>
      {children}
    </Link>
  );
}

export const STATUS_LABEL: Record<string, { en: string; hi: string; tone: Tone }> = {
  QUOTED: { en: "New request", hi: "नई माँग", tone: "amber" },
  CONFIRMED: { en: "Confirmed", hi: "पक्का", tone: "blue" },
  IN_PRODUCTION: { en: "In production", hi: "बन रहा है", tone: "teal" },
  DISPATCHED: { en: "Dispatched", hi: "भेज दिया", tone: "brand" },
  DELIVERED: { en: "Delivered", hi: "पहुँच गया", tone: "green" },
  DECLINED: { en: "Declined", hi: "मना किया", tone: "gray" },
};
