"use server";
// All mutations. Demo identity comes from cookies (see lib/session.ts).
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { db } from "@/lib/db";
import { currentBuyer, currentProducer } from "@/lib/session";
import { validateGstin, splitTax, round2 } from "@/lib/gst";
import { readBill, parseVoice, writeStory, translate, aiEnabled, type Bill } from "@/lib/ai";
import { SAMPLE_BILLS, billTotals } from "@/lib/samples";
import { quote, splitAcrossCluster, materialHealth, type Quote } from "@/lib/engine";
import { DAY, inr, shortDate } from "@/lib/format";

const refresh = () => revalidatePath("/", "layout");

// ------------------------------------------------------------------ prefs

export async function setPref(name: "lang" | "producer" | "buyer" | "cluster", value: string) {
  const c = await cookies();
  c.set(name, value, { path: "/", maxAge: 60 * 60 * 24 * 365 });
  refresh();
}

// ------------------------------------------------------------------ bills

export type ScannedBill = Bill & {
  source: "ai" | "sample";
  gstin: ReturnType<typeof validateGstin>;
  supplierId: string | null;
  supplierKnown: boolean;
  materials: { id: string; name: string; nameHi: string; unit: string }[];
  mathOk: boolean;
};

async function enrichBill(bill: Bill, source: "ai" | "sample"): Promise<ScannedBill> {
  const producer = await currentProducer();
  const materials = await db.material.findMany({ where: { producerId: producer.id }, select: { id: true, name: true, nameHi: true, unit: true } });
  const gstin = validateGstin(bill.supplierGstin);
  const supplier =
    (bill.supplierGstin && (await db.supplier.findFirst({ where: { gstin: bill.supplierGstin.toUpperCase() } }))) ||
    (await db.supplier.findFirst({ where: { name: bill.supplierName } }));
  const itemsSum = bill.items.reduce((a, i) => a + i.qty * i.rate, 0);
  const taxSum = bill.cgst + bill.sgst + bill.igst;
  const mathOk = Math.abs(itemsSum - bill.taxable) < 2 && Math.abs(bill.taxable + taxSum - bill.total) < 2;
  return { ...bill, source, gstin, supplierId: supplier?.id ?? null, supplierKnown: !!supplier, materials, mathOk };
}

function sampleToBill(key: string, materials: { id: string; name: string }[], buyerState: string): Bill | null {
  const s = SAMPLE_BILLS.find((b) => b.key === key);
  if (!s) return null;
  const kindRe = { silk: /silk/i, zari: /zari/i, cotton: /cotton/i };
  const t = billTotals(s, buyerState);
  const date = new Date(Date.now() - s.daysAgo * DAY).toISOString().slice(0, 10);
  return {
    supplierName: s.supplierName, supplierGstin: s.supplierGstin, billNo: s.billNo, billDate: date,
    items: s.items.map((i) => ({
      description: i.description, qty: i.qty, unit: i.unit, rate: i.rate,
      materialId: materials.find((m) => kindRe[i.materialKind].test(m.name))?.id ?? "",
    })),
    taxable: t.taxable, cgst: t.cgst, sgst: t.sgst, igst: t.igst, total: t.total,
  };
}

/** Read a bill photo (uploaded file, or one of the sample bills). Does not save anything. */
export async function scanBill(formData: FormData): Promise<{ ok: true; bill: ScannedBill } | { ok: false; error: string }> {
  const producer = await currentProducer();
  const materials = await db.material.findMany({ where: { producerId: producer.id }, select: { id: true, name: true, unit: true } });
  const sample = formData.get("sample")?.toString();
  const file = formData.get("file");

  let base64: string;
  let mediaType: "image/png" | "image/jpeg" | "image/webp" = "image/jpeg";
  if (sample) {
    const buf = await readFile(path.join(process.cwd(), "public", "samples", `bill-${sample}.jpg`));
    base64 = buf.toString("base64");
  } else if (file instanceof File && file.size > 0) {
    if (file.size > 8 * 1024 * 1024) return { ok: false, error: "Photo is too large (max 8 MB)" };
    base64 = Buffer.from(await file.arrayBuffer()).toString("base64");
    mediaType = file.type === "image/png" ? "image/png" : file.type === "image/webp" ? "image/webp" : "image/jpeg";
  } else return { ok: false, error: "No photo received" };

  const ai = await readBill({ base64, mediaType }, materials);
  if (ai) return { ok: true, bill: await enrichBill(ai, "ai") };
  if (sample) {
    const b = sampleToBill(sample, materials, producer.state);
    if (b) return { ok: true, bill: await enrichBill(b, "sample") };
  }
  return { ok: false, error: aiEnabled() ? "Could not read this bill. Please try a clearer photo." : "AI is off. Use one of the sample bills, or set ANTHROPIC_API_KEY." };
}

