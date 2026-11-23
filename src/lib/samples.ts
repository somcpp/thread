// Sample supplier bills for the demo. Images are rendered from this data by scripts/render-bills.py,
// and the same data is the offline fallback when AI is not available.
import { makeGstin } from "./gst";

export const SUPPLIER_PAN = {
  silk: "AAKFS2286D",
  zari: "AAMFM4821Q",
  cotton: "AABCB7310K",
};

const zariGstin = makeGstin("Gujarat", SUPPLIER_PAN.zari);
const cottonGstin = makeGstin("Madhya Pradesh", SUPPLIER_PAN.cotton);
const ganeshValid = makeGstin("Gujarat", "AAPFG5512M");
// one character mistyped, so the check digit fails
const ganeshTypo = ganeshValid.slice(0, 9) + (ganeshValid[9] === "3" ? "8" : "3") + ganeshValid.slice(10);

export type SampleBill = {
  key: string;
  label: string;
  supplierName: string;
  supplierAddress: string;
  supplierGstin: string;
  supplierState: string;
  billNo: string;
  daysAgo: number;
  items: { description: string; hsn: string; qty: number; unit: string; rate: number; materialKind: "silk" | "zari" | "cotton" }[];
  gstRate: number;
  handwritten?: boolean;
};

export const SAMPLE_BILLS: SampleBill[] = [
  {
    key: "zari",
    label: "Zari bill (Surat)",
    supplierName: "Mahalaxmi Zari Works",
    supplierAddress: "14, Ring Road Textile Market, Surat 395002, Gujarat",
    supplierGstin: zariGstin,
    supplierState: "Gujarat",
    billNo: "MZW/2627/0418",
    daysAgo: 0,
    items: [{ description: "Tested Zari Thread (Gold) 2/30", hsn: "5605", qty: 4, unit: "kg", rate: 9150, materialKind: "zari" }],
    gstRate: 5,
  },
  {
    key: "cotton",
    label: "Cotton yarn bill (Burhanpur)",
    supplierName: "Burhanpur Cotton Yarn Co.",
    supplierAddress: "Lalbagh Road, Burhanpur 450331, Madhya Pradesh",
    supplierGstin: cottonGstin,
    supplierState: "Madhya Pradesh",
    billNo: "BCY-7752",
    daysAgo: 1,
    items: [{ description: "Cotton Yarn 100s Combed (Bleached)", hsn: "5205", qty: 25, unit: "kg", rate: 455, materialKind: "cotton" }],
    gstRate: 5,
    handwritten: true,
  },
  {
    key: "typo",
    label: "Silk bill with a GSTIN error",
    supplierName: "Shree Ganesh Yarn Agency",
    supplierAddress: "Salabatpura, Surat 395003, Gujarat",
    supplierGstin: ganeshTypo,
    supplierState: "Gujarat",
    billNo: "SGY/1193",
    daysAgo: 2,
    items: [{ description: "Mulberry Raw Silk Yarn 20/22 D", hsn: "5004", qty: 3, unit: "kg", rate: 5650, materialKind: "silk" }],
    gstRate: 5,
  },
];

export function billTotals(b: SampleBill, buyerState: string) {
  const taxable = b.items.reduce((a, i) => a + i.qty * i.rate, 0);
  const tax = Math.round(taxable * b.gstRate) / 100;
  const intra = b.supplierState === buyerState;
  return { taxable, cgst: intra ? tax / 2 : 0, sgst: intra ? tax / 2 : 0, igst: intra ? 0 : tax, total: taxable + tax };
}
