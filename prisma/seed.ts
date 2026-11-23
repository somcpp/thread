/* Realistic demo data for Sutra.
 * Cluster 1: Chanderi handloom (MP), 10 weavers. Hero: Rohit Kushwaha.
 * Cluster 2: Moradabad brass (UP), 3 workshops, used for the "any industry" switch.
 * Run: npx prisma db seed
 */
import { PrismaClient, type Buyer, type Prisma } from "@prisma/client";
import { makeGstin, splitTax } from "../src/lib/gst";
import { SUPPLIER_PAN } from "../src/lib/samples";

const db = new PrismaClient();

let seed = 20261123;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const between = (a: number, b: number) => a + (b - a) * rnd();
const int = (a: number, b: number) => Math.round(between(a, b));
const DAY = 86_400_000;
const NOW = Date.now();
const daysAgo = (d: number) => new Date(NOW - d * DAY);
const daysAhead = (d: number) => new Date(NOW + d * DAY);
const r2 = (n: number) => Math.round(n * 100) / 100;

const L = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
function pan(surname: string, kind = "P") {
  const l = () => L[int(0, 25)];
  return `${l()}${l()}${l()}${kind}${surname[0].toUpperCase()}${int(1000, 9999)}${l()}`;
}

let orderNo = 1001;
const invCounters: Record<string, number> = {};
function invNo(prefix: string, kind: "TAX" | "PROFORMA") {
  const k = prefix + kind;
  invCounters[k] = (invCounters[k] ?? 0) + 1;
  return `${prefix}/${kind === "TAX" ? "" : "PF-"}26-27/${String(invCounters[k]).padStart(4, "0")}`;
}

async function reset() {
  // children first
  await db.message.deleteMany();
  await db.alert.deleteMany();
  await db.ledgerEntry.deleteMany();
  await db.invoice.deleteMany();
  await db.order.deleteMany();
  await db.buyer.deleteMany();
  await db.supplierOrder.deleteMany();
  await db.purchaseItem.deleteMany();
  await db.purchase.deleteMany();
  await db.stockMovement.deleteMany();
  await db.recipeItem.deleteMany();
  await db.product.deleteMany();
  await db.material.deleteMany();
  await db.supplier.deleteMany();
  await db.producer.deleteMany();
  await db.cluster.deleteMany();
}

type MatDef = { key: string; name: string; nameHi: string; unit: string; hsn: string; gst: number; cost: number; supplier: string };
type ProdDef = {
  key: string; name: string; nameHi: string; category: string; price: number; mrp: number; hsn: string; gst: number;
  upmw: number; share: number; recipe: Record<string, number>; story: string;
};

const MOTIFS = ["Asharfi Buti", "Mor (Peacock)", "Nalferma", "Hans (Swan)", "Kamal (Lotus)", "Chatai", "Ambi", "Phool Patti", "Jaal", "Gend"];
const PALETTES = [
  "#7C2D3A,#E9C46A", "#0F766E,#F4D9A6", "#9D174D,#FBCFE8", "#1E3A8A,#FDE68A", "#B45309,#FEF3C7",
  "#4D7C0F,#ECFCCB", "#6D28D9,#EDE9FE", "#BE123C,#FFE4E6", "#155E75,#CFFAFE", "#92400E,#FDE68A",
];