export async function saveBill(bill: ScannedBill) {
  const producer = await currentProducer();
  let supplierId = bill.supplierId;
  if (!supplierId) {
    const st = bill.gstin.state ?? producer.state;
    const s = await db.supplier.create({
      data: { name: bill.supplierName, city: "-", state: st, phone: "", gstin: bill.supplierGstin.toUpperCase(), leadTimeDays: 7 },
    });
    supplierId = s.id;
  }
  const items = bill.items.filter((i) => i.materialId && i.qty > 0);
  const purchase = await db.purchase.create({
    data: {
      producerId: producer.id, supplierId, billNo: bill.billNo, billDate: new Date(bill.billDate),
      taxable: bill.taxable, cgst: bill.cgst, sgst: bill.sgst, igst: bill.igst, total: bill.total,
      gstinValid: bill.gstin.valid, source: "bill",
      items: { create: items.map((i) => ({ materialId: i.materialId, qty: i.qty, rate: i.rate, amount: round2(i.qty * i.rate) })) },
    },
  });
  const updated: { name: string; nameHi: string; qty: number; unit: string; stock: number }[] = [];
  for (const i of items) {
    const m = await db.material.update({ where: { id: i.materialId }, data: { stock: { increment: i.qty } } });
    await db.stockMovement.create({ data: { producerId: producer.id, materialId: m.id, kind: "PURCHASE", qty: i.qty, source: "bill", note: bill.billNo } });
    await db.supplierOrder.updateMany({ where: { materialId: m.id, status: "SENT" }, data: { status: "RECEIVED" } });
    updated.push({ name: m.name, nameHi: m.nameHi, qty: i.qty, unit: m.unit, stock: m.stock });
  }
  await db.ledgerEntry.create({
    data: { producerId: producer.id, party: bill.supplierName, direction: "PAY", amount: bill.total, note: `Bill ${bill.billNo}`, dueDate: new Date(Date.now() + 15 * DAY) },
  });
  if (!bill.gstin.valid) {
    await db.alert.create({
      data: {
        producerId: producer.id, kind: "GST", title: `Check GSTIN on ${bill.supplierName} bill`, titleHi: `${bill.supplierName} के बिल का GSTIN जाँचें`,
        body: `GSTIN ${bill.supplierGstin} failed the check. Input tax credit of ${inr(bill.cgst + bill.sgst + bill.igst)} is at risk until the supplier corrects it.`,
        bodyHi: `GSTIN ${bill.supplierGstin} गलत लग रहा है। सप्लायर से सही करवाएँ, वरना ${inr(bill.cgst + bill.sgst + bill.igst)} का टैक्स क्रेडिट नहीं मिलेगा।`,
        href: "/app/gst",
      },
    });
  }
  refresh();
  return { purchaseId: purchase.id, updated, itc: bill.cgst + bill.sgst + bill.igst, itcAtRisk: !bill.gstin.valid };
}

// ------------------------------------------------------------------ voice entries

export type VoicePreview = {
  transcript: string;
  replyHi: string;
  source: "ai" | "rules";
  actions: { kind: string; productId: string; materialId: string; qty: number; amount: number; party: string; label: string; labelHi: string; warning?: string }[];
};

