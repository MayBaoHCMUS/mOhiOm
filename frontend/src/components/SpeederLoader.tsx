export default function SpeederLoader() {
  return (
    <div
      role="status"
      aria-label="Working…"
      className="relative w-20 h-6 overflow-hidden flex-shrink-0 text-on-surface-variant/70"
    >
      <div className="speeder-loader" style={{ transform: 'scale(0.32)', transformOrigin: 'left center' }}>
        <div className="loader">
          <span><span /><span /><span /><span /></span>
          <div className="base">
            <span />
            <div className="face" />
          </div>
        </div>
        <div className="longfazers">
          <span /><span /><span /><span />
        </div>
      </div>
    </div>
  );
}
