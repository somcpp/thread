// GST helpers: GSTIN validation (official mod-36 checksum), state codes, tax split.

const CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

export const STATE_CODES: Record<string, string> = {
  "Jammu and Kashmir": "01",
  "Himachal Pradesh": "02",
  Punjab: "03",
  Chandigarh: "04",
  Uttarakhand: "05",
  Haryana: "06",
  Delhi: "07",
  Rajasthan: "08",
  "Uttar Pradesh": "09",
  Bihar: "10",
  "West Bengal": "19",
  Odisha: "21",
  Chhattisgarh: "22",
  "Madhya Pradesh": "23",
  Gujarat: "24",
  Maharashtra: "27",
  Karnataka: "29",
  Goa: "30",
  Kerala: "32",
  "Tamil Nadu": "33",
  Telangana: "36",
  "Andhra Pradesh": "37",
};

const CODE_TO_STATE = Object.fromEntries(Object.entries(STATE_CODES).map(([s, c]) => [c, s]));

export function gstinChecksum(first14: string): string {
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    const v = CHARS.indexOf(first14[i]);
    const p = v * (i % 2 === 0 ? 1 : 2);
    sum += Math.floor(p / 36) + (p % 36);
  }
  return CHARS[(36 - (sum % 36)) % 36];
}

export type GstinCheck = { valid: boolean; reason?: string; state?: string };

export function validateGstin(raw: string | null | undefined): GstinCheck {
  const g = (raw ?? "").trim().toUpperCase();
  if (g.length !== 15) return { valid: false, reason: "GSTIN must be 15 characters" };
  if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(g))
    return { valid: false, reason: "Format is wrong (should look like 23ABCDE1234F1Z5)" };
  const state = CODE_TO_STATE[g.slice(0, 2)];
  if (!state) return { valid: false, reason: `Unknown state code ${g.slice(0, 2)}` };
  if (gstinChecksum(g.slice(0, 14)) !== g[14])
    return { valid: false, reason: "Check digit does not match: likely a typo or a fake GSTIN", state };
  return { valid: true, state };
}

/** Build a valid GSTIN for seed data. pan = 10 chars. */
export function makeGstin(state: string, pan: string, entity = "1"): string {
  const first14 = `${STATE_CODES[state]}${pan}${entity}Z`;
  return first14 + gstinChecksum(first14);
}

export type TaxSplit = { taxable: number; cgst: number; sgst: number; igst: number; total: number };

/** Intra-state supply -> CGST + SGST. Inter-state -> IGST. */
export function splitTax(taxable: number, ratePct: number, sellerState: string, buyerState: string): TaxSplit {
  const tax = round2((taxable * ratePct) / 100);
  if (sellerState === buyerState) {
    const half = round2(tax / 2);
    return { taxable: round2(taxable), cgst: half, sgst: half, igst: 0, total: round2(taxable + half * 2) };
  }
  return { taxable: round2(taxable), cgst: 0, sgst: 0, igst: tax, total: round2(taxable + tax) };
}

export const round2 = (n: number) => Math.round(n * 100) / 100;
