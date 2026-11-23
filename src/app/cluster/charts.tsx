"use client";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export function ProductionChart({ data }: { data: { week: string; units: number }[] }) {
  return (
    <div className="h-56">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
          <CartesianGrid stroke="#eee" vertical={false} />
          <XAxis dataKey="week" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip formatter={(v) => [`${v} pcs`, "Made"]} />
          <Bar dataKey="units" fill="#0F766E" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ChannelChart({ data }: { data: { month: string; agent: number; direct: number }[] }) {
  return (
    <div className="h-56">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
          <CartesianGrid stroke="#eee" vertical={false} />
          <XAxis dataKey="month" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
          <Tooltip formatter={(v, n) => [`₹${Number(v).toLocaleString("en-IN")}`, n === "agent" ? "Through agents" : "Direct on Sutra"]} />
          <Legend formatter={(v) => (v === "agent" ? "Through agents" : "Direct on Sutra")} wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="agent" stackId="a" fill="#C9B8A6" />
          <Bar dataKey="direct" stackId="a" fill="#B4441F" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
