import "server-only";
import { db } from "./db";
import { validateGstin, round2, STATE_CODES } from "./gst";

export function monthRange(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  return { from: new Date(y, m - 1, 1), to: new Date(y, m, 1) };
}

export function recentMonths(n = 6) {
  const out: string[] = [];
  const d = new Date();
  for (let i = 0; i < n; i++) {
    const x = new Date(d.getFullYear(), d.getMonth() - i, 1);
    out.push(`${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}`);
  }
  return out;
}

export async function gstReport(producerId: string, ym: string) {
  const { from, to } = monthRange(ym);
  const [invoices, purchases] = await Promise.all([
    db.invoice.findMany({ where: { producerId, kind: "TAX", issuedAt: { gte: from, lt: to } }, orderBy: { issuedAt: "asc" } }),
    db.purchase.findMany({ where: { producerId, billDate: { gte: from, lt: to } }, include: { supplier: true }, orderBy: { billDate: "asc" } }),
  ]);
  const sum = <T,>(xs: T[], f: (x: T) => number) => round2(xs.reduce((a, x) => a + f(x), 0));
  const out = { taxable: sum(invoices, (i) => i.taxable), cgst: sum(invoices, (i) => i.cgst), sgst: sum(invoices, (i) => i.sgst), igst: sum(invoices, (i) => i.igst) };
  const okPurchases = purchases.filter((p) => p.gstinValid && validateGstin(p.supplier.gstin).valid);
  const badPurchases = purchases.filter((p) => !okPurchases.includes(p));
  const itc = { cgst: sum(okPurchases, (p) => p.cgst), sgst: sum(okPurchases, (p) => p.sgst), igst: sum(okPurchases, (p) => p.igst) };
  const atRisk = sum(badPurchases, (p) => p.cgst + p.sgst + p.igst);
  const outTotal = out.cgst + out.sgst + out.igst;
  const itcTotal = itc.cgst + itc.sgst + itc.igst;
  const issues = [
    ...badPurchases.map((p) => ({ kind: "BAD_GSTIN" as const, text: `${p.supplier.name} bill ${p.billNo}: GSTIN ${p.supplier.gstin} failed the check`, amount: p.cgst + p.sgst + p.igst })),
    ...invoices.filter((i) => i.buyerGstin && !validateGstin(i.buyerGstin).valid).map((i) => ({ kind: "BAD_BUYER" as const, text: `Invoice ${i.number}: buyer GSTIN looks wrong`, amount: i.cgst + i.sgst + i.igst })),
  ];
  return {
    ym, invoices, purchases, out, itc, atRisk, issues,
    outTotal: round2(outTotal), itcTotal: round2(itcTotal), net: round2(Math.max(0, outTotal - itcTotal)),
    b2b: invoices.filter((i) => i.buyerGstin).length, b2c: invoices.filter((i) => !i.buyerGstin).length,
  };
}

/** A GSTR-1 style JSON (b2b + b2cs sections) a CA can import or review. Simplified for the demo. */
export function gstr1Json(gstin: string | null, ym: string, invoices: Awaited<ReturnType<typeof gstReport>>["invoices"]) {
  const [y, m] = ym.split("-");
  const b2b = new Map<string, { ctin: string; inv: unknown[] }>();
  const b2cs: Record<string, { pos: string; rt: number; txval: number; camt: number; samt: number; iamt: number }> = {};
  for (const i of invoices) {
    const pos = STATE_CODES[i.buyerState] ?? "23";
    if (i.buyerGstin) {
      const e = b2b.get(i.buyerGstin) ?? { ctin: i.buyerGstin, inv: [] };
      e.inv.push({
        inum: i.number, idt: i.issuedAt.toISOString().slice(0, 10).split("-").reverse().join("-"), val: i.total, pos, rchrg: "N", inv_typ: "R",
        itms: [{ num: 1, itm_det: { rt: i.gstRate, txval: i.taxable, camt: i.cgst, samt: i.sgst, iamt: i.igst, csamt: 0 } }],
      });
      b2b.set(i.buyerGstin, e);
    } else {
      const k = `${pos}-${i.gstRate}`;
      b2cs[k] ??= { pos, rt: i.gstRate, txval: 0, camt: 0, samt: 0, iamt: 0 };
      b2cs[k].txval = round2(b2cs[k].txval + i.taxable);
      b2cs[k].camt = round2(b2cs[k].camt + i.cgst);
      b2cs[k].samt = round2(b2cs[k].samt + i.sgst);
      b2cs[k].iamt = round2(b2cs[k].iamt + i.igst);
    }
  }
  return {
    gstin, fp: `${m}${y}`, generated_by: "Sutra (demo export, review before filing)",
    b2b: [...b2b.values()],
    b2cs: Object.values(b2cs).map((x) => ({ sply_ty: x.iamt ? "INTER" : "INTRA", typ: "OE", ...x, csamt: 0 })),
  };
}