export async function previewVoice(transcript: string): Promise<VoicePreview | null> {
  const producer = await currentProducer();
  const products = await db.product.findMany({ where: { producerId: producer.id }, select: { id: true, name: true, nameHi: true, stock: true } });
  const materials = await db.material.findMany({ where: { producerId: producer.id }, select: { id: true, name: true, nameHi: true, unit: true } });
  const r = await parseVoice(transcript, { products, materials });
  if (!r) return null;
  const actions = r.actions.map((a) => {
    const p = products.find((x) => x.id === a.productId);
    const m = materials.find((x) => x.id === a.materialId);
    const pn = p?.name ?? "";
    switch (a.kind) {
      case "PRODUCE":
        return { ...a, label: `Made ${a.qty} × ${pn}`, labelHi: `${a.qty} ${p?.nameHi ?? ""} बनीं` };
      case "SALE":
        return {
          ...a, label: `Sold ${a.qty} × ${pn}${a.party ? ` to ${a.party}` : ""}`, labelHi: `${a.qty} ${p?.nameHi ?? ""} ${a.party ? a.party + " " : ""}भेजीं`,
          warning: p && p.stock < a.qty ? `Only ${p.stock} in stock` : undefined,
        };
      case "PURCHASE":
        return { ...a, label: `Bought ${a.qty} ${m?.unit ?? ""} ${m?.name ?? ""}`, labelHi: `${a.qty} ${m?.unit ?? ""} ${m?.nameHi ?? ""} ख़रीदा` };
      case "PAYMENT_RECEIVED":
        return { ...a, label: `Received ${inr(a.amount)}${a.party ? ` from ${a.party}` : ""}`, labelHi: `${a.party ? a.party + " से " : ""}${inr(a.amount)} मिले` };
      default:
        return { ...a, label: `Paid ${inr(a.amount)}${a.party ? ` to ${a.party}` : ""}`, labelHi: `${a.party ? a.party + " को " : ""}${inr(a.amount)} दिए` };
    }
  });
  return { transcript, replyHi: r.replyHi, source: aiEnabled() ? "ai" : "rules", actions };
}

export async function applyVoice(preview: VoicePreview) {
  const producer = await currentProducer();
  const results: { text: string; textHi: string; invoice?: string }[] = [];
  for (const a of preview.actions) {
    if (a.kind === "PRODUCE" && a.productId) {
      const p = await db.product.update({ where: { id: a.productId }, data: { stock: { increment: a.qty } }, include: { recipe: true } });
      await db.stockMovement.create({ data: { producerId: producer.id, productId: p.id, kind: "PRODUCE", qty: a.qty, source: "voice" } });
      for (const r of p.recipe) {
        const used = round2(r.qtyPerUnit * a.qty);
        await db.material.update({ where: { id: r.materialId }, data: { stock: { decrement: used } } });
        await db.stockMovement.create({ data: { producerId: producer.id, materialId: r.materialId, kind: "CONSUME", qty: -used, source: "voice" } });
      }
      results.push({ text: `Stock +${a.qty} ${p.name}; raw material used up`, textHi: `${a.qty} ${p.nameHi} स्टॉक में जुड़ीं, धागा घटाया` });
    } else if (a.kind === "SALE" && a.productId) {
      const p = await db.product.findUniqueOrThrow({ where: { id: a.productId } });
      const qty = a.qty;
      const buyer = a.party
        ? await db.buyer.findFirst({ where: { OR: [{ city: { contains: a.party } }, { business: { contains: a.party } }] } })
        : null;
      await db.product.update({ where: { id: p.id }, data: { stock: { decrement: Math.min(qty, p.stock) } } });
      await db.stockMovement.create({ data: { producerId: producer.id, productId: p.id, kind: "SALE", qty: -qty, source: "voice" } });
      const order = await db.order.create({
        data: {
          code: await nextOrderCode(), producerId: producer.id, productId: p.id, buyerId: buyer?.id, channel: "DIRECT", status: "DISPATCHED",
          qty, rate: p.price, wantedBy: new Date(), fullDate: new Date(), quoteNote: `Recorded by voice: "${preview.transcript}"`,
        },
      });
      const inv = await issueInvoice({
        kind: "TAX", producer, orderId: order.id, buyerName: buyer?.business ?? `Customer, ${a.party || producer.city}`, buyerGstin: buyer?.gstin ?? null,
        buyerState: buyer?.state ?? (a.party ? guessState(a.party) : producer.state), product: p, qty, rate: p.price,
      });
      await db.ledgerEntry.create({
        data: { producerId: producer.id, party: buyer?.business ?? `Customer, ${a.party || producer.city}`, direction: "RECEIVE", amount: inv.total, note: `Invoice ${inv.number}`, dueDate: new Date(Date.now() + 15 * DAY) },
      });
      results.push({ text: `GST invoice ${inv.number} created for ${qty} × ${p.name}`, textHi: `${qty} ${p.nameHi} का GST बिल ${inv.number} बन गया`, invoice: inv.number });
    } else if (a.kind === "PURCHASE" && a.materialId) {
      const m = await db.material.update({ where: { id: a.materialId }, data: { stock: { increment: a.qty } } });
      await db.stockMovement.create({ data: { producerId: producer.id, materialId: m.id, kind: "PURCHASE", qty: a.qty, source: "voice" } });
      results.push({ text: `Stock +${a.qty} ${m.unit} ${m.name}`, textHi: `${a.qty} ${m.unit} ${m.nameHi} जुड़ा` });
    } else if (a.kind === "PAYMENT_RECEIVED" || a.kind === "PAYMENT_MADE") {
      const dir = a.kind === "PAYMENT_RECEIVED" ? "RECEIVE" : "PAY";
      const open = await db.ledgerEntry.findFirst({ where: { producerId: producer.id, direction: dir, settled: false, party: { contains: a.party || "" } }, orderBy: { createdAt: "asc" } });
      if (open) await db.ledgerEntry.update({ where: { id: open.id }, data: { settled: true } });
      results.push({ text: `Khata updated: ${inr(a.amount)}`, textHi: `खाता अपडेट: ${inr(a.amount)}` });
    }
  }
  refresh();
  return results;
}

