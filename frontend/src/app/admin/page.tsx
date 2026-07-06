"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api";

// ─── Types ───────────────────────────────────────────────────────────────────

type DateRange = "1" | "7" | "30" | "0";

interface KPIs {
  total_users: number;
  comics_created: number;
  images_generated: number;
  avg_rating: number | null;
  avg_regen_per_comic: number;
  rating_count: number;
}

interface FunnelData {
  step1: number;
  step2: number;
  step3: number;
  step4: number;
  exported: number;
}

interface ComicPerDay {
  date: string;
  count: number;
}

interface OverviewData {
  kpis: KPIs;
  funnel: FunnelData;
  comics_per_day: ComicPerDay[];
  reactions: Record<string, number>;
}

interface QualityData {
  comic_stats: {
    avg_stars: number;
    count: number;
    rated_5: number; rated_4: number; rated_3: number; rated_2: number; rated_1: number;
  };
  panel_stats: { total: number; love: number; good: number; neutral: number; bad: number };
  regen_impact: { version: number; avg_score: number; count: number }[];
  style_ratings: { style: string; avg_stars: number; count: number }[];
  positive_keywords: { word: string; count: number; pct: number }[];
  negative_keywords: { word: string; count: number; pct: number }[];
}

interface RegenData {
  overview: {
    total_regens: number;
    avg_per_comic: number;
    comics_with_regen: number;
    total_comics: number;
    pct_users_regen: number;
    improvement_rate: number | null;
  };
  most_regenned: { panel_id: string; total_regens: number; count: number }[];
  before_after_samples: { panel_id: string; v1: string; v2: string; improved: boolean }[];
  trigger_reactions: Record<string, number>;
  regen_depth: { depth: string; count: number }[];
}

// ─── Auth gate ───────────────────────────────────────────────────────────────

function AdminAuth({ onAuth }: { onAuth: (key: string) => void }) {
  const [value, setValue] = useState("");
  const [err, setErr] = useState(false);

  const submit = () => {
    if (!value.trim()) { setErr(true); return; }
    onAuth(value.trim());
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface">
      <div className="bg-white border border-outline-variant rounded-2xl p-10 w-full max-w-sm space-y-5 shadow-lg">
        <div className="text-center">
          <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <span className="text-2xl">📊</span>
          </div>
          <h1 className="text-on-surface text-xl font-bold">Admin Dashboard</h1>
          <p className="text-on-surface-variant text-sm mt-1">Enter your admin key to continue</p>
        </div>
        <input
          type="password"
          value={value}
          onChange={(e) => { setValue(e.target.value); setErr(false); }}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="Admin key"
          className={`field ${err ? "border-red-400 focus:border-red-500" : ""}`}
        />
        {err && <p className="text-red-500 text-xs">Key required</p>}
        <button
          onClick={submit}
          className="w-full bg-primary hover:opacity-90 text-on-primary py-3 rounded-xl text-sm font-semibold transition"
        >
          Enter Dashboard
        </button>
      </div>
    </div>
  );
}

// ─── CSS Charts ──────────────────────────────────────────────────────────────

function BarChart({ data, labelKey, valueKey, color = "#0058be", total }: {
  data: Record<string, unknown>[];
  labelKey: string;
  valueKey: string;
  color?: string;
  total?: number;   // when provided: shows val (pct%) labels + low-sample warning
}) {
  const values  = data.map((d) => Number(d[valueKey]) || 0);
  const allZero = values.every((v) => v === 0);

  if (allZero) {
    return <p className="text-on-surface-variant text-sm py-2">No data yet.</p>;
  }

  const max = Math.max(...values, 1);

  return (
    <div className="space-y-2">
      {data.map((item, i) => {
        const val      = values[i];
        const barPct   = (val / max) * 100;
        const pctDisp  = total && total > 0 ? Math.round((val / total) * 100) : null;
        const showInBar = barPct > 20;
        return (
          <div key={i} className="flex items-center gap-3 text-sm">
            <span className="text-on-surface-variant w-24 truncate text-right text-xs">{String(item[labelKey])}</span>
            <div className="flex-1 bg-surface-container rounded-full h-5 overflow-hidden">
              <div
                className="h-full rounded-full flex items-center justify-end pr-2 text-xs text-white font-medium transition-all duration-500"
                style={{ width: val === 0 ? "0%" : `${Math.max(barPct, 4)}%`, backgroundColor: color }}
              >
                {showInBar && (pctDisp !== null ? `${pctDisp}%` : String(val))}
              </div>
            </div>
            <span className="text-on-surface text-xs text-right shrink-0" style={{ minWidth: pctDisp !== null ? 64 : 20 }}>
              {val}{pctDisp !== null ? ` (${pctDisp}%)` : ""}
            </span>
          </div>
        );
      })}
      {total !== undefined && total > 0 && total <= 5 && (
        <p className="text-on-surface-variant text-xs italic pt-2 mt-1 border-t border-outline-variant">
          Based on {total} reaction{total !== 1 ? "s" : ""} — collect more data for a meaningful distribution.
        </p>
      )}
    </div>
  );
}

