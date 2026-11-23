"use client";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Camera, Sparkles, Loader2, Upload, Wand2 } from "lucide-react";
import { draftStory, publishProduct } from "@/app/actions";
import { btn, Card, cx } from "@/components/ui";

/** Square-crop and gently brighten a phone photo, so it looks catalog-ready. */
async function enhance(file: File): Promise<File> {
  const img = await createImageBitmap(file);
  const size = Math.min(img.width, img.height);
  const out = Math.min(1200, size);
  const c = document.createElement("canvas");
  c.width = out;
  c.height = out;
  const ctx = c.getContext("2d")!;
  ctx.filter = "brightness(1.06) contrast(1.08) saturate(1.12)";
  ctx.drawImage(img, (img.width - size) / 2, (img.height - size) / 2, size, size, 0, 0, out, out);
  const blob: Blob = await new Promise((r) => c.toBlob((b) => r(b!), "image/jpeg", 0.88));
  return new File([blob], "product.jpg", { type: "image/jpeg" });
}

export default function NewProduct({ lang, categories }: { lang: "hi" | "en"; categories: { name: string; price: number }[] }) {
  const t = (hi: string, en: string) => (lang === "hi" ? hi : en);
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [category, setCategory] = useState(categories[0]?.name ?? "");
  const [note, setNote] = useState("");
  const [price, setPrice] = useState(categories[0]?.price ?? 1000);
  const [stock, setStock] = useState(10);
  const [story, setStory] = useState<{ title: string; story: string; tags: string[] } | null>(null);
  const [drafting, startDraft] = useTransition();
  const [publishing, startPublish] = useTransition();

  async function onPhoto(f?: File) {
    if (!f) return;
    const e = await enhance(f);
    setPhoto(e);
    setPhotoUrl(URL.createObjectURL(e));
  }

  function draft() {
    const fd = new FormData();
    fd.set("note", note);
    fd.set("category", category);
    if (photo) fd.set("photo", photo);
    startDraft(async () => setStory(await draftStory(fd)));
  }

  function publish() {
    if (!story) return;
    const fd = new FormData();
    fd.set("title", story.title);
    fd.set("story", story.story);
    fd.set("category", category);
    fd.set("price", String(price));
    fd.set("stock", String(stock));
    if (photo) fd.set("photo", photo);
    startPublish(async () => {
      const r = await publishProduct(fd);
      router.push(`/market/p/${r.slug}`);
    });
  }

  return (
    <div className="mt-4 space-y-4">
      <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => onPhoto(e.target.files?.[0])} />
      <button onClick={() => fileRef.current?.click()} className="relative block aspect-square w-full overflow-hidden rounded-2xl border-2 border-dashed border-brand/40 bg-brand-soft/60">
        {photoUrl ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photoUrl} alt="product" className="h-full w-full object-cover" />
            <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-white/90 px-2 py-1 text-xs font-semibold text-teal"><Wand2 size={12} /> {t("फ़ोटो सुधारी गई", "Auto-enhanced")}</span>
          </>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-brand">
            <Camera size={40} />
            <span className="font-bold">{t("प्रोडक्ट की फ़ोटो लें", "Take a product photo")}</span>
            <span className="text-xs text-muted">{t("Sutra फ़ोटो को साफ़ और चौकोर बना देगा", "Sutra crops and brightens it")}</span>
          </div>
        )}
      </button>

      <Card className="space-y-3">
        <label className="block text-sm">
          <span className="text-xs text-muted">{t("किस तरह का प्रोडक्ट", "Product type")}</span>
          <select value={category} onChange={(e) => { setCategory(e.target.value); setPrice(categories.find((c) => c.name === e.target.value)?.price ?? price); }} className="mt-1 w-full rounded-lg border border-line px-2 py-2">
            {categories.map((c) => <option key={c.name}>{c.name}</option>)}
          </select>
        </label>
        <label className="block text-sm">
          <span className="text-xs text-muted">{t("इसके बारे में 2 लाइन (हिंदी में भी चलेगा)", "Two lines about it (Hindi is fine)")}</span>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder={t("जैसे: हल्का गुलाबी रंग, मोर वाली बूटी, शादी के लिए", "e.g. halka gulabi rang, mor wali buti, shaadi ke liye")} className="mt-1 w-full rounded-lg border border-line px-2 py-2" />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="text-sm">
            <span className="text-xs text-muted">{t("थोक दाम (₹)", "Wholesale price (₹)")}</span>
            <input type="number" value={price} onChange={(e) => setPrice(Number(e.target.value))} className="mt-1 w-full rounded-lg border border-line px-2 py-2" />
          </label>
          <label className="text-sm">
            <span className="text-xs text-muted">{t("तैयार स्टॉक", "Ready stock")}</span>
            <input type="number" value={stock} onChange={(e) => setStock(Number(e.target.value))} className="mt-1 w-full rounded-lg border border-line px-2 py-2" />
          </label>
        </div>
        <button className={cx(btn.teal, "w-full")} onClick={draft} disabled={drafting}>
          {drafting ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />} {t("ख़रीदार के लिए विवरण लिखो", "Write the buyer story")}
        </button>
      </Card>

      {story && (
        <Card className="space-y-2">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted">{t("ख़रीदार को ऐसा दिखेगा (अंग्रेज़ी)", "What buyers will see")}</div>
          <input value={story.title} onChange={(e) => setStory({ ...story, title: e.target.value })} className="w-full rounded-lg border border-line px-2 py-2 font-semibold" />
          <textarea value={story.story} onChange={(e) => setStory({ ...story, story: e.target.value })} rows={5} className="w-full rounded-lg border border-line px-2 py-2 text-sm" />
          <div className="flex flex-wrap gap-1">{story.tags.map((x) => <span key={x} className="rounded-full bg-paper px-2 py-0.5 text-xs">{x}</span>)}</div>
          <button className={cx(btn.primary, "w-full")} onClick={publish} disabled={publishing}>
            {publishing ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />} {t("मार्केटप्लेस पर डालें", "Publish to marketplace")}
          </button>
        </Card>
      )}
    </div>
  );
}
