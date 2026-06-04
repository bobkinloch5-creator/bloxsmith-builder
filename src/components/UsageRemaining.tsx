import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Gauge, ExternalLink, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

type Usage = {
  owner?: boolean;
  limit_5h: number;
  used_5h: number;
  reset_5h?: string | null;
  limit_24h?: number;
  used_24h?: number;
  reset_24h?: string | null;
  limit_7d: number;
  used_7d: number;
  reset_7d?: string | null;
};

type DayBucket = { day: string; label: string; count: number };

function fmtReset(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

function buildDayBuckets(events: { created_at: string }[]): DayBucket[] {
  const buckets: DayBucket[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    buckets.push({
      day: key,
      label: d.toLocaleDateString([], { weekday: "short" }),
      count: 0,
    });
  }
  const index = new Map(buckets.map((b, i) => [b.day, i]));
  for (const ev of events) {
    const key = ev.created_at.slice(0, 10);
    const i = index.get(key);
    if (i !== undefined) buckets[i].count++;
  }
  return buckets;
}

export function UsageRemaining({ defaultOpen = true }: { defaultOpen?: boolean }) {
  void defaultOpen;
  const [usage, setUsage] = useState<Usage | null>(null);
  const [events, setEvents] = useState<{ created_at: string }[]>([]);

  const load = async () => {
    const { data } = await supabase.rpc("get_ai_usage" as never);
    if (data) setUsage(data as unknown as Usage);
    const since = new Date();
    since.setDate(since.getDate() - 7);
    const { data: evs } = await supabase
      .from("ai_usage_events")
      .select("created_at")
      .gte("created_at", since.toISOString())
      .order("created_at", { ascending: true });
    if (evs) setEvents(evs);
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, []);

  const buckets = useMemo(() => buildDayBuckets(events), [events]);
  const todayCount = buckets[buckets.length - 1]?.count ?? 0;
  const weekTotal = buckets.reduce((s, b) => s + b.count, 0);
  const peak = Math.max(1, ...buckets.map((b) => b.count));

  if (!usage) return null;
  if (usage.owner) {
    return (
      <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 text-sm">
        <div className="flex items-center gap-2 font-semibold">
          <Gauge className="h-4 w-4 text-primary" /> Owner — unlimited usage
        </div>
      </div>
    );
  }

  const pct5h = Math.min(100, Math.round((usage.used_5h / usage.limit_5h) * 100));
  const used24h = usage.used_24h ?? usage.used_5h;
  const limit24h = usage.limit_24h ?? usage.limit_5h;
  const pct24h = Math.min(100, Math.round((used24h / limit24h) * 100));
  const pct7d = Math.min(100, Math.round((usage.used_7d / usage.limit_7d) * 100));

  return (
    <div className="rounded-xl border border-border bg-surface/60 p-3 text-sm backdrop-blur">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 font-semibold">
          <Gauge className="h-4 w-4 text-primary" /> Usage
        </span>
        <Link
          to="/pricing"
          className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
        >
          Upgrade <ExternalLink className="h-3 w-3" />
        </Link>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <Stat label="Today" value={todayCount} sub="messages" />
        <Stat
          label="24h limit"
          value={`${used24h}/${limit24h}`}
          sub={`resets ${fmtReset(usage.reset_24h)}`}
        />
        <Stat label="Past 7d" value={weekTotal} sub={`of ${usage.limit_7d}`} />
      </div>

      <div className="mt-3 h-24 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={buckets} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
            <defs>
              <linearGradient id="usage-grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.55} />
                <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="hsl(var(--border))"
              opacity={0.25}
              vertical={false}
            />
            <XAxis
              dataKey="label"
              stroke="hsl(var(--muted-foreground))"
              fontSize={10}
              tickLine={false}
              axisLine={false}
            />
            <YAxis hide domain={[0, Math.max(4, peak)]} />
            <Tooltip
              cursor={{ stroke: "hsl(var(--border))" }}
              contentStyle={{
                background: "hsl(var(--surface-elevated))",
                border: "1px solid hsl(var(--border))",
                borderRadius: 8,
                fontSize: 12,
              }}
              labelStyle={{ color: "hsl(var(--foreground))" }}
              formatter={(v: number) => [`${v} msg`, "Used"]}
            />
            <Area
              type="monotone"
              dataKey="count"
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              fill="url(#usage-grad)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-3 space-y-2">
        <Bar label="Daily timer" used={used24h} limit={limit24h} pct={pct24h} />
        <Bar label="Past 5h" used={usage.used_5h} limit={usage.limit_5h} pct={pct5h} />
        <Bar label="Past 7d" used={usage.used_7d} limit={usage.limit_7d} pct={pct7d} />
      </div>

      {weekTotal === 0 && (
        <div className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <TrendingUp className="h-3 w-3" />
          No AI requests yet this week — your activity will show here.
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="min-w-0 rounded-lg border border-border/60 bg-background/40 px-2 py-1.5">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="truncate text-sm font-semibold leading-tight sm:text-base">{value}</div>
      {sub && <div className="truncate text-[10px] text-muted-foreground">{sub}</div>}
    </div>
  );
}

function Bar({
  label,
  used,
  limit,
  pct,
}: {
  label: string;
  used: number;
  limit: number;
  pct: number;
}) {
  const tone = pct >= 100 ? "bg-destructive" : pct >= 80 ? "bg-amber-500" : "bg-primary";
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-[11px]">
        <span className="text-foreground">{label}</span>
        <span className="text-muted-foreground">
          {used} / {limit} · {pct}%
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-surface-elevated">
        <div className={`h-full ${tone} transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