const STATE_BY_CITY: Record<string, string> = {
  Jaipur: "Rajasthan", Bengaluru: "Karnataka", Bangalore: "Karnataka", Mumbai: "Maharashtra", Pune: "Maharashtra",
  Delhi: "Delhi", Indore: "Madhya Pradesh", Bhopal: "Madhya Pradesh",
};
const guessState = (city: string) => STATE_BY_CITY[city] ?? "Madhya Pradesh";

async function nextOrderCode() {
  const last = await db.order.findFirst({ orderBy: { code: "desc" }, select: { code: true } });
  const n = last ? Number(last.code.replace(/\D/g, "")) + 1 : 1001;
  return `SUT-${n}`;
}

async function issueInvoice(i: {
  kind: "TAX" | "PROFORMA"; producer: { id: string; businessName: string; state: string }; orderId?: string;
  buyerName: string; buyerGstin: string | null; buyerState: string;
  product: { name: string; hsn: string; gstRate: number }; qty: number; rate: number;
}) {
  const prefix = i.producer.businessName.split(/\s+/).map((s) => s[0]).join("").toUpperCase().slice(0, 3);
  const count = await db.invoice.count({ where: { producerId: i.producer.id, kind: i.kind } });
  const number = `${prefix}/${i.kind === "TAX" ? "" : "PF-"}26-27/${String(count + 1).padStart(4, "0")}`;
  const t = splitTax(i.qty * i.rate, i.product.gstRate, i.producer.state, i.buyerState);
  return db.invoice.create({
    data: {
      number, kind: i.kind, producerId: i.producer.id, orderId: i.orderId, buyerName: i.buyerName, buyerGstin: i.buyerGstin, buyerState: i.buyerState,
      itemName: i.product.name, hsn: i.product.hsn, qty: i.qty, rate: i.rate, gstRate: i.product.gstRate, ...t,
    },
  });
}

// ------------------------------------------------------------------ stock / reorder

export async function sendReorder(materialId: string, qty: number) {
  const producer = await currentProducer();
  const m = await db.material.findUniqueOrThrow({ where: { id: materialId }, include: { supplier: true } });
  if (!m.supplier) throw new Error("No supplier for this material");
  const message =
    `Namaste ${m.supplier.name} ji, ${producer.businessName} (${producer.city}) se order: ${qty} ${m.unit} ${m.name}. ` +
    `Kripya ${m.supplier.leadTimeDays} din mein bhejein. Dhanyavaad. (Sent via Sutra)`;
  await db.supplierOrder.create({ data: { producerId: producer.id, supplierId: m.supplier.id, materialId: m.id, qty, message } });
  await db.alert.updateMany({ where: { producerId: producer.id, kind: "LOW_STOCK", read: false }, data: { read: true } });
  refresh();
  const phone = m.supplier.phone.replace(/\D/g, "");
  return { message, whatsapp: `https://wa.me/${phone}?text=${encodeURIComponent(message)}`, supplier: m.supplier.name, eta: shortDate(new Date(Date.now() + m.supplier.leadTimeDays * DAY)) };
}

