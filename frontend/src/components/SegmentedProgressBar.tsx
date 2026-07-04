// ── Segmented progress bar: green=done, amber=errors, shimmer=loading ────────
export function SegmentedProgressBar({ total, success, error, loading, height = 12 }: {
  total: number; success: number; error: number; loading: number; height?: number;
}) {
  if (total === 0) return <div className="rounded-full bg-[#E5E7EB]" style={{ height }} />;
  const sPct = (success / total) * 100;
  const ePct = (error / total) * 100;
  const lPct = (loading / total) * 100;
  return (
    <div className="rounded-full bg-[#E5E7EB] overflow-hidden relative" style={{ height }}>
      {loading > 0 && (
        <div className="absolute top-0 h-full animate-shimmer"
          style={{ left: `${sPct + ePct}%`, width: `${lPct}%`,
            background: 'linear-gradient(90deg,#C7D2FE 25%,#A5B4FC 50%,#C7D2FE 75%)',
            backgroundSize: '200% 100%' }} />
      )}
      {error > 0 && (
        <div className="absolute top-0 h-full transition-all duration-500 bg-amber-400"
          style={{ left: `${sPct}%`, width: `${ePct}%` }} />
      )}
      <div className="absolute top-0 left-0 h-full rounded-l-full transition-all duration-500 bg-emerald-500"
        style={{ width: `${sPct}%` }} />
    </div>
  );
}
