// Sutra's planning engine: reorder prediction, "Can Deliver" quotes, cluster order split.
// Pure functions over data loaded from the DB, so they are easy to test and explain.
import { db } from "./db";
import { DAY } from "./format";

const OPEN = ["CONFIRMED", "IN_PRODUCTION"];
/** Share of looms we promise to a new order; the rest keeps regular customers served. */
export const ALLOCATION = 0.8;
const SAFETY_DAYS = 2;

// ---------------------------------------------------------------- reorder

export type MaterialHealth = {
  id: string;
  name: string;
  nameHi: string;
  unit: string;
  stock: number;
  costPerUnit: number;
  usagePerDay: number;
  daysLeft: number; // Infinity if unused
  leadTimeDays: number;
  supplierName: string;
  supplierPhone: string;
  supplierId: string | null;
  status: "CRITICAL" | "LOW" | "OK";
  reorderBy: Date | null;
  suggestedQty: number;
};

export async function materialHealth(producerId: string): Promise<MaterialHealth[]> {
  const since = new Date(Date.now() - 28 * DAY);
  const mats = await db.material.findMany({
    where: { producerId },
    include: { supplier: true, movements: { where: { kind: "CONSUME", createdAt: { gte: since } } } },
    orderBy: { name: "asc" },
  });
  return mats.map((m) => {
    const used = m.movements.reduce((a, x) => a + Math.abs(x.qty), 0);
    const usagePerDay = used / 28;
    const daysLeft = usagePerDay > 0 ? m.stock / usagePerDay : Infinity;
    const lead = m.supplier?.leadTimeDays ?? 7;
    const status = daysLeft <= lead + SAFETY_DAYS ? "CRITICAL" : daysLeft <= lead + 10 ? "LOW" : "OK";
    const reorderBy = Number.isFinite(daysLeft)
      ? new Date(Date.now() + Math.max(0, daysLeft - lead - SAFETY_DAYS) * DAY)
      : null;
    return {
      id: m.id, name: m.name, nameHi: m.nameHi, unit: m.unit, stock: m.stock, costPerUnit: m.costPerUnit,
      usagePerDay, daysLeft, leadTimeDays: lead, supplierName: m.supplier?.name ?? "-", supplierPhone: m.supplier?.phone ?? "",
      supplierId: m.supplierId, status, reorderBy,
      suggestedQty: roundQty(Math.max(usagePerDay * 30, 0)),
    };
  });
}

function roundQty(q: number) {
  if (q >= 50) return Math.ceil(q / 5) * 5;
  if (q >= 5) return Math.ceil(q);
  return Math.ceil(q * 10) / 10;
}

// ---------------------------------------------------------------- quote

export type Shortfall = {
  materialId: string;
  name: string;
  nameHi: string;
  unit: string;
  needQty: number; // extra to buy for this order
  supplierName: string;
  supplierId: string | null;
  leadTimeDays: number;
  orderBy: Date; // order by this date to avoid a pause
  late: boolean; // even ordering today causes a pause
};

export type Quote = {
  productId: string;
  productName: string;
  producerId: string;
  qty: number;
  wantedBy: Date;
  ready: number; // finished stock free for this order
  perDay: number; // units/day we can make for this order
  backlogDays: number; // days of looms already booked
  qtyByWanted: number;
  fullDate: Date | null;
  canMeet: boolean;
  shortfalls: Shortfall[];
  curve: { date: string; units: number }[];
};

