"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CalendarCheck, Loader2, Users, CheckCircle2, AlertCircle } from "lucide-react";
import { getQuote, requestOrder, requestClusterOrder, type QuoteResult } from "@/app/actions";
import { btn, cx } from "@/components/ui";

const inr = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");
const fmt = (d: Date | string | null) => (d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "-");

export default function QuoteBox({ productId, defaultQty, defaultDate, price, gstRate, makerName }: { productId: string; defaultQty: number; defaultDate: string; price: number; gstRate: number; makerName: string }) {
  const [qty, setQty] = useState(defaultQty);
  const [date, setDate] = useState(defaultDate);
  const [note, setNote] = useState("");
  const [q, setQ] = useState<QuoteResult | null>(null);
  const [placed, setPlaced] = useState<{ code: string; proforma?: string; cluster?: boolean; count?: number } | null>(null);
  const [checking, startCheck] = useTransition();
  const [placing, startPlace] = useTransition();

  const check = () => startCheck(async () => { setPlaced(null); setQ(await getQuote(productId, qty, date)); });

  if (placed)
    return (
      <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
        <div className="flex items-center gap-2 text-lg font-bold text-emerald-800"><CheckCircle2 /> Request sent</div>
        <p className="mt-1 text-sm text-emerald-900">
          {placed.cluster
            ? `Your order was split across ${placed.count} makers in the cluster. Each one has been notified in Hindi on their phone.`
            : `${makerName} has been notified in Hindi on their phone. You'll see the reply here, translated to English.`}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link href={`/market/orders/${placed.code}`} className={btn.teal}>Track order {placed.code}</Link>
          {placed.proforma && <Link href={`/invoice/${encodeURIComponent(placed.proforma)}`} className={btn.ghost}>Proforma invoice</Link>}
        </div>
      </div>
    );

  return (
    <div className="mt-6 rounded-2xl border-2 border-teal/30 bg-teal-soft/40 p-5">
      <div className="flex items-center gap-2 font-bold"><CalendarCheck size={18} className="text-teal" /> Can they deliver by your date?</div>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <label className="text-sm">
          <span className="text-xs text-muted">Quantity</span>
          <input type="number" min={1} value={qty} onChange={(e) => setQty(Number(e.target.value))} className="mt-1 w-full rounded-xl border border-line bg-white px-3 py-2.5" />
        </label>
        <label className="text-sm">
          <span className="text-xs text-muted">Needed by</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1 w-full rounded-xl border border-line bg-white px-3 py-2.5" />
        </label>
      </div>
      <button onClick={check} disabled={checking || qty < 1} className={cx(btn.teal, "mt-3 w-full py-3")}>
        {checking ? <Loader2 size={16} className="animate-spin" /> : <CalendarCheck size={16} />} Check delivery
      </button>

      {q && (
        <div className="mt-5">
          <div className={cx("flex items-start gap-2 rounded-xl p-3", q.canMeet ? "bg-emerald-100/70 text-emerald-900" : "bg-amber-100/70 text-amber-900")}>
            {q.canMeet ? <CheckCircle2 className="mt-0.5 shrink-0" size={18} /> : <AlertCircle className="mt-0.5 shrink-0" size={18} />}
            <div>
              <div className="font-bold">
                {q.canMeet ? `Yes: all ${q.qty} by ${fmt(q.wantedBy)}` : `${q.qtyByWanted} by ${fmt(q.wantedBy)} · all ${q.qty} by ${fmt(q.fullDate)}`}
              </div>
              <div className="text-xs opacity-80">
                {q.ready} ready now, then ~{Math.round(q.perDay * 7)} a week from {makerName}&apos;s looms
                {q.shortfalls.length > 0 && " · raw material reorder already planned"}
              </div>
            </div>
          </div>

          <div className="mt-3 h-44 rounded-xl bg-white p-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={q.curve} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid stroke="#eee" vertical={false} />
                <XAxis dataKey="date" tickFormatter={(d) => fmt(d)} tick={{ fontSize: 10 }} minTickGap={24} />
                <YAxis tick={{ fontSize: 10 }} domain={[0, Math.ceil(q.qty * 1.1)]} allowDataOverflow />
                <Tooltip labelFormatter={(d) => fmt(String(d))} formatter={(v) => [`${v} pcs`, "Ready"]} />
                <ReferenceLine y={q.qty} stroke="#B4441F" strokeDasharray="4 3" label={{ value: `${q.qty} needed`, fontSize: 10, fill: "#B4441F", position: "insideTopLeft" }} />
                <ReferenceLine x={new Date(q.wantedBy).toISOString().slice(0, 10)} stroke="#0F766E" strokeDasharray="4 3" />
                <Area type="monotone" dataKey="units" stroke="#0F766E" fill="#0F766E" fillOpacity={0.15} strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {q.cluster && q.cluster.covered > q.qtyByWanted && (
            <div className="mt-4 rounded-xl border border-ink/10 bg-white p-4">
              <div className="flex items-center gap-2 font-bold"><Users size={18} className="text-brand" /> Or get {q.cluster.covered >= q.qty ? `all ${q.qty}` : q.cluster.covered} by {fmt(q.wantedBy)} from the {q.cluster.name}</div>
              <p className="mt-1 text-xs text-muted">Sutra splits the order across makers who weave the same product, by their free capacity. One invoice each, one order for you.</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {q.cluster.rows.map((r) => (
                  <span key={r.producerName} className="rounded-full bg-paper px-2.5 py-1 text-xs"><b>{r.assigned}</b> · {r.producerName}</span>
                ))}
              </div>
              <button
                disabled={placing}
                onClick={() => startPlace(async () => { const r = await requestClusterOrder({ productId, qty: q.qty, wantedBy: date }); setPlaced({ code: r.parent, cluster: true, count: r.codes.length }); })}
                className={cx(btn.primary, "mt-3 w-full")}
              >
                {placing ? <Loader2 size={16} className="animate-spin" /> : <Users size={16} />} Order {Math.min(q.qty, q.cluster.covered)} from the cluster
              </button>
            </div>
          )}

          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder={`Message to ${makerName} (colours, packing…). They'll read it in Hindi.`} className="mt-4 w-full rounded-xl border border-line bg-white px-3 py-2 text-sm" />
          <div className="mt-2 flex items-center justify-between text-sm">
            <span className="text-muted">Estimated: {inr(q.qty * price)} + {inr((q.qty * price * gstRate) / 100)} GST</span>
          </div>
          <button
            disabled={placing}
            onClick={() => startPlace(async () => { const r = await requestOrder({ productId, qty: q.qty, wantedBy: date, note }); setPlaced({ code: r.code, proforma: r.proforma }); })}
            className={cx(q.cluster && q.cluster.covered > q.qtyByWanted ? btn.ghost : btn.primary, "mt-2 w-full py-3")}
          >
            {placing ? <Loader2 size={16} className="animate-spin" /> : null} Send order request to {makerName}
          </button>
        </div>
      )}
    </div>
  );
}
