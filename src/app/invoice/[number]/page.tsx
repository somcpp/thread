import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { inr, longDate } from "@/lib/format";
import { STATE_CODES } from "@/lib/gst";
import { PrintButton } from "@/components/client";
import { Logo } from "@/components/logo";

export const dynamic = "force-dynamic";

function words(n: number): string {
  const a = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const b = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  const two = (x: number) => (x < 20 ? a[x] : `${b[Math.floor(x / 10)]}${x % 10 ? " " + a[x % 10] : ""}`);
  const three = (x: number) => (x >= 100 ? `${a[Math.floor(x / 100)]} Hundred${x % 100 ? " " + two(x % 100) : ""}` : two(x));
  n = Math.round(n);
  if (n === 0) return "Zero";
  const parts: string[] = [];
  const crore = Math.floor(n / 1e7), lakh = Math.floor((n % 1e7) / 1e5), th = Math.floor((n % 1e5) / 1e3), rest = n % 1e3;
  if (crore) parts.push(`${two(crore)} Crore`);
  if (lakh) parts.push(`${two(lakh)} Lakh`);
  if (th) parts.push(`${two(th)} Thousand`);
  if (rest) parts.push(three(rest));
  return parts.join(" ");
}

export default async function InvoicePage({ params }: { params: Promise<{ number: string }> }) {
  const { number } = await params;
  const inv = await db.invoice.findUnique({ where: { number: decodeURIComponent(number) }, include: { producer: true, order: true } });
  if (!inv) notFound();
  const p = inv.producer;
  const intra = inv.cgst > 0;
  return (
    <main className="mx-auto max-w-3xl p-4 md:p-8">
      <div className="no-print mb-4 flex items-center justify-between">
        <Link href="/app" className="text-sm text-muted">← Back to app</Link>
        <PrintButton />
      </div>
      <div className="rounded-2xl border border-line bg-white p-6 md:p-10">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs font-bold uppercase tracking-widest text-brand">{inv.kind === "TAX" ? "Tax Invoice" : "Proforma Invoice"}</div>
            <div className="font-display mt-1 text-2xl font-bold">{p.businessName}</div>
            <div className="text-sm text-muted">{p.city}, {p.state} · {p.phone}</div>
            <div className="mt-1 font-mono text-sm">GSTIN: {p.gstin ?? "Unregistered"}</div>
          </div>
          <div className="text-right text-sm">
            <div className="font-mono font-semibold">{inv.number}</div>
            <div className="text-muted">{longDate(inv.issuedAt)}</div>
            {inv.order && <div className="text-muted">Order {inv.order.code}</div>}
          </div>
        </div>
        <div className="thread my-5 rounded-full" />
        <div className="grid gap-4 text-sm md:grid-cols-2">
          <div>
            <div className="text-xs font-semibold uppercase text-muted">Bill to</div>
            <div className="font-semibold">{inv.buyerName}</div>
            <div className="font-mono text-xs">{inv.buyerGstin ? `GSTIN ${inv.buyerGstin}` : "Unregistered buyer (B2C)"}</div>
          </div>
          <div className="md:text-right">
            <div className="text-xs font-semibold uppercase text-muted">Place of supply</div>
            <div>{inv.buyerState} ({STATE_CODES[inv.buyerState] ?? "-"})</div>
            <div className="text-xs text-muted">{intra ? "Intra-state: CGST + SGST" : "Inter-state: IGST"}</div>
          </div>
        </div>
        <table className="mt-6 w-full text-sm">
          <thead>
            <tr className="border-y border-line bg-paper text-left text-xs uppercase text-muted">
              <th className="p-2">Item</th><th className="p-2">HSN</th><th className="p-2 text-right">Qty</th><th className="p-2 text-right">Rate</th><th className="p-2 text-right">Taxable</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-line">
              <td className="p-2">{inv.itemName}</td><td className="p-2 font-mono">{inv.hsn}</td><td className="p-2 text-right">{inv.qty}</td><td className="p-2 text-right">{inr(inv.rate)}</td><td className="p-2 text-right">{inr(inv.taxable)}</td>
            </tr>
          </tbody>
        </table>
        <div className="ml-auto mt-4 w-full max-w-xs space-y-1 text-sm">
          <div className="flex justify-between"><span className="text-muted">Taxable value</span><span>{inr(inv.taxable)}</span></div>
          {intra ? (
            <>
              <div className="flex justify-between"><span className="text-muted">CGST @ {inv.gstRate / 2}%</span><span>{inr(inv.cgst)}</span></div>
              <div className="flex justify-between"><span className="text-muted">SGST @ {inv.gstRate / 2}%</span><span>{inr(inv.sgst)}</span></div>
            </>
          ) : (
            <div className="flex justify-between"><span className="text-muted">IGST @ {inv.gstRate}%</span><span>{inr(inv.igst)}</span></div>
          )}
          <div className="flex justify-between border-t border-line pt-1 text-base font-bold"><span>Total</span><span>{inr(inv.total)}</span></div>
        </div>
        <div className="mt-4 text-xs text-muted">Amount in words: Rupees {words(inv.total)} only</div>
        <div className="mt-10 flex items-end justify-between text-xs text-muted">
          <div className="flex items-center gap-2"><Logo size={20} /> Generated with Sutra</div>
          <div className="text-right">For {p.businessName}<br /><br />Authorised signatory</div>
        </div>
      </div>
    </main>
  );
}