export async function quote(productId: string, qty: number, wantedBy: Date): Promise<Quote> {
  const product = await db.product.findUniqueOrThrow({
    where: { id: productId },
    include: { recipe: { include: { material: { include: { supplier: true } } } }, producer: true },
  });
  const producer = product.producer;

  // open orders book looms and stock first
  const open = await db.order.findMany({ where: { producerId: producer.id, status: { in: OPEN } }, include: { product: true } });
  let reservedSame = 0;
  let backlogLoomDays = 0;
  for (const o of open) {
    const fromStock = Math.min(o.qty, o.product.stock);
    if (o.productId === productId) reservedSame += fromStock;
    backlogLoomDays += ((o.qty - fromStock) * 7) / o.product.unitsPerMachinePerWeek;
  }
  const ready = Math.max(0, product.stock - reservedSame);
  const looms = producer.machines * ALLOCATION;
  const perDay = (looms * product.unitsPerMachinePerWeek) / 7;
  const backlogDays = backlogLoomDays / Math.max(1, producer.machines);

  const toMake = Math.max(0, qty - ready);

  // materials: how many units can current stock support?
  const shortfalls: Shortfall[] = [];
  let unitsFromStock = Infinity;
  let resumeDay = 0; // day production can continue past the material limit
  for (const r of product.recipe) {
    const can = r.material.stock / r.qtyPerUnit;
    unitsFromStock = Math.min(unitsFromStock, can);
    const need = toMake * r.qtyPerUnit - r.material.stock;
    if (need > 0) {
      const lead = r.material.supplier?.leadTimeDays ?? 7;
      const runOutDay = backlogDays + can / perDay;
      const orderByDay = runOutDay - lead;
      shortfalls.push({
        materialId: r.materialId, name: r.material.name, nameHi: r.material.nameHi, unit: r.material.unit,
        needQty: roundQty(need * 1.05), supplierName: r.material.supplier?.name ?? "-", supplierId: r.material.supplierId,
        leadTimeDays: lead, orderBy: new Date(Date.now() + Math.max(0, orderByDay) * DAY), late: orderByDay < 0,
      });
      resumeDay = Math.max(resumeDay, lead);
    }
  }

  // day-by-day simulation
  const curve: { date: string; units: number }[] = [];
  let made = 0;
  let fullDay: number | null = toMake === 0 ? 0 : null;
  const horizon = Math.max(Math.ceil((wantedBy.getTime() - Date.now()) / DAY) + 10, 30);
  let qtyByWanted = Math.min(qty, ready);
  const wantedDay = (wantedBy.getTime() - Date.now()) / DAY;
  for (let d = 1; d <= 400; d++) {
    const working = d > backlogDays;
    const materialBlocked = made >= unitsFromStock && d <= resumeDay;
    if (working && !materialBlocked && made < toMake) made = Math.min(toMake, made + perDay);
    const total = Math.min(qty, Math.floor(ready + made));
    if (d <= wantedDay) qtyByWanted = total;
    if (fullDay === null && total >= qty) fullDay = d;
    if (d <= horizon) curve.push({ date: new Date(Date.now() + d * DAY).toISOString().slice(0, 10), units: total });
    if (fullDay !== null && d > horizon) break;
  }

  return {
    productId, productName: product.name, producerId: producer.id, qty, wantedBy, ready, perDay, backlogDays,
    qtyByWanted, fullDate: fullDay === null ? null : new Date(Date.now() + fullDay * DAY),
    canMeet: qtyByWanted >= qty, shortfalls, curve,
  };
}

// ---------------------------------------------------------------- cluster split

export type SplitRow = {
  producerId: string;
  producerName: string;
  businessName: string;
  productId: string;
  productName: string;
  machines: number;
  capacityByDate: number;
  assigned: number;
};

/** Split a bulk order across producers in a cluster who make the same category. */
export async function splitAcrossCluster(clusterId: string, category: string, qty: number, wantedBy: Date, preferProducerId?: string) {
  const products = await db.product.findMany({
    where: { category, published: true, producer: { clusterId } },
    include: { producer: true },
  });
  const rows: SplitRow[] = [];
  for (const p of products) {
    const q = await quote(p.id, 100000, wantedBy); // ask "how many can you do by this date?"
    rows.push({
      producerId: p.producerId, producerName: p.producer.name, businessName: p.producer.businessName,
      productId: p.id, productName: p.name, machines: p.producer.machines, capacityByDate: q.qtyByWanted, assigned: 0,
    });
  }
  rows.sort((a, b) => b.capacityByDate - a.capacityByDate);
  const totalCapacity = rows.reduce((a, r) => a + r.capacityByDate, 0);
  let left = qty;
  // the maker the buyer picked gets their full capacity first
  const preferred = rows.find((r) => r.producerId === preferProducerId);
  if (preferred) {
    preferred.assigned = Math.min(preferred.capacityByDate, left);
    left -= preferred.assigned;
  }
  // the rest is split in proportion to free capacity, so nobody is overloaded
  const others = rows.filter((r) => r !== preferred);
  const otherCap = others.reduce((a, r) => a + r.capacityByDate, 0);
  const toShare = left;
  for (const r of others) {
    if (left <= 0) break;
    const share = otherCap > 0 ? Math.round((r.capacityByDate / otherCap) * toShare) : 0;
    r.assigned = Math.min(r.capacityByDate, share, left);
    left -= r.assigned;
  }
  for (const r of others) {
    if (left <= 0) break;
    const extra = Math.min(r.capacityByDate - r.assigned, left);
    r.assigned += extra;
    left -= extra;
  }
  const ordered = preferred ? [preferred, ...others] : others;
  return { rows: ordered.filter((r) => r.capacityByDate > 0), totalCapacity, covered: qty - left, qty };
}
