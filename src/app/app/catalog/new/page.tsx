import { db } from "@/lib/db";
import { currentProducer, getLang, tr } from "@/lib/session";
import NewProduct from "./form";

export default async function NewProductPage() {
  const [p, lang] = await Promise.all([currentProducer(), getLang()]);
  const t = tr(lang);
  const cats = await db.product.findMany({ where: { producerId: p.id }, select: { category: true, price: true }, distinct: ["category"] });
  return (
    <div>
      <h1 className="text-xl font-bold">{t("नया प्रोडक्ट", "New product")}</h1>
      <p className="mt-1 text-sm text-muted">{t("फ़ोटो लें और 2 लाइन बोलें/लिखें। बाकी Sutra कर देगा।", "Take a photo and say two lines about it. Sutra does the rest.")}</p>
      <NewProduct lang={lang} categories={cats.map((c) => ({ name: c.category, price: c.price }))} />
    </div>
  );
}
