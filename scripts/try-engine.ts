import { db } from "../src/lib/db";
import { quote, materialHealth, splitAcrossCluster } from "../src/lib/engine";
(async () => {
  const rohit = await db.producer.findUniqueOrThrow({ where: { slug: "rohit" } });
  console.table((await materialHealth(rohit.id)).map(m => ({ n: m.name, stock: m.stock, perDay: m.usagePerDay.toFixed(2), daysLeft: m.daysLeft.toFixed(1), status: m.status })));
  const p = await db.product.findUniqueOrThrow({ where: { slug: "rohit-sc-saree" } });
  const q = await quote(p.id, 200, new Date(Date.now() + 22 * 864e5));
  console.log({ ready: q.ready, perDay: q.perDay.toFixed(2), backlog: q.backlogDays.toFixed(1), byWanted: q.qtyByWanted, full: q.fullDate, short: q.shortfalls.map(s => [s.name, s.needQty, s.orderBy.toDateString(), s.late]) });
  const s = await splitAcrossCluster(rohit.clusterId, "Silk-Cotton Saree", 1000, new Date(Date.now() + 30 * 864e5));
  console.log(s.covered, s.totalCapacity); console.table(s.rows.map(r => ({ n: r.producerName, cap: r.capacityByDate, a: r.assigned })));
  await db.$disconnect();
})();