export async function getMaterialHealth() {
  const producer = await currentProducer();
  return materialHealth(producer.id);
}

// ------------------------------------------------------------------ quotes & orders (buyer side)

export type QuoteResult = Quote & {
  cluster?: { name: string; covered: number; rows: { producerName: string; assigned: number; capacityByDate: number }[] } | null;
};

export async function getQuote(productId: string, qty: number, wantedBy: string): Promise<QuoteResult> {
  const q = await quote(productId, Math.max(1, Math.round(qty)), new Date(wantedBy));
  let cluster: QuoteResult["cluster"] = null;
  if (!q.canMeet) {
    const p = await db.product.findUniqueOrThrow({ where: { id: productId }, include: { producer: { include: { cluster: true } } } });
    const s = await splitAcrossCluster(p.producer.clusterId, p.category, q.qty, new Date(wantedBy), p.producerId);
    cluster = { name: p.producer.cluster.name, covered: s.covered, rows: s.rows.filter((r) => r.assigned > 0).map((r) => ({ producerName: r.producerName, assigned: r.assigned, capacityByDate: r.capacityByDate })) };
  }
  return { ...q, cluster };
}

export async function requestOrder(input: { productId: string; qty: number; wantedBy: string; note: string }) {
  const buyer = await currentBuyer();
  const p = await db.product.findUniqueOrThrow({ where: { id: input.productId }, include: { producer: true } });
  const q = await quote(p.id, input.qty, new Date(input.wantedBy));
  const order = await db.order.create({
    data: {
      code: await nextOrderCode(), producerId: p.producerId, productId: p.id, buyerId: buyer.id, channel: "MARKETPLACE", status: "QUOTED",
      qty: input.qty, rate: p.price, wantedBy: new Date(input.wantedBy), promisedQtyByWanted: q.qtyByWanted, fullDate: q.fullDate,
      quoteNote: input.note || null,
    },
  });
  const pf = await issueInvoice({
    kind: "PROFORMA", producer: p.producer, orderId: order.id, buyerName: buyer.business, buyerGstin: buyer.gstin, buyerState: buyer.state,
    product: p, qty: input.qty, rate: p.price,
  });
  const text = input.note?.trim() || `Hello, we would like ${input.qty} pieces of ${p.name} by ${shortDate(input.wantedBy)}.`;
  const hi = (await translate(text, "hi")) ?? `${buyer.business} (${buyer.city}) को ${shortDate(input.wantedBy, "hi")} तक ${input.qty} ${p.nameHi} चाहिए।`;
  await db.message.create({ data: { producerId: p.producerId, orderId: order.id, sender: "BUYER", text, textEn: text, textHi: hi } });
  const short = q.shortfalls.filter((s) => s.needQty > 0);
  await db.alert.create({
    data: {
      producerId: p.producerId, kind: "ORDER",
      title: `New order request: ${input.qty} × ${p.name} from ${buyer.business}, ${buyer.city}`,
      titleHi: `${buyer.city} से नया ऑर्डर: ${input.qty} ${p.nameHi}`,
      body: `Wanted by ${shortDate(input.wantedBy)}. You can do ${q.qtyByWanted} by then.${short.length ? ` Need more ${short.map((s) => s.name).join(", ")}.` : ""}`,
      bodyHi: `${shortDate(input.wantedBy, "hi")} तक चाहिए। आप तब तक ${q.qtyByWanted} बना सकते हैं।${short.length ? ` ${short.map((s) => s.nameHi).join(", ")} कम है, मँगवाना होगा।` : ""}`,
      href: `/app/orders/${order.code}`,
    },
  });
  refresh();
  return { code: order.code, proforma: pf.number, qtyByWanted: q.qtyByWanted, fullDate: q.fullDate };
}

