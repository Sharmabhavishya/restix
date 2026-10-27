// Small SVG charts drawn to the app-screen rules: one hue on the main data, square bars,
// 3-5 faint gridlines, round integer ticks from zero, no legend for a single series.

/** A round top value for a count axis split into four integer steps (0, 1, 2, 5, 10... per step). */
export function niceMax(max: number): number {
  if (max <= 4) return 4;
  const raw = max / 4;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((m) => m * pow).find((s) => s >= raw)!;
  return Math.ceil(step) * 4;
}

interface Point {
  label: string;
  value: number;
}

const W = 560;
const H = 180;
const PAD = { top: 10, right: 8, bottom: 26, left: 32 };

function Axes({ max, labels }: { max: number; labels: { x: number; text: string }[] }) {
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * max);
  const ih = H - PAD.top - PAD.bottom;
  return (
    <g fontSize="11" fill="var(--color-muted)">
      {ticks.map((t) => {
        const y = PAD.top + ih - (t / max) * ih;
        return (
          <g key={t}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y} y2={y} stroke={t === 0 ? "#c9ccd2" : "#eceef1"} strokeWidth={t === 0 ? 1.5 : 1} />
            <text x={PAD.left - 6} y={y + 3.5} textAnchor="end" className="num">{Number.isInteger(t) ? t : t.toFixed(1)}</text>
          </g>
        );
      })}
      {labels.map((l) => (
        <text key={l.x} x={l.x} y={H - 8} textAnchor="middle">{l.text}</text>
      ))}
    </g>
  );
}

function xLabels(points: Point[], xAt: (i: number) => number) {
  if (points.length === 0) return [];
  const step = Math.max(1, Math.ceil(points.length / 6));
  const out: { x: number; text: string }[] = [];
  for (let i = 0; i < points.length; i += step) out.push({ x: xAt(i), text: points[i].label });
  return out;
}

/** Per-period columns. */
export function Columns({ points, title }: { points: Point[]; title: string }) {
  const max = niceMax(Math.max(0, ...points.map((p) => p.value)));
  const iw = W - PAD.left - PAD.right;
  const ih = H - PAD.top - PAD.bottom;
  const slot = iw / Math.max(points.length, 1);
  const bw = Math.max(2, Math.min(18, slot * 0.66));
  const xAt = (i: number) => PAD.left + slot * i + slot / 2;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={`${title}: ${points.map((p) => `${p.label} ${p.value}`).join(", ")}`}>
      <Axes max={max} labels={xLabels(points, xAt)} />
      {points.map((p, i) => {
        const h = (p.value / max) * ih;
        return p.value > 0 ? (
          <rect key={i} x={xAt(i) - bw / 2} y={PAD.top + ih - h} width={bw} height={h} fill="var(--color-accent)">
            <title>{`${p.label}: ${p.value}`}</title>
          </rect>
        ) : null;
      })}
    </svg>
  );
}

/** Running total as one 2px straight line. */
export function RunningTotal({ points, title }: { points: Point[]; title: string }) {
  const cum = points.reduce<Point[]>((acc, p) => [...acc, { label: p.label, value: (acc.at(-1)?.value ?? 0) + p.value }], []);
  const max = niceMax(Math.max(0, ...cum.map((p) => p.value)));
  const iw = W - PAD.left - PAD.right;
  const ih = H - PAD.top - PAD.bottom;
  const xAt = (i: number) => PAD.left + (cum.length <= 1 ? iw / 2 : (iw * i) / (cum.length - 1));
  const yAt = (v: number) => PAD.top + ih - (v / max) * ih;
  const d = cum.map((p, i) => `${i ? "L" : "M"}${xAt(i).toFixed(1)},${yAt(p.value).toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={`${title}: ${cum.at(-1)?.value ?? 0} in total`}>
      <Axes max={max} labels={xLabels(cum, xAt)} />
      <path d={d} fill="none" stroke="var(--color-ink)" strokeWidth={2} strokeLinejoin="round" />
    </svg>
  );
}

/** A sorted list with a thin proportional bar under each label. */
export function BarList({ rows, empty }: { rows: { label: string; value: number }[]; empty: string }) {
  if (rows.length === 0) return <p className="text-sm text-muted">{empty}</p>;
  const max = Math.max(...rows.map((r) => r.value));
  return (
    <ul className="flex flex-col gap-3">
      {rows.map((r, i) => (
        <li key={r.label}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate">{r.label}</span>
            <span className="num font-medium">{r.value.toLocaleString("en-IN")}</span>
          </div>
          <div className="mt-1 h-[3px] rounded-full bg-rule">
            <div className={`h-full rounded-full ${i === 0 ? "bg-accent" : "bg-[#9aa0a9]"}`} style={{ width: `${(r.value / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
