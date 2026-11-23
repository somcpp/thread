"use client";
import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Mic, Square, Loader2, CheckCircle2, FileText, AlertTriangle } from "lucide-react";
import { previewVoice, applyVoice, type VoicePreview } from "@/app/actions";
import { btn, Card, cx } from "@/components/ui";
import { speak } from "@/components/client";

type SR = {
  lang: string; interimResults: boolean; continuous: boolean;
  onresult: (e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void;
  onend: () => void; onerror: () => void; start: () => void; stop: () => void;
};

const SAMPLES = ["aaj 6 saree bani, 4 Jaipur bheji", "आज 10 दुपट्टे बने", "15 dupatta Indore bheje", "आज 3 साड़ी बनी और 2 भोपाल भेजी"];

export default function VoiceEntry({ lang }: { lang: "hi" | "en" }) {
  const t = (hi: string, en: string) => (lang === "hi" ? hi : en);
  const [text, setText] = useState("");
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(true);
  const [preview, setPreview] = useState<VoicePreview | null>(null);
  const [results, setResults] = useState<Awaited<ReturnType<typeof applyVoice>> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [parsing, startParse] = useTransition();
  const [saving, startSave] = useTransition();
  const rec = useRef<SR | null>(null);

  function recognizer(): SR | null {
    if (rec.current) return rec.current;
    const w = window as unknown as { SpeechRecognition?: new () => SR; webkitSpeechRecognition?: new () => SR };
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Ctor) return null;
    const r = new Ctor();
    r.lang = "hi-IN";
    r.interimResults = true;
    r.continuous = false;
    r.onresult = (e) => setText(Array.from(e.results).map((x) => x[0].transcript).join(" "));
    r.onend = () => setListening(false);
    r.onerror = () => { setListening(false); setSupported(false); };
    rec.current = r;
    return r;
  }

  function toggleMic() {
    const r = recognizer();
    if (!r) { setSupported(false); return; }
    if (listening) { r.stop(); return; }
    setText(""); setPreview(null); setResults(null);
    try { r.start(); setListening(true); } catch { setSupported(false); }
  }

  function understand(value = text) {
    if (!value.trim()) return;
    setError(null); setResults(null);
    startParse(async () => {
      const p = await previewVoice(value);
      if (!p || p.actions.length === 0) { setError(t("समझ नहीं आया। जैसे बोलें: “आज 6 साड़ी बनी, 4 जयपुर भेजी”", "Didn't catch that. Try: “aaj 6 saree bani, 4 Jaipur bheji”")); return; }
      setPreview(p);
      speak(p.replyHi + " सही है?", "hi");
    });
  }

  function confirm() {
    if (!preview) return;
    startSave(async () => {
      const r = await applyVoice(preview);
      setResults(r);
      setPreview(null);
      speak(r.map((x) => x.textHi).join("। "), "hi");
    });
  }

  return (
    <div className="mt-5 space-y-4">
      <div className="flex flex-col items-center">
        <button
          onClick={toggleMic}
          disabled={!supported}
          className={cx("grid h-28 w-28 place-items-center rounded-full text-white shadow-lg transition", listening ? "animate-pulse bg-red-500" : "bg-teal", !supported && "opacity-40")}
          aria-label={listening ? "Stop" : "Speak"}
        >
          {listening ? <Square size={36} /> : <Mic size={44} />}
        </button>
        <div className="mt-2 text-sm font-semibold text-muted">
          {!supported ? t("इस ब्राउज़र में माइक नहीं चलेगा, नीचे लिखें", "Mic not available in this browser, type below") : listening ? t("सुन रहे हैं… बोलिए", "Listening… speak now") : t("दबाकर बोलें", "Tap and speak")}
        </div>
      </div>

      <div className="flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && understand()}
          placeholder={t("या यहाँ लिखें…", "Or type here…")}
          className="min-w-0 flex-1 rounded-xl border border-line bg-white px-3 py-2.5 text-sm"
        />
        <button className={btn.teal} onClick={() => understand()} disabled={parsing || !text.trim()}>
          {parsing ? <Loader2 size={16} className="animate-spin" /> : t("समझो", "Go")}
        </button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {SAMPLES.map((s) => (
          <button key={s} onClick={() => { setText(s); understand(s); }} className="rounded-full border border-line bg-white px-3 py-1 text-xs">
            “{s}”
          </button>
        ))}
      </div>

      {error && <div className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">{error}</div>}

      {preview && (
        <Card>
          <div className="text-xs font-semibold uppercase tracking-wide text-muted">{t("Sutra ने समझा", "Sutra understood")}</div>
          <div className="mt-1 text-sm italic text-muted">“{preview.transcript}”</div>
          <ul className="mt-3 space-y-2">
            {preview.actions.map((a, i) => (
              <li key={i} className="flex items-start gap-2 rounded-xl bg-paper p-2.5 text-sm">
                <span className={cx("mt-0.5 rounded-md px-1.5 py-0.5 text-[10px] font-bold text-white", a.kind === "PRODUCE" ? "bg-teal" : a.kind === "SALE" ? "bg-brand" : "bg-stone-500")}>
                  {a.kind === "PRODUCE" ? t("बना", "MADE") : a.kind === "SALE" ? t("बिका", "SOLD") : a.kind === "PURCHASE" ? t("ख़रीदा", "BOUGHT") : t("पैसा", "MONEY")}
                </span>
                <div className="flex-1">
                  <div className="font-semibold">{t(a.labelHi, a.label)}</div>
                  {a.kind === "SALE" && <div className="text-xs text-muted">{t("GST बिल अपने आप बनेगा", "A GST invoice will be created")}</div>}
                  {a.kind === "PRODUCE" && <div className="text-xs text-muted">{t("धागे का स्टॉक अपने आप घटेगा", "Raw material will be deducted by recipe")}</div>}
                  {a.warning && <div className="flex items-center gap-1 text-xs text-amber-700"><AlertTriangle size={12} /> {a.warning}</div>}
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex gap-2">
            <button className={cx(btn.ghost, "flex-1")} onClick={() => setPreview(null)}>{t("गलत है", "Wrong")}</button>
            <button className={cx(btn.primary, "flex-[2]")} onClick={confirm} disabled={saving}>
              {saving ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />} {t("हाँ, सही है", "Yes, save")}
            </button>
          </div>
        </Card>
      )}

      {results && (
        <Card className="border-emerald-200 bg-emerald-50/50">
          <div className="flex items-center gap-2 font-bold text-emerald-800"><CheckCircle2 size={20} /> {t("दर्ज हो गया", "Recorded")}</div>
          <ul className="mt-2 space-y-1.5 text-sm">
            {results.map((r, i) => (
              <li key={i} className="flex items-center justify-between gap-2">
                <span>{t(r.textHi, r.text)}</span>
                {r.invoice && (
                  <Link href={`/invoice/${encodeURIComponent(r.invoice)}`} className={btn.small}>
                    <FileText size={14} /> {t("बिल", "Invoice")}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