/** Bulk order split across the cluster: one order per producer, linked by parentId. */
export async function requestClusterOrder(input: { productId: string; qty: number; wantedBy: string }) {
  const buyer = await currentBuyer();
  const p = await db.product.findUniqueOrThrow({ where: { id: input.productId }, include: { producer: true } });
  const split = await splitAcrossCluster(p.producer.clusterId, p.category, input.qty, new Date(input.wantedBy), p.producerId);
  const parent = await nextOrderCode();
  const codes: string[] = [];
  for (const r of split.rows.filter((x) => x.assigned > 0)) {
    const prod = await db.product.findUniqueOrThrow({ where: { id: r.productId }, include: { producer: true } });
    const code = codes.length === 0 ? parent : await nextOrderCode();
    await db.order.create({
      data: {
        code, producerId: prod.producerId, productId: prod.id, buyerId: buyer.id, channel: "MARKETPLACE", status: "QUOTED",
        qty: r.assigned, rate: prod.price, wantedBy: new Date(input.wantedBy), promisedQtyByWanted: r.assigned, fullDate: new Date(input.wantedBy),
        parentId: parent, quoteNote: `Part of cluster order ${parent} (${input.qty} total)`,
      },
    });
    await db.alert.create({
      data: {
        producerId: prod.producerId, kind: "ORDER", title: `Cluster order: ${r.assigned} × ${prod.name} for ${buyer.business}`,
        titleHi: `क्लस्टर ऑर्डर: ${r.assigned} ${prod.nameHi}`, body: `Your share of a ${input.qty}-piece order, due ${shortDate(input.wantedBy)}.`,
        bodyHi: `${input.qty} पीस के बड़े ऑर्डर में आपका हिस्सा, ${shortDate(input.wantedBy, "hi")} तक।`, href: `/app/orders/${code}`,
      },
    });
    codes.push(code);
  }
  refresh();
  return { parent, codes, covered: split.covered };
}

// ------------------------------------------------------------------ orders (producer side)

export async function respondToOrder(code: string, accept: boolean) {
  const producer = await currentProducer();
  const o = await db.order.findUniqueOrThrow({ where: { code }, include: { product: true, buyer: true } });
  if (o.producerId !== producer.id) throw new Error("Not your order");
  await db.order.update({ where: { id: o.id }, data: { status: accept ? "IN_PRODUCTION" : "DECLINED" } });
  const textHi = accept
    ? `ऑर्डर मंज़ूर। ${o.promisedQtyByWanted ?? o.qty} पीस ${shortDate(o.wantedBy, "hi")} तक, पूरे ${o.qty} ${shortDate(o.fullDate, "hi")} तक।`
    : "माफ़ कीजिए, इस बार यह ऑर्डर नहीं ले पाएँगे।";
  const textEn = accept
    ? `Order accepted. ${o.promisedQtyByWanted ?? o.qty} pieces by ${shortDate(o.wantedBy)}, all ${o.qty} by ${shortDate(o.fullDate)}.`
    : "Sorry, we can't take this order right now.";
  await db.message.create({ data: { producerId: producer.id, orderId: o.id, sender: "PRODUCER", text: textHi, textHi, textEn } });
  await db.alert.updateMany({ where: { producerId: producer.id, href: `/app/orders/${code}` }, data: { read: true } });
  refresh();
}

export async function advanceOrder(code: string) {
  const producer = await currentProducer();
  const o = await db.order.findUniqueOrThrow({ where: { code }, include: { product: true, buyer: true } });
  if (o.producerId !== producer.id) throw new Error("Not your order");
  const next = { CONFIRMED: "IN_PRODUCTION", IN_PRODUCTION: "DISPATCHED", DISPATCHED: "DELIVERED" }[o.status];
  if (!next) return;
  await db.order.update({ where: { id: o.id }, data: { status: next, deliveredAt: next === "DELIVERED" ? new Date() : undefined } });
  if (next === "DISPATCHED") {
    await db.product.update({ where: { id: o.productId }, data: { stock: { decrement: Math.min(o.qty, o.product.stock) } } });
    await db.stockMovement.create({ data: { producerId: producer.id, productId: o.productId, kind: "SALE", qty: -o.qty, source: "app", note: o.code } });
    const inv = await issueInvoice({
      kind: "TAX", producer, orderId: o.id, buyerName: o.buyer?.business ?? "Customer", buyerGstin: o.buyer?.gstin ?? null,
      buyerState: o.buyer?.state ?? producer.state, product: o.product, qty: o.qty, rate: o.rate,
    });
    await db.ledgerEntry.create({
      data: { producerId: producer.id, party: o.buyer ? `${o.buyer.business}, ${o.buyer.city}` : "Customer", direction: "RECEIVE", amount: inv.total, note: `Invoice ${inv.number}`, dueDate: new Date(Date.now() + 15 * DAY) },
    });
  }
  if (next === "DELIVERED") await db.producer.update({ where: { id: producer.id }, data: { ordersDone: { increment: 1 } } });
  refresh();
}

