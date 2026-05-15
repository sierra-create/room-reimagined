import { useRef, useState } from "react";

interface BeforeAfterSliderProps {
  before: string;
  after: string;
  beforeLabel?: string;
  afterLabel?: string;
}

export const BeforeAfterSlider = ({ before, after, beforeLabel = "Before", afterLabel = "After" }: BeforeAfterSliderProps) => {
  const [pos, setPos] = useState(50);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const updateFromClientX = (clientX: number) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const next = ((clientX - rect.left) / rect.width) * 100;
    setPos(Math.max(0, Math.min(100, next)));
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full aspect-square sm:aspect-[4/3] overflow-hidden rounded-xl shadow-soft select-none touch-none bg-muted"
      onMouseDown={(e) => { dragging.current = true; updateFromClientX(e.clientX); }}
      onMouseMove={(e) => dragging.current && updateFromClientX(e.clientX)}
      onMouseUp={() => (dragging.current = false)}
      onMouseLeave={() => (dragging.current = false)}
      onTouchStart={(e) => updateFromClientX(e.touches[0].clientX)}
      onTouchMove={(e) => updateFromClientX(e.touches[0].clientX)}
    >
      <img src={after} alt={afterLabel} className="absolute inset-0 w-full h-full object-cover" />
      <div className="absolute inset-0 overflow-hidden" style={{ width: `${pos}%` }}>
        <img
          src={before}
          alt={beforeLabel}
          className="absolute inset-0 h-full object-cover"
          style={{ width: containerRef.current?.clientWidth ?? "100%", maxWidth: "none" }}
        />
      </div>

      <span className="absolute top-3 left-3 text-xs font-semibold uppercase tracking-wide bg-background/90 text-foreground rounded-full px-3 py-1">
        {beforeLabel}
      </span>
      <span className="absolute top-3 right-3 text-xs font-semibold uppercase tracking-wide bg-primary text-primary-foreground rounded-full px-3 py-1">
        {afterLabel}
      </span>

      <div
        className="absolute top-0 bottom-0 w-0.5 bg-background pointer-events-none"
        style={{ left: `${pos}%` }}
      >
        <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-10 h-10 rounded-full bg-background shadow-soft flex items-center justify-center border border-border">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
            <polyline points="15 18 9 12 15 6" />
            <polyline points="9 18 3 12 9 6" style={{ transform: "translateX(12px)" }} />
          </svg>
        </div>
      </div>
    </div>
  );
};