async function main() {
  await reset();

  // ---------------- Suppliers ----------------
  const sup = {
    silk: await db.supplier.create({ data: { name: "Shree Krishna Silk Traders", city: "Surat", state: "Gujarat", phone: "+91 98251 44120", gstin: makeGstin("Gujarat", SUPPLIER_PAN.silk), leadTimeDays: 7 } }),
    zari: await db.supplier.create({ data: { name: "Mahalaxmi Zari Works", city: "Surat", state: "Gujarat", phone: "+91 99099 31876", gstin: makeGstin("Gujarat", SUPPLIER_PAN.zari), leadTimeDays: 10 } }),
    cotton: await db.supplier.create({ data: { name: "Burhanpur Cotton Yarn Co.", city: "Burhanpur", state: "Madhya Pradesh", phone: "+91 94250 66713", gstin: makeGstin("Madhya Pradesh", SUPPLIER_PAN.cotton), leadTimeDays: 4 } }),
    brass: await db.supplier.create({ data: { name: "Jain Metal Sheets", city: "Moradabad", state: "Uttar Pradesh", phone: "+91 97190 22045", gstin: makeGstin("Uttar Pradesh", pan("Jain", "F")), leadTimeDays: 3 } }),
    lacquer: await db.supplier.create({ data: { name: "Rathi Chemicals", city: "New Delhi", state: "Delhi", phone: "+91 98110 57391", gstin: makeGstin("Delhi", pan("Rathi", "C")), leadTimeDays: 5 } }),
    pack: await db.supplier.create({ data: { name: "Moradabad Corrugated Box", city: "Moradabad", state: "Uttar Pradesh", phone: "+91 90127 88104", gstin: makeGstin("Uttar Pradesh", pan("Gupta", "F")), leadTimeDays: 2 } }),
  };
  const supByKey: Record<string, typeof sup.silk> = sup;

  // ---------------- Buyers ----------------
  const buyerDefs = [
    { name: "Anjali Rao", business: "Kaveri Boutique", city: "Bengaluru", state: "Karnataka" },
    { name: "Vikram Singh Shekhawat", business: "Neel Textiles", city: "Jaipur", state: "Rajasthan" },
    { name: "Meher Kapadia", business: "Saanjh Studio", city: "Mumbai", state: "Maharashtra" },
    { name: "Amit Jain", business: "Tanaa Bana Store", city: "Indore", state: "Madhya Pradesh" },
    { name: "Sana Qureshi", business: "Hastkala Exports", city: "New Delhi", state: "Delhi" },
    { name: "Priya Kulkarni", business: "Vastra House", city: "Pune", state: "Maharashtra" },
  ];
  const buyers: Buyer[] = [];
  for (const b of buyerDefs) {
    buyers.push(await db.buyer.create({
      data: { ...b, gstin: makeGstin(b.state, pan(b.business, "F")), phone: `+91 9${int(100000000, 999999999)}` },
    }));
  }
  const buyerBy = (biz: string) => buyers.find((b) => b.business === biz)!;

  // ================= CLUSTER 1: CHANDERI HANDLOOM =================
  const chanderi = await db.cluster.create({
    data: { slug: "chanderi", name: "Chanderi Handloom Cluster", city: "Chanderi", state: "Madhya Pradesh", industry: "handloom" },
  });

  const handloomMats: MatDef[] = [
    { key: "silk", name: "Mulberry silk yarn", nameHi: "रेशम धागा", unit: "kg", hsn: "5004", gst: 5, cost: 5600, supplier: "silk" },
    { key: "cotton", name: "Cotton yarn (100s count)", nameHi: "सूती धागा", unit: "kg", hsn: "5205", gst: 5, cost: 460, supplier: "cotton" },
    { key: "zari", name: "Zari (metallic thread)", nameHi: "ज़री", unit: "kg", hsn: "5605", gst: 5, cost: 9200, supplier: "zari" },
  ];
  const handloomProds: ProdDef[] = [
    { key: "sc-saree", name: "Chanderi Silk-Cotton Saree", nameHi: "चंदेरी सिल्क-कॉटन साड़ी", category: "Silk-Cotton Saree", price: 3200, mrp: 6000, hsn: "5007", gst: 5, upmw: 1.5, share: 0.5,
      recipe: { silk: 0.25, cotton: 0.3, zari: 0.05 },
      story: "Woven on a traditional pit loom, this featherlight silk-cotton saree carries the sheer, glass-like texture Chanderi is famous for. Each motif is hand-inserted with a separate needle, so no two pieces are exactly alike." },
    { key: "silk-saree", name: "Pure Silk Chanderi Saree, Zari Border", nameHi: "शुद्ध रेशम चंदेरी साड़ी, ज़री बॉर्डर", category: "Pure Silk Saree", price: 5400, mrp: 9500, hsn: "5007", gst: 5, upmw: 0.8, share: 0.2,
      recipe: { silk: 0.55, zari: 0.12 },
      story: "A pure mulberry-silk Chanderi with a rich zari border and pallu. It takes close to a week of continuous weaving on one loom, and is finished and checked by hand before dispatch." },
    { key: "dupatta", name: "Chanderi Dupatta", nameHi: "चंदेरी दुपट्टा", category: "Dupatta", price: 850, mrp: 1600, hsn: "5007", gst: 5, upmw: 4, share: 0.15,
      recipe: { silk: 0.1, cotton: 0.12, zari: 0.02 },
      story: "A light, translucent dupatta with scattered hand-woven butis. Pairs with any kurta and is a steady seller for boutiques all year round." },
    { key: "suit", name: "Chanderi Suit Fabric Set (3 pc)", nameHi: "चंदेरी सूट सेट (3 पीस)", category: "Suit Set", price: 1600, mrp: 2800, hsn: "5007", gst: 5, upmw: 2.5, share: 0.15,
      recipe: { silk: 0.15, cotton: 0.35, zari: 0.03 },
      story: "Unstitched kurta, bottom and dupatta fabric woven as one matching set. Popular with boutiques that offer custom tailoring." },
  ];

  const weavers = [
    { slug: "rohit", name: "Rohit Kushwaha", biz: "Kushwaha Handloom", machines: 12, gst: true, all: true, onTime: 0.94, color: "#B4441F",
      story: "Rohit is a third-generation Chanderi weaver. His family has run looms in the old town for over 60 years, and today he employs 12 weavers from his mohalla. He is known for fine butis and clean, even zari work." },
    { slug: "rukhsana", name: "Rukhsana Bano", biz: "Bano Weaves", machines: 6, gst: true, all: false, onTime: 0.91, color: "#9D174D",
      story: "Rukhsana took over her father's looms in 2015 and now trains young women from her neighbourhood. Her dupattas are known for delicate pastel colours." },
    { slug: "mohan", name: "Mohan Koli", biz: "Koli Hathkargha", machines: 8, gst: true, all: true, onTime: 0.88, color: "#0F766E",
      story: "Mohan comes from the Koli weaving community, the original weavers of Chanderi. He specialises in traditional Nalferma and Asharfi butis." },
    { slug: "sitaram", name: "Sitaram Koli", biz: "Sitaram Handloom", machines: 5, gst: true, all: false, onTime: 0.86, color: "#1E3A8A",
      story: "Sitaram runs five looms with his sons. Steady, reliable output of everyday silk-cotton sarees." },
    { slug: "farida", name: "Farida Begum", biz: "Farida Chanderi", machines: 4, gst: true, all: false, onTime: 0.9, color: "#B45309",
      story: "Farida's small unit focuses on dupattas and suit sets with bright, festive colours." },
    { slug: "abdul", name: "Abdul Rehman Ansari", biz: "Rehman Silk House", machines: 10, gst: true, all: true, onTime: 0.92, color: "#4D7C0F",
      story: "Abdul's unit is one of the larger ones in the cluster, known for pure silk sarees with heavy zari borders." },
    { slug: "kamla", name: "Kamla Bai Koli", biz: "Kamla Bai Koli", machines: 3, gst: false, all: false, onTime: 0.84, color: "#6D28D9",
      story: "Kamla Bai has been weaving for 30 years. She works three looms from home with her daughters-in-law." },
    { slug: "ramesh", name: "Ramesh Koli", biz: "Ramesh Weaving Centre", machines: 6, gst: true, all: false, onTime: 0.87, color: "#BE123C",
      story: "Ramesh weaves classic silk-cotton sarees and supplies to two shops in Bhopal." },
    { slug: "shabana", name: "Shabana Ansari", biz: "Shabana Handloom", machines: 4, gst: true, all: false, onTime: 0.89, color: "#155E75",
      story: "Shabana's looms produce fine dupattas with mor (peacock) motifs, her family's signature design." },
    { slug: "gopal", name: "Gopal Vishwakarma", biz: "Vishwakarma Textiles", machines: 7, gst: true, all: true, onTime: 0.9, color: "#92400E",
      story: "Gopal combines handloom tradition with new colour palettes, popular with younger boutique buyers in metros." },
  ];

  for (let wi = 0; wi < weavers.length; wi++) {
    const w = weavers[wi];
    const producer = await db.producer.create({
      data: {
        slug: w.slug, clusterId: chanderi.id, name: w.name, businessName: w.biz, city: "Chanderi", state: "Madhya Pradesh",
        phone: `+91 9${int(100000000, 999999999)}`,
        gstin: w.gst ? makeGstin("Madhya Pradesh", pan(w.name.split(" ").slice(-1)[0])) : null,
        machines: w.machines, story: w.story, avatarColor: w.color, onTimeRate: w.onTime,
        joinedAt: daysAgo(w.slug === "rohit" ? 75 : int(30, 70)), agentCutPct: 25,
      },
    });
    const prodDefs = w.all ? handloomProds : handloomProds.filter((p, i) => i === 0 || (wi + i) % 2 === 0);
    await buildProducer(producer, w.slug, wi, handloomMats, prodDefs, "Madhya Pradesh", w.slug === "rohit");
  }

  // ================= CLUSTER 2: MORADABAD BRASS =================
  const moradabad = await db.cluster.create({
    data: { slug: "moradabad", name: "Moradabad Brass Cluster", city: "Moradabad", state: "Uttar Pradesh", industry: "brass" },
  });
  const brassMats: MatDef[] = [
    { key: "brass", name: "Brass sheet (0.8 mm)", nameHi: "पीतल की चादर", unit: "kg", hsn: "7409", gst: 18, cost: 640, supplier: "brass" },
    { key: "lacquer", name: "Lacquer & polish", nameHi: "लाह और पॉलिश", unit: "litre", hsn: "3208", gst: 18, cost: 380, supplier: "lacquer" },
    { key: "box", name: "Packing box", nameHi: "पैकिंग डिब्बा", unit: "pcs", hsn: "4819", gst: 18, cost: 24, supplier: "pack" },
  ];
  const brassProds: ProdDef[] = [
    { key: "diya", name: "Brass Diya Set (5 pcs)", nameHi: "पीतल दीया सेट (5 पीस)", category: "Diya Set", price: 650, mrp: 1200, hsn: "8306", gst: 5, upmw: 6, share: 0.35,
      recipe: { brass: 0.45, lacquer: 0.02, box: 1 }, story: "Hand-cast and hand-polished brass diyas from Moradabad, the 'Peetal Nagri' of India. Sold as a festive set of five." },
    { key: "urli", name: "Brass Urli Bowl, 12 inch", nameHi: "पीतल उरली, 12 इंच", category: "Urli", price: 1450, mrp: 2800, hsn: "8306", gst: 5, upmw: 2, share: 0.25,
      recipe: { brass: 1.6, lacquer: 0.05, box: 1 }, story: "A wide decorative urli for floating flowers and candles, hand-beaten with an engraved rim." },
    { key: "elephant", name: "Brass Elephant Figurine", nameHi: "पीतल हाथी", category: "Figurine", price: 900, mrp: 1800, hsn: "8306", gst: 5, upmw: 4, share: 0.2,
      recipe: { brass: 0.7, lacquer: 0.03, box: 1 }, story: "Sand-cast brass elephant with hand-chased detailing. A favourite with gift stores and hotels." },
    { key: "thali", name: "Brass Pooja Thali Set", nameHi: "पीतल पूजा थाली सेट", category: "Pooja Thali", price: 1100, mrp: 2100, hsn: "8306", gst: 5, upmw: 3, share: 0.2,
      recipe: { brass: 1.1, lacquer: 0.04, box: 1 }, story: "Complete pooja thali with diya, bell, kalash and incense stand, engraved by hand." },
  ];
  const brassMakers = [
    { slug: "salim", name: "Mohd. Salim", biz: "Salim Brass Works", machines: 8, color: "#B45309",
      story: "Salim runs a workshop of eight karigars in Moradabad's Peetal Basti, making festive and decor brassware for over 20 years." },
    { slug: "naseem", name: "Naseem Ahmed", biz: "Naseem Art Metal", machines: 5, color: "#92400E",
      story: "Naseem specialises in hand-engraved urlis and thalis, a skill passed down in his family." },
    { slug: "rajesh", name: "Rajesh Kumar", biz: "Kumar Handicrafts", machines: 6, color: "#B4441F",
      story: "Rajesh's unit focuses on cast figurines and gift items for hotels and corporate buyers." },
  ];
  for (let i = 0; i < brassMakers.length; i++) {
    const m = brassMakers[i];
    const producer = await db.producer.create({
      data: {
        slug: m.slug, clusterId: moradabad.id, name: m.name, businessName: m.biz, city: "Moradabad", state: "Uttar Pradesh",
        phone: `+91 9${int(100000000, 999999999)}`, gstin: makeGstin("Uttar Pradesh", pan(m.name.split(" ").slice(-1)[0])),
        machines: m.machines, story: m.story, avatarColor: m.color, onTimeRate: between(0.86, 0.95), joinedAt: daysAgo(int(30, 60)), agentCutPct: 22,
      },
    });
    await buildProducer(producer, m.slug, i + 3, brassMats, brassProds, "Uttar Pradesh", false);
  }

  // ---------------- Hero producer extras (Rohit) ----------------
  await rohitExtras();

  // ---------------- helpers ----------------
  async function buildProducer(
    producer: { id: string; businessName: string; state: string; machines: number; joinedAt: Date; agentCutPct: number },
    slug: string, idx: number, mats: MatDef[], prods: ProdDef[], state: string, hero: boolean,
  ) {
    const prefix = producer.businessName.split(/\s+/).map((s) => s[0]).join("").toUpperCase().slice(0, 3);

    // materials
    const matRows: Record<string, { id: string; cost: number; gst: number; supplierId: string; supplierState: string }> = {};
    for (const m of mats) {
      const s = supByKey[m.supplier];
      const scale = producer.machines / 8;
      let stock = r2(({ silk: 9, cotton: 22, zari: 2.4, brass: 260, lacquer: 14, box: 400 } as Record<string, number>)[m.key] * scale * between(0.7, 1.3));
      if (hero && m.key === "zari") stock = 1.1; // low: drives the demo reorder
      if (hero && m.key === "silk") stock = 7.5;
      if (hero && m.key === "cotton") stock = 21;
      const row = await db.material.create({
        data: { producerId: producer.id, supplierId: s.id, name: m.name, nameHi: m.nameHi, unit: m.unit, hsn: m.hsn, gstRate: m.gst, costPerUnit: m.cost, stock },
      });
      matRows[m.key] = { id: row.id, cost: m.cost, gst: m.gst, supplierId: s.id, supplierState: s.state };
    }

    // products
    const totalShare = prods.reduce((a, p) => a + p.share, 0);
    const prodRows: { def: ProdDef; id: string; looms: number }[] = [];
    for (let i = 0; i < prods.length; i++) {
      const p = prods[i];
      const motif = MOTIFS[(idx + i * 3) % MOTIFS.length];
      const isHandloom = mats[0].key === "silk";
      const name = isHandloom && p.key !== "suit" ? `${p.name}: ${motif}` : p.name;
      const priceJitter = 1 + (idx % 3) * 0.04 - 0.04;
      const stock = hero
        ? ({ "sc-saree": 24, "silk-saree": 6, dupatta: 40, suit: 12 } as Record<string, number>)[p.key] ?? 10
        : int(4, 30);
      const row = await db.product.create({
        data: {
          producerId: producer.id, slug: `${slug}-${p.key}`, name, nameHi: p.nameHi, category: p.category,
          story: p.story, price: Math.round((p.price * priceJitter) / 10) * 10, mrp: p.mrp, hsn: p.hsn, gstRate: p.gst,
          stock, unitsPerMachinePerWeek: p.upmw, palette: PALETTES[(idx + i) % PALETTES.length],
          recipe: { create: Object.entries(p.recipe).map(([k, q]) => ({ materialId: matRows[k].id, qtyPerUnit: q })) },
        },
      });
      prodRows.push({ def: p, id: row.id, looms: (producer.machines * p.share) / totalShare });
    }

    // 26 weeks of production + consumption history
    const movements: Prisma.StockMovementCreateManyInput[] = [];
    const weeklyUse: Record<string, number> = {};
    for (let wk = 26; wk >= 1; wk--) {
      const util = between(0.6, 0.85);
      for (const pr of prodRows) {
        const made = Math.max(0, Math.round(pr.looms * pr.def.upmw * util));
        if (!made) continue;
        const at = daysAgo(wk * 7 - int(0, 5));
        movements.push({ producerId: producer.id, productId: pr.id, kind: "PRODUCE", qty: made, source: "seed", createdAt: at });
        for (const [k, q] of Object.entries(pr.def.recipe)) {
          const used = r2(made * q);
          weeklyUse[k] = (weeklyUse[k] ?? 0) + used / 26;
          movements.push({ producerId: producer.id, materialId: matRows[k].id, kind: "CONSUME", qty: -used, source: "seed", createdAt: at });
        }
      }
    }
    await db.stockMovement.createMany({ data: movements });

    // purchases: roughly every 4 weeks per material
    for (const m of mats) {
      for (let wk = 25; wk >= 1; wk -= 4) {
        const qty = r2((weeklyUse[m.key] ?? 1) * 4 * between(0.9, 1.15));
        if (qty <= 0) continue;
        const mr = matRows[m.key];
        const rate = r2(mr.cost * between(0.97, 1.03));
        const t = splitTax(qty * rate, mr.gst, mr.supplierState, state);
        const at = daysAgo(wk * 7 + int(0, 3));
        await db.purchase.create({
          data: {
            producerId: producer.id, supplierId: mr.supplierId, billNo: `${m.key.slice(0, 2).toUpperCase()}-${int(1000, 9999)}`,
            billDate: at, ...t, source: "seed", createdAt: at,
            items: { create: [{ materialId: mr.id, qty, rate, amount: r2(qty * rate) }] },
          },
        });
        await db.stockMovement.create({ data: { producerId: producer.id, materialId: mr.id, kind: "PURCHASE", qty, source: "seed", createdAt: at } });
      }
    }

    // sales: agent sales before joining Sutra, marketplace sales after
    const joinedDaysAgo = Math.round((NOW - producer.joinedAt.getTime()) / DAY);
    for (let d = 175; d >= 6; d -= int(9, 16)) {
      const pr = prodRows[int(0, prodRows.length - 1)];
      const viaSutra = d < joinedDaysAgo && rnd() < 0.8;
      const buyer = viaSutra ? buyers[int(0, buyers.length - 1)] : null;
      const qty = pr.def.key === "dupatta" || pr.def.key === "diya" ? int(15, 45) : int(5, 20);
      const productRow = await db.product.findUniqueOrThrow({ where: { id: pr.id } });
      const rate = viaSutra ? productRow.price : Math.round(productRow.price * (1 - producer.agentCutPct / 100));
      const created = daysAgo(d + int(8, 14));
      const delivered = daysAgo(d);
      const order = await db.order.create({
        data: {
          code: `SUT-${orderNo++}`, producerId: producer.id, productId: pr.id, buyerId: buyer?.id, channel: viaSutra ? "MARKETPLACE" : "AGENT",
          status: "DELIVERED", qty, rate, wantedBy: delivered, fullDate: delivered, createdAt: created, deliveredAt: delivered,
        },
      });
      const bState = buyer?.state ?? state;
      const t = splitTax(qty * rate, productRow.gstRate, state, bState);
      await db.invoice.create({
        data: {
          number: invNo(prefix, "TAX"), kind: "TAX", producerId: producer.id, orderId: order.id,
          buyerName: buyer?.business ?? "Agent: Lalitpur Kapda Mandi", buyerGstin: buyer?.gstin ?? null, buyerState: bState,
          itemName: productRow.name, hsn: productRow.hsn, qty, rate, gstRate: productRow.gstRate, ...t, issuedAt: delivered,
        },
      });
      await db.stockMovement.create({ data: { producerId: producer.id, productId: pr.id, kind: "SALE", qty: -qty, source: "seed", createdAt: delivered } });
      if (viaSutra) await db.producer.update({ where: { id: producer.id }, data: { ordersDone: { increment: 1 } } });
    }
  }

  async function rohitExtras() {
    const rohit = await db.producer.findUniqueOrThrow({ where: { slug: "rohit" }, include: { products: true, materials: true } });
    const dupatta = rohit.products.find((p) => p.slug === "rohit-dupatta")!;
    const silkSaree = rohit.products.find((p) => p.slug === "rohit-silk-saree")!;
    const zari = rohit.materials.find((m) => m.unit === "kg" && m.hsn === "5605")!;
    const neel = buyerBy("Neel Textiles");
    const tanaa = buyerBy("Tanaa Bana Store");

    // Live order in production
    const live = await db.order.create({
      data: {
        code: `SUT-${orderNo++}`, producerId: rohit.id, productId: dupatta.id, buyerId: neel.id, channel: "MARKETPLACE",
        status: "IN_PRODUCTION", qty: 40, rate: dupatta.price, wantedBy: daysAhead(9), promisedQtyByWanted: 40, fullDate: daysAhead(8),
        createdAt: daysAgo(4), quoteNote: "Confirmed: 40 dupattas, mixed pastel colours",
      },
    });
    const t = splitTax(40 * dupatta.price, 5, "Madhya Pradesh", neel.state);
    await db.invoice.create({
      data: {
        number: invNo("KH", "PROFORMA"), kind: "PROFORMA", producerId: rohit.id, orderId: live.id, buyerName: neel.business,
        buyerGstin: neel.gstin, buyerState: neel.state, itemName: dupatta.name, hsn: dupatta.hsn, qty: 40, rate: dupatta.price,
        gstRate: 5, ...t, issuedAt: daysAgo(4),
      },
    });
    await db.message.createMany({
      data: [
        { producerId: rohit.id, orderId: live.id, sender: "BUYER", text: "Hi Rohit ji, can you do 40 dupattas in pastel shades? Need them before our winter sale.", textEn: "Hi Rohit ji, can you do 40 dupattas in pastel shades? Need them before our winter sale.", textHi: "नमस्ते रोहित जी, क्या आप पेस्टल रंगों में 40 दुपट्टे बना सकते हैं? हमें विंटर सेल से पहले चाहिए।", createdAt: daysAgo(5) },
        { producerId: rohit.id, orderId: live.id, sender: "PRODUCER", text: "हाँ, 40 दुपट्टे 8 दिन में तैयार हो जाएंगे।", textHi: "हाँ, 40 दुपट्टे 8 दिन में तैयार हो जाएंगे।", textEn: "Yes, 40 dupattas will be ready in 8 days.", createdAt: daysAgo(4) },
      ],
    });

    // A fresh inquiry waiting in the inbox
    const inquiry = await db.order.create({
      data: {
        code: `SUT-${orderNo++}`, producerId: rohit.id, productId: silkSaree.id, buyerId: tanaa.id, channel: "MARKETPLACE",
        status: "QUOTED", qty: 15, rate: silkSaree.price, wantedBy: daysAhead(20), createdAt: daysAgo(1),
      },
    });
    await db.message.create({
      data: {
        producerId: rohit.id, orderId: inquiry.id, sender: "BUYER",
        text: "Do you have pure silk sarees with a red zari border? We'd like 15 for a wedding collection.",
        textEn: "Do you have pure silk sarees with a red zari border? We'd like 15 for a wedding collection.",
        textHi: "क्या आपके पास लाल ज़री बॉर्डर वाली शुद्ध रेशम साड़ियाँ हैं? हमें शादी के कलेक्शन के लिए 15 चाहिए।",
        createdAt: daysAgo(1),
      },
    });

    // Khata
    await db.ledgerEntry.createMany({
      data: [
        { producerId: rohit.id, party: "Neel Textiles, Jaipur", direction: "RECEIVE", amount: 35700, note: "Advance balance for 40 dupattas", dueDate: daysAhead(10) },
        { producerId: rohit.id, party: "Kaveri Boutique, Bengaluru", direction: "RECEIVE", amount: 21840, note: "Invoice balance (Oct order)", dueDate: daysAgo(3) },
        { producerId: rohit.id, party: "Mahalaxmi Zari Works", direction: "PAY", amount: 18400, note: "Zari, last bill", dueDate: daysAhead(6) },
        { producerId: rohit.id, party: "Weavers' wages (week)", direction: "PAY", amount: 26400, note: "12 looms, weekly wages", dueDate: daysAhead(2) },
        { producerId: rohit.id, party: "Saanjh Studio, Mumbai", direction: "RECEIVE", amount: 16800, note: "Paid via UPI", dueDate: daysAgo(12), settled: true },
      ],
    });

    // Alerts
    await db.alert.createMany({
      data: [
        { producerId: rohit.id, kind: "ORDER", title: "New inquiry from Tanaa Bana Store, Indore", titleHi: "टाना बाना स्टोर, इंदौर से नई पूछताछ",
          body: "15 pure silk sarees with red zari border, needed in 20 days.", bodyHi: "लाल ज़री बॉर्डर वाली 15 शुद्ध रेशम साड़ियाँ, 20 दिन में चाहिए।", href: "/app/orders", createdAt: daysAgo(1) },
        { producerId: rohit.id, kind: "LOW_STOCK", title: "Zari is running low", titleHi: "ज़री कम हो रही है",
          body: `Only ${zari.stock} kg left. At your usage it will finish in about a week.`, bodyHi: `सिर्फ़ ${zari.stock} किलो बची है। लगभग एक हफ़्ते में ख़त्म हो जाएगी।`, href: "/app/stock", createdAt: daysAgo(0.2) },
        { producerId: rohit.id, kind: "PAYMENT", title: "Kaveri Boutique payment is overdue", titleHi: "कावेरी बुटीक का भुगतान बाकी है",
          body: "₹21,840 was due 3 days ago.", bodyHi: "₹21,840 तीन दिन पहले देय था।", href: "/app/khata", createdAt: daysAgo(2) },
      ],
    });
  }

  const counts = {
    producers: await db.producer.count(), products: await db.product.count(), orders: await db.order.count(),
    invoices: await db.invoice.count(), purchases: await db.purchase.count(), movements: await db.stockMovement.count(),
  };
  console.log("Seeded", counts);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => db.$disconnect());