export async function sendMessage(code: string, text: string, as: "PRODUCER" | "BUYER") {
  const o = await db.order.findUniqueOrThrow({ where: { code } });
  const clean = text.trim().slice(0, 1000);
  if (!clean) return;
  const other = await translate(clean, as === "PRODUCER" ? "en" : "hi");
  await db.message.create({
    data: {
      producerId: o.producerId, orderId: o.id, sender: as, text: clean,
      textHi: as === "PRODUCER" ? clean : other ?? clean, textEn: as === "BUYER" ? clean : other ?? clean,
    },
  });
  refresh();
}

// ------------------------------------------------------------------ catalog

export async function draftStory(formData: FormData) {
  const producer = await currentProducer();
  const note = formData.get("note")?.toString() ?? "";
  const category = formData.get("category")?.toString() ?? "Product";
  const file = formData.get("photo");
  let image: { base64: string; mediaType: "image/png" | "image/jpeg" | "image/webp" } | undefined;
  if (file instanceof File && file.size > 0 && file.size < 8 * 1024 * 1024) {
    image = { base64: Buffer.from(await file.arrayBuffer()).toString("base64"), mediaType: file.type === "image/png" ? "image/png" : file.type === "image/webp" ? "image/webp" : "image/jpeg" };
  }
  const cluster = await db.cluster.findUniqueOrThrow({ where: { id: producer.clusterId } });
  return writeStory({ note, category, producer: producer.name, cluster: cluster.city, image });
}

export async function publishProduct(formData: FormData) {
  const producer = await currentProducer();
  const get = (k: string) => formData.get(k)?.toString() ?? "";
  const template = await db.product.findFirst({ where: { producerId: producer.id, category: get("category") }, include: { recipe: true } });
  let imageUrl: string | null = null;
  const file = formData.get("photo");
  if (file instanceof File && file.size > 0 && file.size < 8 * 1024 * 1024) {
    const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
    const name = `${producer.slug}-${Date.now()}.${ext}`;
    const dir = path.join(process.cwd(), "public", "uploads");
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, name), Buffer.from(await file.arrayBuffer()));
    imageUrl = `/uploads/${name}`;
  }
  const price = Number(get("price")) || template?.price || 1000;
  const p = await db.product.create({
    data: {
      producerId: producer.id, slug: `${producer.slug}-${Date.now().toString(36)}`, name: get("title") || get("category"),
      nameHi: get("nameHi") || get("title"), category: get("category"), story: get("story"), price, mrp: Math.round(price * 1.85),
      hsn: template?.hsn ?? "5007", gstRate: template?.gstRate ?? 5, stock: Number(get("stock")) || 0,
      unitsPerMachinePerWeek: template?.unitsPerMachinePerWeek ?? 1.5, imageUrl,
      palette: template?.palette ?? "#B4441F,#F4D9A6",
      recipe: template ? { create: template.recipe.map((r) => ({ materialId: r.materialId, qtyPerUnit: r.qtyPerUnit })) } : undefined,
    },
  });
  refresh();
  return { slug: p.slug };
}

// ------------------------------------------------------------------ khata

export async function settleEntry(id: string) {
  const producer = await currentProducer();
  await db.ledgerEntry.updateMany({ where: { id, producerId: producer.id }, data: { settled: true } });
  refresh();
}

export async function markAlertsRead() {
  const producer = await currentProducer();
  await db.alert.updateMany({ where: { producerId: producer.id, read: false }, data: { read: true } });
  refresh();
}

// ------------------------------------------------------------------ cluster

export async function planClusterSplit(clusterId: string, category: string, qty: number, wantedBy: string) {
  return splitAcrossCluster(clusterId, category, Math.max(1, Math.round(qty)), new Date(wantedBy));
}
