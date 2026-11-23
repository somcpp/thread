const inrFmt = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
export const inr = (n: number) => inrFmt.format(Math.round(n));

const numFmt = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 1 });
export const num = (n: number) => numFmt.format(n);

export const DAY = 86_400_000;
/** Request time (server components render once per request). */
export const now = () => Date.now();
export const daysAheadISO = (d: number) => new Date(now() + d * DAY).toISOString().slice(0, 10);

export function shortDate(d: Date | string | null | undefined, lang: "hi" | "en" = "en") {
  if (!d) return "-";
  return new Date(d).toLocaleDateString(lang === "hi" ? "hi-IN" : "en-IN", { day: "numeric", month: "short" });
}

export function longDate(d: Date | string | null | undefined) {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export function daysFromNow(d: Date | string) {
  return Math.round((new Date(d).getTime() - Date.now()) / DAY);
}

export function ago(d: Date | string, lang: "hi" | "en" = "en") {
  const mins = Math.round((Date.now() - new Date(d).getTime()) / 60000);
  if (mins < 60) return lang === "hi" ? `${Math.max(1, mins)} मिनट पहले` : `${Math.max(1, mins)} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return lang === "hi" ? `${hrs} घंटे पहले` : `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  return lang === "hi" ? `${days} दिन पहले` : `${days}d ago`;
}
