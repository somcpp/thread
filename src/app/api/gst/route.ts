import { currentProducer } from "@/lib/session";
import { gstReport, gstr1Json, recentMonths } from "@/lib/gst-report";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const months = recentMonths(12);
  const ym = months.includes(url.searchParams.get("m") ?? "") ? url.searchParams.get("m")! : months[0];
  const p = await currentProducer();
  const r = await gstReport(p.id, ym);
  const base = `${p.slug}-gst-${ym}`;

  if (url.searchParams.get("format") === "json") {
    return new Response(JSON.stringify(gstr1Json(p.gstin, ym, r.invoices), null, 2), {
      headers: { "content-type": "application/json", "content-disposition": `attachment; filename="${base}-gstr1.json"` },
    });
  }
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const rows: unknown[][] = [
    ["Type", "Number", "Date", "Party", "Party GSTIN", "Place of supply", "Item", "HSN", "Qty", "Rate", "Taxable", "GST %", "CGST", "SGST", "IGST", "Total", "GSTIN OK"],
    ...r.invoices.map((i) => ["SALE", i.number, i.issuedAt.toISOString().slice(0, 10), i.buyerName, i.buyerGstin, i.buyerState, i.itemName, i.hsn, i.qty, i.rate, i.taxable, i.gstRate, i.cgst, i.sgst, i.igst, i.total, ""]),
    ...r.purchases.map((x) => ["PURCHASE", x.billNo, x.billDate.toISOString().slice(0, 10), x.supplier.name, x.supplier.gstin, x.supplier.state, "", "", "", "", x.taxable, "", x.cgst, x.sgst, x.igst, x.total, x.gstinValid ? "yes" : "NO"]),
    [],
    ["Summary", ym, "", "", "", "", "", "", "", "", "Output tax", r.outTotal, "ITC", r.itcTotal, "Net payable", r.net],
  ];
  const csv = "﻿" + rows.map((row) => row.map(esc).join(",")).join("\r\n");
  return new Response(csv, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="${base}.csv"` } });
}
