import { getLang, tr } from "@/lib/session";
import VoiceEntry from "./voice";

export default async function VoicePage() {
  const lang = await getLang();
  const t = tr(lang);
  return (
    <div>
      <h1 className="text-xl font-bold">{t("बोलकर लिखें", "Voice entry")}</h1>
      <p className="mt-1 text-sm text-muted">
        {t("जैसे WhatsApp पर बोलते हैं, वैसे ही बोलिए। Sutra हिसाब और बिल ख़ुद बना देगा।", "Speak like you would on WhatsApp. Sutra does the bookkeeping and the invoice.")}
      </p>
      <VoiceEntry lang={lang} />
    </div>
  );
}
