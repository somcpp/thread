// Demo "sessions": which producer / buyer / cluster is active, and the UI language.
// Stored in cookies so the demo can switch identities instantly (no passwords in a hackathon demo).
import "server-only";
import { cookies } from "next/headers";
import { db } from "./db";

export type Lang = "hi" | "en";

export async function getLang(): Promise<Lang> {
  const c = await cookies();
  return c.get("lang")?.value === "en" ? "en" : "hi";
}

/** Pick Hindi or English text. */
export function tr(lang: Lang) {
  return (hi: string, en: string) => (lang === "hi" ? hi : en);
}

export async function currentProducer() {
  const c = await cookies();
  const slug = c.get("producer")?.value ?? "rohit";
  const p =
    (await db.producer.findUnique({ where: { slug }, include: { cluster: true } })) ??
    (await db.producer.findUniqueOrThrow({ where: { slug: "rohit" }, include: { cluster: true } }));
  return p;
}

export async function currentBuyer() {
  const c = await cookies();
  const id = c.get("buyer")?.value;
  const b = id ? await db.buyer.findUnique({ where: { id } }) : null;
  return b ?? (await db.buyer.findFirstOrThrow({ where: { business: "Kaveri Boutique" } }));
}

export async function currentCluster() {
  const c = await cookies();
  const slug = c.get("cluster")?.value ?? "chanderi";
  return (await db.cluster.findUnique({ where: { slug } })) ?? (await db.cluster.findUniqueOrThrow({ where: { slug: "chanderi" } }));
}
