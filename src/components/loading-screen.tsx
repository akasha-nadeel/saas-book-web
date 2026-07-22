/**
 * The loading screen.
 *
 * The real logo (public/logo.png) masks the mark, and a bright fill rises from
 * the foot up behind it — the way Overleaf fills its leaf — over a dim copy.
 * All CSS (see .oc-loader in globals.css), so it needs no JavaScript, works as
 * a server component, and animates inside a fallback or during hydration.
 */
export function LoadingScreen({ leaving = false }: { leaving?: boolean }) {
  return (
    <div
      className={`oc-loader${leaving ? " oc-loader-leaving" : ""}`}
      role="status"
      aria-label="Loading"
    >
      {/* The logo isolates the shape; the two layers show only through it — a
          dim base, and a bright fill that scales up from its foot. */}
      <div className="oc-loader-mark" aria-hidden="true">
        <span className="oc-loader-base" />
        <span className="oc-loader-fill" />
      </div>

      <p className="oc-loader-text">Loading…</p>
    </div>
  );
}
