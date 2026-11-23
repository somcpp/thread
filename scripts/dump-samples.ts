import { SAMPLE_BILLS, billTotals } from "../src/lib/samples";
console.log(JSON.stringify(SAMPLE_BILLS.map((b) => ({ ...b, totals: billTotals(b, "Madhya Pradesh") }))));
