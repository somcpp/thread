# Sutra: one thread that ties a small business together

**Build for Bharat hackathon · Track 4: MSME Growth & Productivity**

Small producers (weavers, brass workers, toy makers, small workshops) run their business on paper and WhatsApp.
So they can't see their stock, they pay someone to do GST, and they sell through agents who take a big cut.

Sutra turns the **bill photos** and **voice notes** they already send into:

- **stock tracking** with run-out predictions and one-tap reorders to suppliers
- **GST invoices** and a monthly GST summary their CA can download
- a **storefront** where bulk buyers see what a maker can *actually deliver by their date*

## Three portals, one backend

| Portal | URL | Who |
|---|---|---|
| Producer App (Hindi, voice-first, mobile) | `/app` | Rohit, a master weaver in Chanderi (and any other maker) |
| Buyer Marketplace | `/market` | Boutiques and retailers across India |
| Cluster Dashboard | `/cluster` | Cooperative / FPO / CA |

### Features

**Producer App:** snap a bill (AI reads it, adds stock, records input tax credit, checks the supplier's GSTIN checksum) ·
voice entry in Hindi/Hinglish ("aaj 6 saree bani, 4 Jaipur bheji" → production + GST invoice) ·
stock with run-out dates from 28-day usage · one-tap WhatsApp reorder · orders inbox with English↔Hindi translation ·
accept/decline with a live "can you deliver?" check · catalog builder (photo auto-enhance + AI buyer story) ·
GST summary with CSV and GSTR-1-style JSON export · khata (ledger) with payment reminders · printable GST invoices · spoken Hindi feedback.

**Buyer Marketplace:** browse by cluster and category · **"Can Deliver" quote** from live stock, loom capacity,
open orders and raw-material lead times, with a production curve · **cluster option** when one maker can't meet the date
(the order is split across makers who weave the same product) · proforma invoice · order tracking · translated chat.

**Cluster Dashboard:** KPIs · weekly production · agent vs direct sales · makers table (stock health, GST, on-time) ·
bulk order split tool · group buying of raw material · compliance (GSTIN errors, tax credit at risk).

**Any industry:** switch the Producer App to *Mohd. Salim, Salim Brass Works* (Moradabad) to show the same engine with brass sheet,
lacquer and karigars instead of yarn and looms. Profiles live in `src/lib/industries.ts`.

## Run it

```bash
npm install
cp .env.example .env          # DATABASE_URL is all you need
npx prisma db push
npx prisma db seed            # 13 makers, 2 clusters, 6 months of history
npm run dev                   # http://localhost:3000
```

Reset the demo data any time with `npm run db:reset`.

### AI (optional)

Set `ANTHROPIC_API_KEY` in `.env` to have Claude (Opus 5.5) read real bill photos, understand free-form voice notes,
write product stories and translate chat. Without a key, Sutra uses offline fallbacks: the three sample bills
in `public/samples/` and a rule-based Hindi/Hinglish parser. Set `SUTRA_AI=off` to force offline mode on stage.

Voice input uses the browser's speech recognition (works in Chrome, `hi-IN`). There is always a text box and sample phrases as a fallback.

## Demo script (3 minutes)

1. **Hook:** "Rohit makes beautiful sarees. Agents take a big share. He has never met the shops that sell them."
2. `/app/bill` → tap the **Zari bill** → GSTIN verified → Save → zari stock up, ₹1,830 tax credit recorded.
   (Try the **Silk bill with a GSTIN error** to show the GST check catching a typo.)
3. `/app/voice` → "aaj 6 saree bani, 4 Jaipur bheji" → Yes → production recorded, IGST invoice for Neel Textiles, Jaipur.
4. `/market/p/rohit-sc-saree` (as Kaveri Boutique, Bengaluru) → 200 sarees by a date ~3 weeks out → **Check delivery**
   → Rohit alone: ~69 by then → **Order 200 from the cluster**.
5. `/app/orders` → Rohit sees the request in Hindi with the "can you deliver" check → **Accept**.
6. `/cluster` → the order split across 10 weavers, group buying, agent commission kept.
7. Switch the producer to **Mohd. Salim** (brass) → same app, different industry.

## Tech

Next.js 16 (App Router, server actions) · TypeScript · Tailwind CSS 4 · Prisma + SQLite (switch the provider to PostgreSQL for deployment) ·
Recharts · lucide icons · Anthropic SDK (structured outputs) · browser Web Speech API.

Key code: `src/lib/engine.ts` (reorder prediction, Can Deliver quote, cluster split) · `src/lib/gst.ts` (GSTIN checksum, tax split) ·
`src/lib/ai.ts` (Claude calls + offline fallbacks) · `src/app/actions.ts` (all mutations) · `prisma/seed.ts` (demo data).
