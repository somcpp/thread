// AI layer. Uses Claude when ANTHROPIC_API_KEY is set (and SUTRA_AI != "off");
// otherwise falls back to deterministic parsers so the demo always works offline.
import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";

const MODEL = "claude-opus-5-5";

export const aiEnabled = () => !!process.env.ANTHROPIC_API_KEY && process.env.SUTRA_AI !== "off";

let client: Anthropic | null = null;
const anthropic = () => (client ??= new Anthropic());

/** One structured call. Server-side refusal fallback is on; low effort keeps the demo snappy. */
async function structured<T extends z.ZodType>(
  schema: T,
  system: string,
  content: Anthropic.Beta.BetaContentBlockParam[],
): Promise<z.infer<T> | null> {
  try {
    const res = await anthropic().beta.messages.parse({
      model: MODEL,
      max_tokens: 4000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low", format: betaZodOutputFormat(schema) },
      system,
      messages: [{ role: "user", content }],
    });
    if (res.stop_reason === "refusal") return null;
    return (res.parsed_output as z.infer<T>) ?? null;
  } catch (e) {
    if (e instanceof Anthropic.APIError) console.error(`[ai] API error ${e.status}: ${e.message}`);
    else console.error("[ai] failed", e);
    return null;
  }
}

// ------------------------------------------------------------------ bills

export const BillSchema = z.object({
  supplierName: z.string(),
  supplierGstin: z.string().describe("15-character GSTIN exactly as printed, or empty string if none"),
  billNo: z.string(),
  billDate: z.string().describe("YYYY-MM-DD"),
  items: z.array(
    z.object({
      description: z.string(),
      materialId: z.string().describe("id of the matching material from the list given, or empty string if none match"),
      qty: z.number(),
      unit: z.string(),
      rate: z.number().describe("price per unit before tax"),
    }),
  ),
  taxable: z.number(),
  cgst: z.number(),
  sgst: z.number(),
  igst: z.number(),
  total: z.number(),
});
export type Bill = z.infer<typeof BillSchema>;

export async function readBill(
  image: { base64: string; mediaType: "image/png" | "image/jpeg" | "image/webp" },
  materials: { id: string; name: string; unit: string }[],
): Promise<Bill | null> {
  if (!aiEnabled()) return null;
  return structured(
    BillSchema,
    "You read Indian supplier tax invoices (often photographed on a phone, sometimes partly handwritten) for a small manufacturer's bookkeeping. " +
      "Extract the fields exactly as printed. Amounts are in rupees. If a value is unreadable, make your best reading rather than inventing a new one. " +
      "Match each line item to one of the producer's materials when it is clearly the same material.",
    [
      { type: "image", source: { type: "base64", media_type: image.mediaType, data: image.base64 } },
      { type: "text", text: `The producer's materials:\n${materials.map((m) => `- ${m.id}: ${m.name} (${m.unit})`).join("\n")}\n\nExtract this bill.` },
    ],
  );
}

// ------------------------------------------------------------------ voice notes

export const VoiceSchema = z.object({
  actions: z.array(
    z.object({
      kind: z.enum(["PRODUCE", "SALE", "PURCHASE", "PAYMENT_RECEIVED", "PAYMENT_MADE"]),
      productId: z.string().describe("for PRODUCE/SALE: id from the product list, else empty"),
      materialId: z.string().describe("for PURCHASE: id from the material list, else empty"),
      qty: z.number().describe("units or material quantity; 0 for payments"),
      amount: z.number().describe("rupees for payments; 0 otherwise"),
      party: z.string().describe("buyer, supplier or city mentioned; empty if none"),
    }),
  ),
  replyHi: z.string().describe("one short confirmation sentence in simple Hindi (Devanagari) of what was recorded"),
});
export type VoiceResult = z.infer<typeof VoiceSchema>;

type Ctx = { products: { id: string; name: string; nameHi: string }[]; materials: { id: string; name: string; nameHi: string; unit: string }[] };

export async function parseVoice(transcript: string, ctx: Ctx): Promise<VoiceResult | null> {
  if (!aiEnabled()) return fallbackVoice(transcript, ctx);
  const r = await structured(
    VoiceSchema,
    "You turn a small producer's spoken business note (Hindi, Hinglish or English) into bookkeeping actions. " +
      "'bani/banayi/taiyaar' means produced; 'bheji/bechi/di' to someone means sold; 'aaya/kharida' for material means purchased; " +
      "'paise mile' means payment received. If the product type is not named, use the most likely product given the words (saree, dupatta, suit etc.). " +
      "Only record what was actually said.",
    [
      {
        type: "text",
        text:
          `Products:\n${ctx.products.map((p) => `- ${p.id}: ${p.name} / ${p.nameHi}`).join("\n")}\n` +
          `Materials:\n${ctx.materials.map((m) => `- ${m.id}: ${m.name} / ${m.nameHi} (${m.unit})`).join("\n")}\n\n` +
          `Voice note: "${transcript}"`,
      },
    ],
  );
  return r ?? fallbackVoice(transcript, ctx);
}