function DonutChart({ slices }: { slices: { label: string; value: number; color: string }[] }) {
  const totalRaw = slices.reduce((s, x) => s + x.value, 0);
  if (totalRaw === 0) {
    return <p className="text-on-surface-variant text-sm py-4 text-center">No reactions yet for this period.</p>;
  }
  const total = totalRaw;
  let angle = -90;
  const cx = 60; const cy = 60; const r = 50; const stroke = 18;

  const paths = slices.map((s) => {
    const pct = s.value / total;
    const a1 = (angle * Math.PI) / 180;
    const a2 = ((angle + pct * 360) * Math.PI) / 180;
    const x1 = cx + r * Math.cos(a1); const y1 = cy + r * Math.sin(a1);
    const x2 = cx + r * Math.cos(a2); const y2 = cy + r * Math.sin(a2);
    const largeArc = pct > 0.5 ? 1 : 0;
    const d = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;
    angle += pct * 360;
    return { ...s, d, pct };
  });

  return (
    <div className="flex items-center gap-6">
      <svg width="120" height="120" viewBox="0 0 120 120">
        {paths.map((p, i) => <path key={i} d={p.d} fill={p.color} />)}
        <circle cx={cx} cy={cy} r={r - stroke / 2 - 2} fill="white" />
      </svg>
      <div className="space-y-1.5">
        {slices.map((s, i) => (
          <div key={i} className="flex items-center gap-2 text-sm">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: s.color }} />
            <span className="text-on-surface">{s.label}</span>
            <span className="text-on-surface-variant ml-1">({s.value})</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function LineChart({ data }: { data: ComicPerDay[] }) {
  const [hovered, setHovered] = useState<number | null>(null);

  const allZero = data.every((d) => d.count === 0);
  if (allZero) {
    return (
      <div className="h-28 flex flex-col items-center justify-center gap-1">
        <p className="text-on-surface-variant text-sm">No comics started in this period</p>
        <p className="text-on-surface-variant text-xs opacity-60">
          {data[0]?.date} – {data[data.length - 1]?.date}
        </p>
      </div>
    );
  }

  const max    = Math.max(...data.map((d) => d.count), 1);
  const w      = 440;
  const h      = 120;
  const pL     = 28;   // left padding for Y-axis labels
  const pR     = 8;
  const pT     = 12;
  const pB     = 24;   // bottom padding for date labels
  const plotW  = w - pL - pR;
  const plotH  = h - pT - pB;
  const n      = data.length;

  const pts = data.map((d, i) => ({
    x: pL + (n > 1 ? (i / (n - 1)) * plotW : plotW / 2),
    y: pT + (1 - d.count / max) * plotH,
    ...d,
  }));

  const fillPts = [
    ...pts.map((p) => `${p.x},${p.y}`),
    `${pts[n - 1].x},${pT + plotH}`,
    `${pts[0].x},${pT + plotH}`,
  ].join(" ");

  // 3–5 Y-axis ticks
  const tickCount = Math.min(max + 1, 5);
  const yTicks = Array.from({ length: tickCount }, (_, i) => {
    const val = Math.round((i / (tickCount - 1)) * max);
    return { val, y: pT + (1 - val / max) * plotH };
  });

  // tooltip clamp
  const TIP_W = 110;
  const tip   = hovered !== null ? pts[hovered] : null;
  const tipX  = tip ? Math.min(Math.max(tip.x - TIP_W / 2, 0), w - TIP_W) : 0;

  return (
    <svg width="100%" viewBox={`0 0 ${w} ${h}`} className="overflow-visible">
      {/* Y-axis gridlines + labels */}
      {yTicks.map((t, i) => (
        <g key={i}>
          <line x1={pL} y1={t.y} x2={w - pR} y2={t.y} stroke="#e4e8f8" strokeWidth="1" />
          <text x={pL - 5} y={t.y + 3.5} textAnchor="end" fontSize="9" fill="#424754">{t.val}</text>
        </g>
      ))}

      {/* Area fill */}
      <polygon points={fillPts} fill="#0058be12" />

      {/* Line */}
      <polyline
        points={pts.map((p) => `${p.x},${p.y}`).join(" ")}
        fill="none"
        stroke="#0058be"
        strokeWidth="2.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      {/* Data points + date labels */}
      {pts.map((p, i) => (
        <g key={i} onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)} style={{ cursor: "default" }}>
          <circle cx={p.x} cy={p.y} r={14} fill="transparent" />
          <circle
            cx={p.x} cy={p.y} r={hovered === i ? 5 : 3.5}
            fill={hovered === i ? "#0058be" : "white"}
            stroke="#0058be"
            strokeWidth="2"
          />
          <text x={p.x} y={h - 6} textAnchor="middle" fontSize="9" fill="#424754">{p.date}</text>
        </g>
      ))}

      {/* Hover tooltip */}
      {tip && (
        <g>
          <rect x={tipX} y={tip.y - 30} width={TIP_W} height={22} rx={5} fill="#141b2b" opacity="0.88" />
          <text x={tipX + TIP_W / 2} y={tip.y - 14} textAnchor="middle" fontSize="10" fill="white" fontWeight="500">
            {tip.date}: {tip.count} comic{tip.count !== 1 ? "s" : ""}
          </text>
        </g>
      )}
    </svg>
  );
}

function FunnelChart({ funnel }: { funnel: FunnelData }) {
  const steps = [
    { label: "Step 1 — Story Analysis",   value: funnel.step1,    color: "#0058be" },
    { label: "Step 2 — Character Design", value: funnel.step2,    color: "#2170e4" },
    { label: "Step 3 — Script",           value: funnel.step3,    color: "#6366f1" },
    { label: "Step 4 — Image Generation", value: funnel.step4,    color: "#8b5cf6" },
    { label: "Exported",                  value: funnel.exported, color: "#a855f7" },
  ];

  if (steps.every((s) => s.value === 0)) {
    return <p className="text-on-surface-variant text-sm py-4 text-center">No pipeline data for this period.</p>;
  }

  const max = steps[0].value || 1;
  return (
    <div className="space-y-2.5">
      {steps.map((s, i) => {
        const pct  = Math.round((s.value / max) * 100);
        const drop = i > 0 ? Math.round(((steps[i - 1].value - s.value) / (steps[i - 1].value || 1)) * 100) : 0;
        return (
          <div key={i} className="flex items-center gap-3">
            <span className="text-on-surface-variant text-xs font-medium text-right shrink-0" style={{ width: 180 }}>
              {s.label}
            </span>
            <div className="flex-1 bg-surface-container rounded-lg h-7 overflow-hidden">
              <div
                className="h-full rounded-lg transition-all duration-500"
                style={{
                  width: s.value === 0 ? "0%" : `${Math.max(pct, 2)}%`,
                  backgroundColor: s.color + "33",
                  borderRight: s.value > 0 ? `3px solid ${s.color}99` : "none",
                }}
              />
            </div>
            <div className="flex items-center gap-2 shrink-0" style={{ minWidth: 90 }}>
              <span className="text-on-surface text-sm font-mono w-7 text-right">{s.value.toLocaleString()}</span>
              <span className="text-xs font-bold w-8 text-right" style={{ color: s.value > 0 ? s.color : "#9ca3af" }}>
                {s.value > 0 ? `${pct}%` : "—"}
              </span>
              {i > 0 && drop > 0 && <span className="text-red-500 text-xs">-{drop}%</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Shared Components ───────────────────────────────────────────────────────

function KPICard({ title, value, sub, color = "#0058be" }: { title: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="bg-white border border-outline-variant rounded-2xl p-5 shadow-sm">
      <p className="text-on-surface-variant text-xs uppercase tracking-widest mb-2 font-semibold">{title}</p>
      <p className="text-3xl font-bold" style={{ color }}>{value ?? "—"}</p>
      {sub && <p className="text-on-surface-variant text-xs mt-1">{sub}</p>}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-outline-variant rounded-2xl p-6 shadow-sm">
      <h3 className="text-on-surface font-bold text-sm uppercase tracking-wide mb-4 border-b border-outline-variant pb-3">{title}</h3>
      {children}
    </div>
  );
}

function Loading() {
  return <div className="text-center py-20 text-on-surface-variant animate-pulse">Loading data…</div>;
}

// ─── Tab: Overview ───────────────────────────────────────────────────────────

function OverviewTab({ adminKey, days }: { adminKey: string; days: string }) {
  const [data, setData] = useState<OverviewData | null>(null);

  useEffect(() => {
    const params = days !== "0" ? `?days=${days}` : "";
    fetch(`${API}/admin/overview${params}`, { headers: { "X-Admin-Key": adminKey } })
      .then((r) => r.json())
      .then(setData)
      .catch(console.error);
  }, [adminKey, days]);

  if (!data) return <Loading />;

  const { kpis, funnel, comics_per_day, reactions } = data;
  const reactionSlices = [
    { label: "Love ❤️", value: reactions["love"] ?? 0, color: "#e11d48" },
    { label: "Good 👍", value: reactions["good"] ?? 0, color: "#10b981" },
    { label: "Neutral 😐", value: reactions["neutral"] ?? 0, color: "#f59e0b" },
    { label: "Bad 👎", value: reactions["bad"] ?? 0, color: "#9ca3af" },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        <KPICard title="Total Users" value={kpis.total_users.toLocaleString()} color="#0058be" />
        <KPICard title="Comics Created" value={kpis.comics_created.toLocaleString()} color="#6366f1" />
        <KPICard title="Images Generated" value={kpis.images_generated.toLocaleString()} color="#8b5cf6" />
        <KPICard title="Avg Rating" value={kpis.avg_rating !== null ? `${kpis.avg_rating} ★` : "—"} sub={`${kpis.rating_count} ratings`} color="#f59e0b" />
        <KPICard title="Avg Regens / Comic" value={kpis.avg_regen_per_comic} color="#10b981" />
        <KPICard
          title="Completion Rate"
          value={kpis.comics_created > 0 ? `${Math.round((funnel.exported / kpis.comics_created) * 100)}%` : "—"}
          sub="started → exported"
          color="#e11d48"
        />
      </div>

      <Section title="Pipeline Funnel">
        <FunnelChart funnel={funnel} />
      </Section>

      <div className="grid grid-cols-2 gap-6">
        <Section title="Comics Started — Last 7 Days">
          <LineChart data={comics_per_day} />
        </Section>
        <Section title="Panel Reaction Distribution">
          <DonutChart slices={reactionSlices} />
        </Section>
      </div>
    </div>
  );
}

// ─── Tab: Quality ─────────────────────────────────────────────────────────────

function QualityTab({ adminKey, days }: { adminKey: string; days: string }) {
  const [data, setData] = useState<QualityData | null>(null);

  useEffect(() => {
    const params = days !== "0" ? `?days=${days}` : "";
    fetch(`${API}/admin/quality${params}`, { headers: { "X-Admin-Key": adminKey } })
      .then((r) => r.json())
      .then(setData)
      .catch(console.error);
  }, [adminKey, days]);

  if (!data) return <Loading />;

  const { comic_stats, panel_stats, regen_impact, style_ratings, positive_keywords, negative_keywords } = data;

  const starDist = [5, 4, 3, 2, 1].map((s) => ({
    label: `${s} ★`,
    value: comic_stats[`rated_${s}` as keyof typeof comic_stats] as number ?? 0,
  }));

  const panelReactionData = [
    { label: "Love ❤️", value: panel_stats.love },
    { label: "Good 👍", value: panel_stats.good },
    { label: "Neutral 😐", value: panel_stats.neutral },
    { label: "Bad 👎", value: panel_stats.bad },
  ];

  const regenImpactData = regen_impact.map((r) => ({ label: `V${r.version}`, value: r.avg_score, count: r.count }));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        <KPICard title="Avg Comic Rating" value={comic_stats.avg_stars ? `${comic_stats.avg_stars} ★` : "—"} sub={`${comic_stats.count ?? 0} comics rated`} color="#f59e0b" />
        <KPICard title="Panel Reactions" value={panel_stats.total.toLocaleString()} sub="total reactions" color="#0058be" />
        <KPICard title="Positive Rate" value={panel_stats.total > 0 ? `${Math.round(((panel_stats.love + panel_stats.good) / panel_stats.total) * 100)}%` : "—"} sub="love + good reactions" color="#10b981" />
      </div>

      <div className="grid grid-cols-2 gap-6">
        <Section title="Star Rating Distribution">
          <BarChart data={starDist} labelKey="label" valueKey="value" color="#f59e0b" />
        </Section>
        <Section title="Panel Reactions">
          {panel_stats.total > 0 && (
            <p className="text-on-surface-variant text-xs mb-3">
              {panel_stats.total.toLocaleString()} reaction{panel_stats.total !== 1 ? "s" : ""} total
            </p>
          )}
          <BarChart data={panelReactionData} labelKey="label" valueKey="value" color="#0058be" total={panel_stats.total} />
        </Section>
      </div>

      <Section title="Quality Score by Panel Version (1=original, 2+=regen'd)">
        {regen_impact.length > 0 ? (
          <>
            <BarChart data={regenImpactData} labelKey="label" valueKey="value" color="#10b981" />
            <p className="text-on-surface-variant text-xs mt-3">Score: Love=4, Good=3, Neutral=2, Bad=1</p>
          </>
        ) : (
          <p className="text-on-surface-variant text-sm">No data yet for this period.</p>
        )}
      </Section>

      <Section title="Avg Rating by Art Style">
        {style_ratings.length > 0 ? (
          <BarChart data={style_ratings} labelKey="style" valueKey="avg_stars" color="#8b5cf6" />
        ) : (
          <p className="text-on-surface-variant text-sm">No data yet for this period.</p>
        )}
      </Section>

      <div className="grid grid-cols-2 gap-6">
        <Section title="Common Positive Keywords">
          {positive_keywords.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {positive_keywords.map((k, i) => (
                <span key={i} className="bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full px-3 py-1 text-xs font-medium">
                  {k.word} <span className="opacity-60">×{k.count}</span>
                </span>
              ))}
            </div>
          ) : (
            <p className="text-on-surface-variant text-sm">No data yet for this period.</p>
          )}
        </Section>
        <Section title="Common Negative Keywords">
          {negative_keywords.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {negative_keywords.map((k, i) => (
                <span key={i} className="bg-red-50 text-red-600 border border-red-200 rounded-full px-3 py-1 text-xs font-medium">
                  {k.word} <span className="opacity-60">×{k.count}</span>
                </span>
              ))}
            </div>
          ) : (
            <p className="text-on-surface-variant text-sm">No data yet for this period.</p>
          )}
        </Section>
      </div>
    </div>
  );
}

// ─── Tab: Regeneration ───────────────────────────────────────────────────────

function RegenerationTab({ adminKey, days }: { adminKey: string; days: string }) {
  const [data, setData] = useState<RegenData | null>(null);

  useEffect(() => {
    const params = days !== "0" ? `?days=${days}` : "";
    fetch(`${API}/admin/regeneration${params}`, { headers: { "X-Admin-Key": adminKey } })
      .then((r) => r.json())
      .then(setData)
      .catch(console.error);
  }, [adminKey, days]);

  if (!data) return <Loading />;

  const { overview, most_regenned, before_after_samples, trigger_reactions, regen_depth } = data;

  const reactionEmoji: Record<string, string> = { love: "❤️", good: "👍", neutral: "😐", bad: "👎" };
  const _reactionColor: Record<string, string> = { love: "#e11d48", good: "#10b981", neutral: "#f59e0b", bad: "#9ca3af" };

  const triggerData = [
    { label: "Love ❤️",    value: trigger_reactions?.["love"]    ?? 0 },
    { label: "Good 👍",    value: trigger_reactions?.["good"]    ?? 0 },
    { label: "Neutral 😐", value: trigger_reactions?.["neutral"] ?? 0 },
    { label: "Bad 👎",     value: trigger_reactions?.["bad"]     ?? 0 },
  ];

  const depthData = (regen_depth ?? []).map((d) => ({ label: d.depth, value: d.count }));

  const improvedCount  = before_after_samples.filter((s) => s.improved).length;
  const totalSamples   = before_after_samples.length;

  return (
    <div className="space-y-6">
      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <KPICard title="Total Regens"       value={(overview?.total_regens ?? 0).toLocaleString()} color="#f59e0b" />
        <KPICard title="Avg / Comic"        value={overview?.avg_per_comic ?? 0} color="#0058be" />
        <KPICard
          title="Comics with Regen"
          value={overview?.comics_with_regen ?? 0}
          sub={`of ${overview?.total_comics ?? 0} total`}
          color="#8b5cf6"
        />
        <KPICard
          title="% Users who Regen'd"
          value={overview?.pct_users_regen != null ? `${overview.pct_users_regen}%` : "0%"}
          color="#10b981"
        />
        <KPICard
          title="Improvement Rate"
          value={overview?.improvement_rate != null ? `${overview.improvement_rate}%` : totalSamples > 0 ? `${Math.round(improvedCount / totalSamples * 100)}%` : "—"}
          sub="panels rated better after regen"
          color="#0058be"
        />
      </div>

      {/* Regen behaviour analysis */}
      <div className="grid grid-cols-2 gap-6">
        <Section title="What Triggered Regeneration?">
          {triggerData.some((d) => d.value > 0) ? (
            <>
              <BarChart data={triggerData} labelKey="label" valueKey="value" color="#e11d48" />
              <p className="text-on-surface-variant text-xs mt-3">Reaction on V1 of panels that were subsequently regenerated</p>
            </>
          ) : (
            <div className="py-8 text-center">
              <p className="text-on-surface-variant text-sm">No regeneration trigger data yet.</p>
              <p className="text-on-surface-variant text-xs mt-1">Appears once users regenerate panels after rating them.</p>
            </div>
          )}
        </Section>

        <Section title="Regen Frequency per Panel">
          {depthData.length > 0 ? (
            <>
              <BarChart data={depthData} labelKey="label" valueKey="value" color="#8b5cf6" />
              <p className="text-on-surface-variant text-xs mt-3">How many times users regenerated the same panel</p>
            </>
          ) : (
            <div className="py-8 text-center">
              <p className="text-on-surface-variant text-sm">No frequency data yet.</p>
              <p className="text-on-surface-variant text-xs mt-1">Appears once panels have been regenerated at least once.</p>
            </div>
          )}
        </Section>
      </div>

      {/* Before → After outcome */}
      <Section title="Regeneration Outcome — Before → After Reactions">
        {before_after_samples.length > 0 ? (
          <>
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 flex-1 text-center">
                <p className="text-on-surface-variant text-xs uppercase tracking-widest mb-1 font-semibold">Improved</p>
                <p className="text-2xl font-bold text-emerald-600">{improvedCount}</p>
                <p className="text-on-surface-variant text-xs mt-0.5">panels</p>
              </div>
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex-1 text-center">
                <p className="text-on-surface-variant text-xs uppercase tracking-widest mb-1 font-semibold">No change / worse</p>
                <p className="text-2xl font-bold text-red-500">{totalSamples - improvedCount}</p>
                <p className="text-on-surface-variant text-xs mt-0.5">panels</p>
              </div>
              <div className="bg-surface-container-low border border-outline-variant rounded-xl px-4 py-3 flex-1 text-center">
                <p className="text-on-surface-variant text-xs uppercase tracking-widest mb-1 font-semibold">Sample size</p>
                <p className="text-2xl font-bold text-on-surface">{totalSamples}</p>
                <p className="text-on-surface-variant text-xs mt-0.5">panels compared</p>
              </div>
            </div>
            <div className="space-y-2">
              {before_after_samples.map((s, i) => (
                <div key={i} className="flex items-center gap-3 bg-surface-container-low rounded-xl px-4 py-2.5 text-sm">
                  <span className="text-on-surface-variant font-mono text-xs truncate max-w-[160px]">{s.panel_id}</span>
                  <span className="flex items-center gap-1.5 ml-auto">
                    <span className="text-base">{reactionEmoji[s.v1] ?? s.v1}</span>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 8h10M9 4l4 4-4 4" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    <span className="text-base">{reactionEmoji[s.v2] ?? s.v2}</span>
                  </span>
                  <span className={`text-xs font-semibold ml-3 w-28 text-right ${s.improved ? "text-emerald-600" : "text-red-500"}`}>
                    {s.improved ? "Improved ↑" : "No change / worse"}
                  </span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="py-8 text-center">
            <p className="text-on-surface-variant text-sm">No before/after comparison data yet.</p>
            <p className="text-on-surface-variant text-xs mt-1">Appears once users rate multiple versions of the same panel.</p>
          </div>
        )}
      </Section>

      {/* Most regenerated pages */}
      <Section title="Most Regenerated Panels">
        {most_regenned.length > 0 ? (
          <div className="space-y-2">
            {most_regenned.slice(0, 8).map((r, i) => (
              <div key={i} className="flex items-center justify-between bg-surface-container-low rounded-xl px-4 py-2.5 text-sm">
                <div className="flex items-center gap-3">
                  <span className="text-on-surface-variant text-xs font-mono w-5 text-right">{i + 1}.</span>
                  <span className="text-on-surface-variant font-mono text-xs truncate max-w-xs">{r.panel_id}</span>
                </div>
                <span className="text-primary font-semibold">{r.total_regens}× regen&apos;d</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-8 text-center">
            <p className="text-on-surface-variant text-sm">No panels have been regenerated yet.</p>
            <p className="text-on-surface-variant text-xs mt-1">Appears once users request image regeneration in Step 4.</p>
          </div>
        )}
      </Section>
    </div>
  );
}

// ─── Tab: Export ─────────────────────────────────────────────────────────────

function ExportTab({ adminKey, days }: { adminKey: string; days: string }) {
  const [loading, setLoading] = useState<string | null>(null);
  const [report, setReport] = useState<string | null>(null);

  const download = useCallback(async (tab: string, fmt: string) => {
    setLoading(`${tab}-${fmt}`);
    try {
      const params = new URLSearchParams({ tab, fmt, ...(days !== "0" ? { days } : {}) });
      const res = await fetch(`${API}/admin/export?${params}`, { headers: { "X-Admin-Key": adminKey } });
      const json = await res.json();
      let content: string;
      let filename: string;
      if (fmt === "csv") {
        content = json.csv;
        filename = json.filename ?? `${tab}.csv`;
      } else {
        content = JSON.stringify(json.data, null, 2);
        filename = `${tab}_${days !== "0" ? days + "d" : "all"}.json`;
      }
      const blob = new Blob([content], { type: fmt === "csv" ? "text/csv" : "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = filename; a.click();
      URL.revokeObjectURL(url);
    } finally {
      setLoading(null);
    }
  }, [adminKey, days]);

  const generateReport = useCallback(async () => {
    setLoading("report");
    try {
      const params = days !== "0" ? `?days=${days}` : "";
      const res = await fetch(`${API}/admin/thesis-report${params}`, { headers: { "X-Admin-Key": adminKey } });
      const json = await res.json();
      setReport(json.report);
    } finally {
      setLoading(null);
    }
  }, [adminKey, days]);

  const downloadReport = () => {
    if (!report) return;
    const blob = new Blob([report], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "mohiom_thesis_report.md"; a.click();
    URL.revokeObjectURL(url);
  };

  const datasets = [
    { tab: "panel_ratings", label: "Panel Reactions", desc: "All per-page emoji reactions with regen metadata" },
    { tab: "comic_ratings", label: "Comic Ratings", desc: "Overall star ratings, comments, session time" },
    { tab: "projects", label: "Projects / Funnel", desc: "Project step completion flags per user" },
  ];

  return (
    <div className="space-y-6">
      <Section title="Export Raw Data">
        <div className="space-y-3">
          {datasets.map((d) => (
            <div key={d.tab} className="flex items-center justify-between bg-surface-container-low rounded-xl px-5 py-4">
              <div>
                <p className="text-on-surface text-sm font-semibold">{d.label}</p>
                <p className="text-on-surface-variant text-xs mt-0.5">{d.desc}</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => download(d.tab, "json")}
                  disabled={!!loading}
                  className="bg-surface-container-high hover:bg-surface-container-highest text-on-surface text-xs px-4 py-2 rounded-lg font-medium transition disabled:opacity-50 border border-outline-variant"
                >
                  {loading === `${d.tab}-json` ? "…" : "JSON"}
                </button>
                <button
                  onClick={() => download(d.tab, "csv")}
                  disabled={!!loading}
                  className="bg-primary hover:opacity-90 text-on-primary text-xs px-4 py-2 rounded-lg font-medium transition disabled:opacity-50"
                >
                  {loading === `${d.tab}-csv` ? "…" : "CSV"}
                </button>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Thesis Report">
        <div className="space-y-4">
          <p className="text-on-surface-variant text-sm">Generate a markdown evaluation summary with key metrics, funnel analysis, and quality findings suitable for thesis appendix.</p>
          <div className="flex gap-3">
            <button
              onClick={generateReport}
              disabled={!!loading}
              className="bg-primary hover:opacity-90 text-on-primary px-6 py-2.5 rounded-xl text-sm font-semibold transition disabled:opacity-50"
            >
              {loading === "report" ? "Generating…" : "Generate Thesis Report"}
            </button>
            {report && (
              <button
                onClick={downloadReport}
                className="bg-emerald-600 hover:opacity-90 text-white px-6 py-2.5 rounded-xl text-sm font-semibold transition"
              >
                Download .md
              </button>
            )}
          </div>
          {report && (
            <pre className="bg-surface-container-low rounded-xl p-5 text-xs text-on-surface whitespace-pre-wrap overflow-auto max-h-96 font-mono border border-outline-variant">
              {report}
            </pre>
          )}
        </div>
      </Section>
    </div>
  );
}

// ─── Tab: Characters ─────────────────────────────────────────────────────────

interface CharVersionQuality { version: number; label: string; avg_score: number; pct: number; count: number }
interface CharRoleQuality    { key: string; label: string; avg_score: number; pct: number; count: number }
interface ChipEntry          { chip: string; label: string; count: number; pct: number }
interface CorrelationRow     { char_reaction: string; avg_panel_score: number | null; comic_count: number }

interface CharactersData {
  kpis: {
    total_chars_generated: number;
    total_chars_rated: number;
    avg_versions: number | null;
    avg_char_stars: number | null;
    approval_rate: number | null;
  };
  version_quality: CharVersionQuality[];
  v1_v2_jump: number | null;
  role_quality: CharRoleQuality[];
  mode_quality: CharRoleQuality[];
  chip_analysis: ChipEntry[];
  correlation: {
    pearson_r: number | null;
    reaction_table: CorrelationRow[];
    sample_count: number;
  };
  funnel: {
    generated: number;
    rated: number;
    regenerated: number;
    approved: number;
  };
}

function ScoreBar({ pct, color, label }: { pct: number; color: string; label: string }) {
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="text-on-surface-variant w-28 truncate text-right text-xs">{label}</span>
      <div className="flex-1 bg-surface-container rounded-full h-5 overflow-hidden">
        <div
          className="h-full rounded-full flex items-center justify-end pr-2 text-xs text-white font-medium"
          style={{ width: `${Math.max(pct, 4)}%`, backgroundColor: color }}
        >
          {pct > 18 && `${pct}%`}
        </div>
      </div>
      {pct <= 18 && <span className="text-on-surface text-xs w-8">{pct}%</span>}
    </div>
  );
}

function CharacterFunnel({ funnel }: { funnel: CharactersData["funnel"] }) {
  const steps = [
    { label: "Generated",   value: funnel.generated,   color: "#0058be" },
    { label: "Rated",       value: funnel.rated,        color: "#6366f1" },
    { label: "Regenerated", value: funnel.regenerated,  color: "#8b5cf6" },
    { label: "Approved",    value: funnel.approved,     color: "#10b981" },
  ];

  const gen    = funnel.generated;
  const noData = steps.every((s) => s.value === 0);

  if (noData) {
    return (
      <p className="text-on-surface-variant text-sm py-4 text-center">
        Generate and rate characters to see the funnel.
      </p>
    );
  }

  return (
    <div className="space-y-2.5">
      {gen === 0 && (
        <p className="text-on-surface-variant text-xs mb-2 italic">
          Character generation events not yet tracked — percentages unavailable.
        </p>
      )}
      {steps.map((s, i) => {
        // All percentages relative to Generated; cap at 100%; never negative
        const barPct  = gen > 0 ? Math.min(Math.round((s.value / gen) * 100), 100) : 0;
        const prevVal = i > 0 ? steps[i - 1].value : 0;
        const drop    = (i > 0 && prevVal > 0)
          ? Math.max(0, Math.round(((prevVal - s.value) / prevVal) * 100))
          : 0;
        return (
          <div key={i} className="flex items-center gap-3">
            <span className="text-on-surface-variant text-xs font-medium text-right shrink-0 w-24">
              {s.label}
            </span>
            <div className="flex-1 bg-surface-container rounded-lg h-7 overflow-hidden">
              <div
                className="h-full rounded-lg transition-all duration-500"
                style={{
                  width: `${s.value > 0 ? Math.max(barPct, 3) : 0}%`,
                  backgroundColor: s.color + "33",
                  borderRight: s.value > 0 ? `3px solid ${s.color}99` : "none",
                }}
              />
            </div>
            <div className="flex items-center gap-2 shrink-0" style={{ minWidth: 80 }}>
              <span className="text-on-surface text-sm font-mono w-6 text-right">{s.value.toLocaleString()}</span>
              <span className="text-xs font-bold w-7 text-right" style={{ color: gen > 0 ? s.color : "#9ca3af" }}>
                {gen > 0 ? `${barPct}%` : "—"}
              </span>
              {i > 0 && drop > 0 && <span className="text-red-500 text-xs">-{drop}%</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CharactersTab({ adminKey, days }: { adminKey: string; days: string }) {
  const [data, setData] = useState<CharactersData | null>(null);

  useEffect(() => {
    const params = days !== "0" ? `?days=${days}` : "";
    fetch(`${API}/admin/characters${params}`, { headers: { "X-Admin-Key": adminKey } })
      .then((r) => r.json())
      .then(setData)
      .catch(console.error);
  }, [adminKey, days]);

  const downloadCSV = useCallback(() => {
    if (!data) return;
    const rows: string[] = ["section,label,value,extra"];
    data.version_quality.forEach((v) =>
      rows.push(`version_quality,${v.label},${v.avg_score},count=${v.count}`));
    data.role_quality.forEach((r) =>
      rows.push(`role_quality,${r.label},${r.avg_score},count=${r.count}`));
    data.mode_quality.forEach((m) =>
      rows.push(`mode_quality,${m.label},${m.avg_score},count=${m.count}`));
    data.chip_analysis.forEach((c) =>
      rows.push(`chip_analysis,${c.label},${c.count},pct=${c.pct}`));
    data.correlation.reaction_table.forEach((r) =>
      rows.push(`correlation,char_reaction=${r.char_reaction},${r.avg_panel_score ?? ""},n=${r.comic_count}`));
    rows.push(`pearson_r,r,${data.correlation.pearson_r ?? ""},n=${data.correlation.sample_count}`);
    Object.entries(data.funnel).forEach(([k, v]) => rows.push(`funnel,${k},${v},`));
    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "characters_analytics.csv"; a.click();
    URL.revokeObjectURL(url);
  }, [data]);

  if (!data) return <Loading />;

  const { kpis, version_quality, v1_v2_jump, role_quality, mode_quality, chip_analysis, correlation, funnel } = data;

  const reactionEmoji: Record<string, string> = { love: "😍", good: "👍", neutral: "😐", bad: "👎" };
  const reactionColor: Record<string, string> = { love: "#10b981", good: "#0058be", neutral: "#f59e0b", bad: "#ef4444" };

  const versionColors = ["#0058be", "#6366f1", "#8b5cf6", "#a855f7"];

  const VERSION_SLOTS = [
    { version: 0, label: "V1 — Original",      hint: "First generation" },
    { version: 1, label: "V2 — 1st regen",     hint: "Appears after first regeneration" },
    { version: 2, label: "V3 — 2nd regen",     hint: "Appears after second regeneration" },
    { version: 3, label: "V4+ — 3rd regen+",   hint: "Appears after 3+ regenerations" },
  ];
  const dataByVersion = new Map(version_quality.map((v) => [v.version, v]));

  const pearsonLabel = (r: number | null) => {
    if (r === null) return { text: "Insufficient data", color: "#9ca3af" };
    if (r >= 0.7)  return { text: `Strong positive (r=${r})`, color: "#10b981" };
    if (r >= 0.4)  return { text: `Moderate positive (r=${r})`, color: "#84cc16" };
    if (r >= 0.1)  return { text: `Weak positive (r=${r})`, color: "#f59e0b" };
    if (r >= -0.1) return { text: `No correlation (r=${r})`, color: "#9ca3af" };
    return { text: `Negative correlation (r=${r})`, color: "#ef4444" };
  };
  const pLabel = pearsonLabel(correlation.pearson_r);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-4 gap-4">
        <KPICard title="Characters Generated" value={(kpis.total_chars_generated || 0).toLocaleString()} color="#0058be" />
        <KPICard title="Avg Versions / Char" value={kpis.avg_versions ?? "—"} sub="from character-set ratings" color="#6366f1" />
        <KPICard title="Avg Character Stars" value={kpis.avg_char_stars ? `${kpis.avg_char_stars} ★` : "—"} color="#f59e0b" />
        <KPICard title="Approval Rate" value={kpis.approval_rate != null ? `${kpis.approval_rate}%` : "—"} sub={`${kpis.total_chars_rated} rated`} color="#10b981" />
      </div>

      <Section title="Does More Versions = Better Character Design?">
        <div className="space-y-3">
          {VERSION_SLOTS.map((slot, i) => {
            const v = dataByVersion.get(slot.version);
            const pct = v ? v.pct : 0;
            return (
              <div key={i} className="flex items-center gap-3 text-sm">
                <span className="text-on-surface-variant text-right text-xs shrink-0 w-36">{slot.label}</span>
                <div className="relative flex-1">
                  {/* Track */}
                  <div className="bg-surface-container rounded-full h-5 overflow-hidden">
                    {v ? (
                      <div
                        className="h-full rounded-full transition-all duration-500 flex items-center justify-end pr-2 text-xs text-white font-medium"
                        style={{ width: `${Math.max(pct, 4)}%`, backgroundColor: versionColors[Math.min(i, 3)] }}
                      >
                        {pct > 20 && `${pct}%`}
                      </div>
                    ) : (
                      <div className="h-full rounded-full" style={{ width: "2%", backgroundColor: "#e4e8f8" }} />
                    )}
                  </div>
                  {/* Reference line at 75% = score 3.0 = "Good" */}
                  <div
                    className="absolute inset-y-0 border-r-2 border-dashed border-amber-400/75 pointer-events-none"
                    style={{ left: "75%" }}
                  />
                </div>
                {v ? (
                  <>
                    {pct <= 20 && <span className="text-on-surface text-xs w-8">{pct}%</span>}
                    <span className="text-on-surface-variant text-xs font-mono shrink-0">{v.avg_score}/4.0</span>
                  </>
                ) : (
                  <span className="text-on-surface-variant text-xs italic opacity-50 shrink-0 w-32">{slot.hint}</span>
                )}
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="mt-4 pt-3 border-t border-outline-variant flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-on-surface-variant">
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-5 border-t-2 border-dashed border-amber-400/75" />
            Good threshold (score 3.0 = 75%)
          </span>
          <span>Score scale: Love=4 · Good=3 · Neutral=2 · Bad=1 · Max=4.0</span>
          {version_quality.length > 0 && (
            <span>n={version_quality.reduce((s, v) => s + v.count, 0)} ratings</span>
          )}
        </div>

        {v1_v2_jump !== null && (
          <div className="mt-3 bg-primary/5 border border-primary/20 rounded-xl px-4 py-3 text-sm text-primary">
            <span className="font-semibold">Finding: </span>
            V2 characters score <span className="font-bold">{v1_v2_jump > 0 ? "+" : ""}{v1_v2_jump}%</span> higher than V1 — iterative regeneration demonstrably improves character design quality.
          </div>
        )}
      </Section>

      <div className="grid grid-cols-2 gap-6">
        <Section title="Avg Quality Score by Character Role">
          {role_quality.length > 0 ? (
            <div className="space-y-2.5">
              {role_quality.map((r, i) => (
                <ScoreBar key={i} label={r.label} pct={r.pct} color="#8b5cf6" />
              ))}
            </div>
          ) : <p className="text-on-surface-variant text-sm">No role data yet — appears after characters are rated by role.</p>}
        </Section>
        <Section title="Avg Quality Score by Generation Mode">
          {mode_quality.length > 0 ? (
            <div className="space-y-2.5">
              {mode_quality.map((m, i) => (
                <ScoreBar key={i} label={m.label} pct={m.pct} color="#06b6d4" />
              ))}
            </div>
          ) : <p className="text-on-surface-variant text-sm">No generation mode data yet — appears after characters are generated and rated.</p>}
        </Section>
      </div>

      <Section title="Top Character Design Complaints">
        {chip_analysis.length > 0 ? (
          <>
            <div className="space-y-2.5">
              {chip_analysis.map((c, i) => (
                <div key={i} className="flex items-center gap-3 text-sm">
                  <span className="text-on-surface-variant w-40 truncate text-right text-xs">{c.label}</span>
                  <div className="flex-1 bg-surface-container rounded-full h-5 overflow-hidden">
                    <div
                      className="h-full rounded-full flex items-center justify-end pr-2 text-xs text-white font-medium"
                      style={{ width: `${Math.max(c.pct, 4)}%`, backgroundColor: "#ef4444" }}
                    >
                      {c.pct > 15 && `${c.pct}%`}
                    </div>
                  </div>
                  <span className="text-on-surface text-xs w-14">{c.count}× ({c.pct}%)</span>
                </div>
              ))}
            </div>
            <p className="text-on-surface-variant text-xs mt-3">% of negative-rated characters that selected each complaint chip</p>
          </>
        ) : <p className="text-on-surface-variant text-sm">No complaint data yet — appears when users submit 😐 or 👎 ratings and select specific feedback chips.</p>}
      </Section>

      <Section title="Character Design Quality → Panel Image Quality">
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="bg-surface-container-low rounded-xl px-5 py-4 flex-1 text-center border border-outline-variant">
              <p className="text-on-surface-variant text-xs uppercase tracking-widest mb-1 font-semibold">Pearson r</p>
              <p className="text-2xl font-bold" style={{ color: pLabel.color }}>
                {correlation.pearson_r !== null ? correlation.pearson_r : "—"}
              </p>
              <p className="text-xs mt-1 font-medium" style={{ color: pLabel.color }}>{pLabel.text}</p>
            </div>
            <div className="bg-surface-container-low rounded-xl px-5 py-4 flex-1 text-center border border-outline-variant">
              <p className="text-on-surface-variant text-xs uppercase tracking-widest mb-1 font-semibold">Sample Comics</p>
              <p className="text-2xl font-bold text-on-surface">{correlation.sample_count}</p>
              <p className="text-on-surface-variant text-xs mt-1">with both char + panel ratings</p>
            </div>
          </div>
          {correlation.reaction_table.length > 0 && (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-outline-variant">
                  <th className="text-left text-on-surface-variant text-xs py-2 font-semibold">Character Rating</th>
                  <th className="text-right text-on-surface-variant text-xs py-2 font-semibold">Avg Panel Score</th>
                  <th className="text-right text-on-surface-variant text-xs py-2 font-semibold">Comics</th>
                </tr>
              </thead>
              <tbody>
                {correlation.reaction_table.map((row, i) => (
                  <tr key={i} className="border-b border-outline-variant/50">
                    <td className="py-2.5 text-on-surface">
                      <span className="mr-2">{reactionEmoji[row.char_reaction] ?? row.char_reaction}</span>
                      <span className="capitalize">{row.char_reaction}</span>
                    </td>
                    <td className="py-2.5 text-right font-mono font-semibold" style={{ color: reactionColor[row.char_reaction] ?? "#424754" }}>
                      {row.avg_panel_score !== null ? row.avg_panel_score.toFixed(2) : "—"}
                    </td>
                    <td className="py-2.5 text-right text-on-surface-variant">{row.comic_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {correlation.reaction_table.length === 0 && (
            <p className="text-on-surface-variant text-sm">No correlation data yet — appears when comics have both character ratings and panel image ratings.</p>
          )}
        </div>
      </Section>

      <Section title="Character Design Funnel">
        <CharacterFunnel funnel={funnel} />
      </Section>

      <div className="flex justify-end">
        <button
          onClick={downloadCSV}
          className="bg-primary hover:opacity-90 text-on-primary text-sm px-5 py-2.5 rounded-xl font-semibold transition"
        >
          Export Characters CSV
        </button>
      </div>
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

type Tab = "overview" | "characters" | "quality" | "regeneration" | "export";

const TABS: { id: Tab; label: string }[] = [
  { id: "overview",      label: "Overview" },
  { id: "characters",    label: "Characters" },
  { id: "quality",       label: "Quality" },
  { id: "regeneration",  label: "Regeneration" },
  { id: "export",        label: "Export" },
];

const DATE_RANGES: { value: DateRange; label: string }[] = [
  { value: "1", label: "Today" },
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "0", label: "All time" },
];

export default function AdminDashboardPage() {
  const [adminKey, setAdminKey] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("overview");
  const [days, setDays] = useState<DateRange>("7");
  const [authError, setAuthError] = useState(false);

  const handleAuth = async (key: string) => {
    try {
      const res = await fetch(`${API}/admin/overview?days=1`, { headers: { "X-Admin-Key": key } });
      if (res.status === 403) { setAuthError(true); return; }
      setAdminKey(key);
      setAuthError(false);
    } catch {
      setAuthError(true);
    }
  };

  if (!adminKey) {
    return (
      <div>
        <AdminAuth onAuth={handleAuth} />
        {authError && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-red-50 border border-red-200 text-red-700 px-5 py-3 rounded-xl text-sm shadow-lg font-medium">
            Invalid admin key. Try again.
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface text-on-surface">
      {/* Header */}
      <div className="border-b border-outline-variant bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center overflow-hidden">
              <Image src="/favicon-icon.png" alt="mOhiOm" width={28} height={28} className="h-7 w-7" />
            </div>
            <div>
              <h1 className="text-on-surface font-bold text-lg">mOhiOm Analytics</h1>
              <p className="text-on-surface-variant text-xs">Admin Dashboard · Thesis Evaluation</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex bg-surface-container rounded-xl p-1 gap-1">
              {DATE_RANGES.map((r) => (
                <button
                  key={r.value}
                  onClick={() => setDays(r.value)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${days === r.value ? "bg-primary text-on-primary shadow-sm" : "text-on-surface-variant hover:text-on-surface"}`}
                >
                  {r.label}
                </button>
              ))}
            </div>
            <button
              onClick={() => setAdminKey(null)}
              className="text-on-surface-variant hover:text-on-surface text-xs font-medium transition"
            >
              Sign out
            </button>
          </div>
        </div>
        {/* Tab bar */}
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex gap-1">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`px-5 py-3 text-sm font-semibold border-b-2 transition ${tab === t.id ? "border-primary text-primary" : "border-transparent text-on-surface-variant hover:text-on-surface"}`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {tab === "overview"     && <OverviewTab    adminKey={adminKey} days={days} />}
        {tab === "characters"   && <CharactersTab  adminKey={adminKey} days={days} />}
        {tab === "quality"      && <QualityTab     adminKey={adminKey} days={days} />}
        {tab === "regeneration" && <RegenerationTab adminKey={adminKey} days={days} />}
        {tab === "export"       && <ExportTab      adminKey={adminKey} days={days} />}
      </div>
    </div>
  );
}
