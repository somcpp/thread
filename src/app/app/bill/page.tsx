import { getLang, tr } from "@/lib/session";
import { SAMPLE_BILLS } from "@/lib/samples";
import { aiEnabled } from "@/lib/ai";
import BillScanner from "./scanner";

export default async function BillPage() {
  const lang = await getLang();
  const t = tr(lang);
  return (
    <div>
      <h1 className="text-xl font-bold">{t("बिल की फ़ोटो लें", "Snap a supplier bill")}</h1>
      <p className="mt-1 text-sm text-muted">
        {t("फ़ोटो खींचिए। Sutra बिल पढ़कर स्टॉक और GST ख़ुद भर देगा।", "Take a photo. Sutra reads the bill and fills in stock and GST for you.")}
      </p>
      <BillScanner lang={lang} ai={aiEnabled()} samples={SAMPLE_BILLS.map((b) => ({ key: b.key, label: b.label }))} />
    </div>
  );
}