const HI_CITY: Record<string, string> = { जयपुर: "Jaipur", बेंगलुरु: "Bengaluru", मुंबई: "Mumbai", दिल्ली: "Delhi", इंदौर: "Indore", पुणे: "Pune", भोपाल: "Bhopal" };

/** Offline parser for the common demo phrasing, e.g. "aaj 6 saree bani, 4 Jaipur bheji". */
export function fallbackVoice(transcript: string, ctx: Ctx): VoiceResult | null {
  const t = transcript.toLowerCase();
  const find = (word: RegExp) => ctx.products.find((p) => word.test(p.name.toLowerCase()) || word.test(p.nameHi));
  const saree = find(/silk-cotton|सिल्क-कॉटन/) ?? find(/saree|साड़ी/) ?? ctx.products[0];
  const dupatta = find(/dupatta|दुपट्टा/);
  const pickProduct = (frag: string) => (/(dupatt|दुपट्ट)/.test(frag) && dupatta ? dupatta : saree);
  const actions: VoiceResult["actions"] = [];
  const parts = t.split(/,|और|aur|\bthen\b/);
  for (const part of parts) {
    const n = Number((part.match(/(\d+)/) ?? [])[1] ?? 0);
    if (!n) continue;
    const prod = pickProduct(part);
    if (/(bani|bane|banayi|banaya|taiyaar|tayyar|बनी|बने|बना|बनाई|बनाए|तैयार|made|produced)/.test(part))
      actions.push({ kind: "PRODUCE", productId: prod.id, materialId: "", qty: n, amount: 0, party: "" });
    else if (/(bheji|bheje|bechi|beche|भेजी|भेजे|बेची|sold|sent)/.test(part)) {
      const en = (part.match(/\b(jaipur|bengaluru|bangalore|mumbai|delhi|indore|pune|bhopal)\b/) ?? [])[1];
      const hiCity = Object.keys(HI_CITY).find((c) => part.includes(c));
      const city = en ? en[0].toUpperCase() + en.slice(1) : hiCity ? HI_CITY[hiCity] : "";
      actions.push({ kind: "SALE", productId: prod.id, materialId: "", qty: n, amount: 0, party: city });
    }
  }
  if (!actions.length) return null;
  const hi = actions
    .map((a) => (a.kind === "PRODUCE" ? `${a.qty} बनीं` : `${a.qty} ${a.party ? a.party + " " : ""}भेजीं`))
    .join(", ");
  return { actions, replyHi: `ठीक है, दर्ज कर लिया: ${hi}।` };
}

// ------------------------------------------------------------------ product story

export const StorySchema = z.object({
  title: z.string().describe("short product title for a B2B catalog, English"),
  story: z.string().describe("55-80 word buyer-facing English description: craft, material, feel, use. No hype words."),
  tags: z.array(z.string()).describe("3-5 short tags"),
});
export type Story = z.infer<typeof StorySchema>;

export async function writeStory(input: { note: string; category: string; producer: string; cluster: string; image?: { base64: string; mediaType: "image/png" | "image/jpeg" | "image/webp" } }): Promise<Story> {
  const fallback: Story = {
    title: `${input.category} by ${input.producer}`,
    story: `Hand-made in ${input.cluster} by ${input.producer}. ${input.note ? `Maker's note: ${input.note}. ` : ""}Each piece is finished and checked by hand before dispatch, so small variations are part of its character. Available for bulk orders with a GST invoice.`,
    tags: [input.category, input.cluster, "handmade"],
  };
  if (!aiEnabled()) return fallback;
  const content: Anthropic.Beta.BetaContentBlockParam[] = [];
  if (input.image) content.push({ type: "image", source: { type: "base64", media_type: input.image.mediaType, data: input.image.base64 } });
  content.push({
    type: "text",
    text: `Category: ${input.category}\nMaker: ${input.producer}, ${input.cluster}\nMaker's spoken note (may be Hindi): "${input.note}"\nWrite the catalog entry.`,
  });
  const r = await structured(
    StorySchema,
    "You write honest, specific B2B catalog copy for Indian artisan products, for boutique and retail buyers. Use only details from the note and photo; never invent awards, certifications or numbers.",
    content,
  );
  return r ?? fallback;
}

// ------------------------------------------------------------------ translation

const TranslationSchema = z.object({ text: z.string() });

export async function translate(text: string, to: "hi" | "en"): Promise<string | null> {
  if (!aiEnabled()) return null;
  const r = await structured(
    TranslationSchema,
    to === "hi"
      ? "Translate the business message into simple, polite spoken Hindi in Devanagari, as a small-town shop owner would understand it. Keep numbers and product names."
      : "Translate the business message into clear, polite English for a boutique buyer. Keep numbers and product names.",
    [{ type: "text", text }],
  );
  return r?.text ?? null;
}
